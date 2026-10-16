// Mirror Drop: the whole iPhone app in one Swift file.
// It shows the game (index.html, added to the app's resources) full screen in a web view
// and provides the two native features the game asks for: saving (Preferences) and Game Center.
// Works in Swift Playgrounds (iPad or Mac) and in a plain Xcode SwiftUI project. No Capacitor or npm needed.

import SwiftUI
import WebKit
import GameKit

@main
struct MirrorDropApp: App {
    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()
                .statusBarHidden(true)
                .hideHomeIndicator()
                .background(Color.black)
                .onAppear { UIApplication.shared.isIdleTimerDisabled = true } // the screen stays on while playing
        }
    }
}

extension View {
    @ViewBuilder func hideHomeIndicator() -> some View {
        if #available(iOS 16.0, *) { self.persistentSystemOverlays(.hidden) } else { self }
    }
}

struct GameView: UIViewRepresentable {
    func makeCoordinator() -> NativeBridge { NativeBridge() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true                // the aurora video plays inside the game
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = .default()                   // scores saved by the game survive app restarts

        // The game looks for Capacitor's bridge; this tiny stand-in sends its calls to NativeBridge below.
        let shim = """
        window.Capacitor = {
          isNativePlatform: function () { return true; },
          getPlatform: function () { return 'ios'; },
          nativePromise: function (plugin, method, opts) {
            return window.webkit.messageHandlers.native.postMessage({ plugin: plugin, method: method, opts: opts || {} });
          }
        };
        """
        config.userContentController.addUserScript(WKUserScript(source: shim, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "native")

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = .black
        web.scrollView.backgroundColor = .black
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsLinkPreview = false
        context.coordinator.webView = web

        if let url = Bundle.main.url(forResource: "index", withExtension: "html") {
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else {
            web.loadHTMLString("<body style='background:#000;color:#fff;font:20px -apple-system;padding:80px 24px'>Add the game file <b>index.html</b> to this app's resources.</body>", baseURL: nil)
        }
        return web
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}
}

/// What the game learns about the Game Center player.
struct PlayerInfo: Sendable {
    var authenticated = false
    var alias = ""
    var displayName = ""
    var playerId = ""
    var underage = false
    var error: String?

    var dictionary: [String: Any] {
        var d: [String: Any] = ["authenticated": authenticated]
        if authenticated { d["alias"] = alias; d["displayName"] = displayName; d["playerId"] = playerId; d["underage"] = underage }
        if let error { d["error"] = error }
        return d
    }
}

/// Answers the game's calls. Everything runs on the main thread; Game Center work is awaited.
@MainActor
final class NativeBridge: NSObject, WKScriptMessageHandlerWithReply {
    weak var webView: WKWebView?
    private var waitingForSignIn: [CheckedContinuation<PlayerInfo, Never>] = []
    private var authHandlerSet = false

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) async -> (Any?, String?) {
        guard let body = message.body as? [String: Any],
              let plugin = body["plugin"] as? String,
              let method = body["method"] as? String else { return (nil, "bad call") }
        let opts = body["opts"] as? [String: Any] ?? [:]
        let store = UserDefaults.standard

        switch (plugin, method) {

        // Saving: a backup of the scores and profile in the app's own storage
        case ("Preferences", "get"):
            let key = "CapacitorStorage." + (opts["key"] as? String ?? "")
            if let value = store.string(forKey: key) { return (["value": value], nil) }
            return (["value": NSNull()], nil)
        case ("Preferences", "set"):
            if let key = opts["key"] as? String { store.set(opts["value"] as? String, forKey: "CapacitorStorage." + key) }
            return ([String: Any](), nil)

        // Game Center
        case ("GameCenter", "signIn"):
            let info = await signIn()
            return (info.dictionary, nil)
        case ("GameCenter", "player"):
            return (currentPlayer().dictionary, nil)
        case ("GameCenter", "photo"):
            guard GKLocalPlayer.local.isAuthenticated,
                  let image = try? await GKLocalPlayer.local.loadPhoto(for: .normal),
                  let data = image.jpegData(compressionQuality: 0.85) else { return ([String: Any](), nil) }
            return (["dataUrl": "data:image/jpeg;base64," + data.base64EncodedString()], nil)
        case ("GameCenter", "submitScore"):
            guard let id = opts["leaderboardId"] as? String, let score = (opts["score"] as? NSNumber)?.intValue else { return (nil, "leaderboardId and score are required") }
            guard GKLocalPlayer.local.isAuthenticated else { return (nil, "not signed in") }
            do {
                try await GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [id])
                return ([String: Any](), nil)
            } catch {
                return (nil, error.localizedDescription)
            }
        case ("GameCenter", "showLeaderboard"):
            guard GKLocalPlayer.local.isAuthenticated else { return (nil, "not signed in") }
            // Apple's own Game Center screen, opened on this leaderboard (worldwide, all time)
            if #available(iOS 18.0, *), let id = opts["leaderboardId"] as? String {
                GKAccessPoint.shared.trigger(leaderboardID: id, playerScope: .global, timeScope: .allTime) {}
            } else {
                GKAccessPoint.shared.trigger(state: .leaderboards) {}
            }
            return ([String: Any](), nil)

        default:
            return (nil, "\(plugin).\(method) is not available")
        }
    }

    private func currentPlayer(error: String? = nil) -> PlayerInfo {
        let p = GKLocalPlayer.local
        guard p.isAuthenticated else { return PlayerInfo(error: error) }
        return PlayerInfo(authenticated: true, alias: p.alias, displayName: p.displayName, playerId: p.gamePlayerID, underage: p.isUnderage, error: error)
    }

    /// Signs in with the Apple ID's Game Center account. iOS shows its own sign-in sheet only if the player has never signed in.
    private func signIn() async -> PlayerInfo {
        if GKLocalPlayer.local.isAuthenticated { return currentPlayer() }
        return await withCheckedContinuation { (continuation: CheckedContinuation<PlayerInfo, Never>) in
            waitingForSignIn.append(continuation)
            guard !authHandlerSet else { return }
            authHandlerSet = true
            GKLocalPlayer.local.authenticateHandler = { @Sendable [weak self] viewController, error in
                let message = error?.localizedDescription
                Task { @MainActor in self?.finishSignIn(viewController, message) }
            }
        }
    }

    private func finishSignIn(_ viewController: UIViewController?, _ error: String?) {
        if let viewController {
            topViewController()?.present(viewController, animated: true)
            return
        }
        let info = currentPlayer(error: error)
        let waiting = waitingForSignIn
        waitingForSignIn.removeAll()
        waiting.forEach { $0.resume(returning: info) }
    }

    private func topViewController() -> UIViewController? {
        let windows = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap { $0.windows }
        var vc = (windows.first { $0.isKeyWindow } ?? windows.first)?.rootViewController
        while let presented = vc?.presentedViewController { vc = presented }
        return vc
    }
}
