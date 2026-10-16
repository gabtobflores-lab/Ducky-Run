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

final class NativeBridge: NSObject, WKScriptMessageHandlerWithReply, GKGameCenterControllerDelegate {
    weak var webView: WKWebView?
    private var signInReplies: [([String: Any]) -> Void] = []
    private var authHandlerSet = false
    private let store = UserDefaults.standard

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        let reply: (Any?, String?) -> Void = { value, error in DispatchQueue.main.async { replyHandler(value, error) } }
        guard let body = message.body as? [String: Any],
              let plugin = body["plugin"] as? String,
              let method = body["method"] as? String else { reply(nil, "bad call"); return }
        let opts = body["opts"] as? [String: Any] ?? [:]

        switch (plugin, method) {

        // Saving: a backup of the scores and profile in the app's own storage
        case ("Preferences", "get"):
            let key = "CapacitorStorage." + (opts["key"] as? String ?? "")
            if let value = store.string(forKey: key) { reply(["value": value], nil) } else { reply(["value": NSNull()], nil) }
        case ("Preferences", "set"):
            if let key = opts["key"] as? String { store.set(opts["value"] as? String, forKey: "CapacitorStorage." + key) }
            reply([String: Any](), nil)

        // Game Center
        case ("GameCenter", "signIn"):
            signIn { info in reply(info, nil) }
        case ("GameCenter", "player"):
            reply(playerInfo(), nil)
        case ("GameCenter", "photo"):
            guard GKLocalPlayer.local.isAuthenticated else { reply([String: Any](), nil); return }
            GKLocalPlayer.local.loadPhoto(for: .normal) { image, _ in
                guard let image = image, let data = image.jpegData(compressionQuality: 0.85) else { reply([String: Any](), nil); return }
                reply(["dataUrl": "data:image/jpeg;base64," + data.base64EncodedString()], nil)
            }
        case ("GameCenter", "submitScore"):
            guard let id = opts["leaderboardId"] as? String, let score = (opts["score"] as? NSNumber)?.intValue else { reply(nil, "leaderboardId and score are required"); return }
            guard GKLocalPlayer.local.isAuthenticated else { reply(nil, "not signed in"); return }
            GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [id]) { error in
                if let error = error { reply(nil, error.localizedDescription) } else { reply([String: Any](), nil) }
            }
        case ("GameCenter", "showLeaderboard"):
            DispatchQueue.main.async {
                guard GKLocalPlayer.local.isAuthenticated else { reply(nil, "not signed in"); return }
                let vc: GKGameCenterViewController
                if let id = opts["leaderboardId"] as? String {
                    vc = GKGameCenterViewController(leaderboardID: id, playerScope: .global, timeScope: .allTime)
                } else {
                    vc = GKGameCenterViewController(state: .leaderboards)
                }
                vc.gameCenterDelegate = self
                self.topViewController()?.present(vc, animated: true)
                reply([String: Any](), nil)
            }

        default:
            reply(nil, "\(plugin).\(method) is not available")
        }
    }

    private func playerInfo() -> [String: Any] {
        let p = GKLocalPlayer.local
        guard p.isAuthenticated else { return ["authenticated": false] }
        return ["authenticated": true, "alias": p.alias, "displayName": p.displayName, "playerId": p.gamePlayerID, "underage": p.isUnderage]
    }

    /// Signs in with the Apple ID's Game Center account. iOS shows its own sign-in sheet only if the player has never signed in.
    private func signIn(_ done: @escaping ([String: Any]) -> Void) {
        DispatchQueue.main.async {
            if GKLocalPlayer.local.isAuthenticated { done(self.playerInfo()); return }
            self.signInReplies.append(done)
            guard !self.authHandlerSet else { return }
            self.authHandlerSet = true
            GKLocalPlayer.local.authenticateHandler = { [weak self] vc, error in
                guard let self = self else { return }
                DispatchQueue.main.async {
                    if let vc = vc { self.topViewController()?.present(vc, animated: true); return }
                    var info = self.playerInfo()
                    if let error = error { info["error"] = error.localizedDescription }
                    let waiting = self.signInReplies
                    self.signInReplies.removeAll()
                    waiting.forEach { $0(info) }
                }
            }
        }
    }

    private func topViewController() -> UIViewController? {
        let windows = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap { $0.windows }
        var vc = (windows.first { $0.isKeyWindow } ?? windows.first)?.rootViewController
        while let presented = vc?.presentedViewController { vc = presented }
        return vc
    }

    func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
