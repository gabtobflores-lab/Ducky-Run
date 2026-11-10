// Mirror Drop: the whole iPhone app in one Swift file.
// It shows the game (index.html, added to the app's resources) full screen in a web view
// and provides the two native features the game asks for: saving (Preferences) and Game Center.
// Works in Swift Playgrounds (iPad or Mac) and in a plain Xcode SwiftUI project. No Capacitor or npm needed.

import SwiftUI
import WebKit
import GameKit
import StoreKit
import AVFoundation

@main
struct MirrorDropApp: App {
    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()
                .statusBarHidden(true)
                .hideHomeIndicator()
                .background(Color(red: 0xf6 / 255, green: 0xf1 / 255, blue: 0xea / 255)) // the cream of the loading screen, so launch never flashes black
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
        // Ambient audio: the Ring/Silent switch and the volume buttons silence the game, and it mixes with the player's own music
        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
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
        #if targetEnvironment(simulator)
        // the simulator draws on the Mac, so the game opens at 2x there; iPhones get full 3x
        config.userContentController.addUserScript(WKUserScript(source: "window.__mdSim = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        #endif
        config.userContentController.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "native")

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        let cream = UIColor(red: 0xf6 / 255, green: 0xf1 / 255, blue: 0xea / 255, alpha: 1)
        web.backgroundColor = cream
        web.scrollView.backgroundColor = cream
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsLinkPreview = false
        context.coordinator.webView = web
        Store.shared.bridge = context.coordinator
        Store.shared.start()
        web.navigationDelegate = context.coordinator           // if iOS ever stops the game's page, it is reloaded instead of staying blank
        context.coordinator.startWatch()
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true } // builds run from Xcode can be inspected in Safari's Develop menu
        // builds run from Xcode show their version for a few seconds, so it's clear the newest one is on the phone
        let tag = UILabel(); tag.text = "  build \(NativeBridge.appBuild)  "; tag.font = .monospacedSystemFont(ofSize: 11, weight: .medium)
        tag.textColor = .white; tag.backgroundColor = UIColor(white: 0, alpha: 0.55); tag.layer.cornerRadius = 8; tag.clipsToBounds = true
        tag.translatesAutoresizingMaskIntoConstraints = false; web.addSubview(tag)
        NSLayoutConstraint.activate([tag.centerXAnchor.constraint(equalTo: web.centerXAnchor), tag.bottomAnchor.constraint(equalTo: web.safeAreaLayoutGuide.bottomAnchor, constant: -6), tag.heightAnchor.constraint(equalToConstant: 20)])
        Task { @MainActor in try? await Task.sleep(nanoseconds: 6_000_000_000); UIView.animate(withDuration: 0.4, animations: { tag.alpha = 0 }) { _ in tag.removeFromSuperview() } }
        #endif
        ProMotion.shared.start()

        if let url = Bundle.main.url(forResource: "index", withExtension: "html") {
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
            let kb = ((try? FileManager.default.attributesOfItem(atPath: url.path)[.size]) as? NSNumber)?.intValue ?? 0
            let video = Bundle.main.url(forResource: "aurora", withExtension: "mp4") != nil
            context.coordinator.note("game file \(kb / 1024) KB, aurora video in app: \(video ? "yes" : "no")")
        } else {
            context.coordinator.note("index.html is missing from the app")
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
final class NativeBridge: NSObject, WKScriptMessageHandlerWithReply, WKNavigationDelegate {
    weak var webView: WKWebView?

    func tellGame(_ js: String) { webView?.evaluateJavaScript(js, completionHandler: nil) }

    // MARK: start-up check
    // If the game hasn't shown its menu 6 seconds after launch, a small panel says what happened, so a stuck start can be fixed.

    static let appBuild = "dev"   // replaced with the release's version by tools/build-app-update.sh
    private var ready = false
    private var events: [String] = []
    private var panel: UIView?

    func note(_ s: String) { events.append(s); if events.count > 12 { events.removeFirst() } }

    func startWatch() {
        note("app \(NativeBridge.appBuild) started")
        Task { @MainActor [weak self] in try? await Task.sleep(nanoseconds: 6_000_000_000); self?.showPanelIfStuck() }
    }

    private func startWatchAgain() { Task { @MainActor [weak self] in try? await Task.sleep(nanoseconds: 6_000_000_000); self?.showPanelIfStuck() } }

    private func showPanelIfStuck() {
        guard !ready, panel == nil, let web = webView else { return }
        let box = UIView(); box.backgroundColor = UIColor(white: 1, alpha: 0.94); box.layer.cornerRadius = 18
        box.translatesAutoresizingMaskIntoConstraints = false
        let text = UILabel(); text.numberOfLines = 0; text.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        text.textColor = UIColor(white: 0.25, alpha: 1); text.translatesAutoresizingMaskIntoConstraints = false
        text.text = "Mirror Drop didn't finish starting.\nPlease screenshot this.\n\n" + events.joined(separator: "\n")
        let again = UIButton(type: .system); again.setTitle("Reload", for: .normal); again.titleLabel?.font = .boldSystemFont(ofSize: 17)
        again.translatesAutoresizingMaskIntoConstraints = false
        again.addAction(UIAction { [weak self] _ in self?.panel?.removeFromSuperview(); self?.panel = nil; self?.note("reload tapped"); web.reload()
            self?.startWatchAgain() }, for: .touchUpInside)
        box.addSubview(text); box.addSubview(again); web.addSubview(box)
        NSLayoutConstraint.activate([
            box.leadingAnchor.constraint(equalTo: web.leadingAnchor, constant: 16), box.trailingAnchor.constraint(equalTo: web.trailingAnchor, constant: -16),
            box.bottomAnchor.constraint(equalTo: web.safeAreaLayoutGuide.bottomAnchor, constant: -16),
            text.topAnchor.constraint(equalTo: box.topAnchor, constant: 16), text.leadingAnchor.constraint(equalTo: box.leadingAnchor, constant: 16),
            text.trailingAnchor.constraint(equalTo: box.trailingAnchor, constant: -16),
            again.topAnchor.constraint(equalTo: text.bottomAnchor, constant: 8), again.centerXAnchor.constraint(equalTo: box.centerXAnchor),
            again.bottomAnchor.constraint(equalTo: box.bottomAnchor, constant: -10)])
        panel = box
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { note("page loading") }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { note("page loaded") }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { note("page failed: \(error.localizedDescription)") }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { note("page failed to open: \(error.localizedDescription)") }

    /// iOS can stop a web page's process (for example under memory pressure); show the game again instead of a blank screen
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { note("page process stopped, reloading"); webView.reload() }
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

        // The exact safe area (the Dynamic Island and the home indicator), so the score never sits under the island
        // Start-up check: the game reports when its menu is up, and anything that goes wrong on the way
        case ("App", "ready"):
            ready = true; panel?.removeFromSuperview(); panel = nil
            return ([String: Any](), nil)
        case ("App", "log"):
            note(String((opts["msg"] as? String ?? "").prefix(220)))
            return ([String: Any](), nil)

        case ("App", "safeArea"):
            let w = webView?.window
            let ins = w?.safeAreaInsets ?? webView?.safeAreaInsets ?? .zero
            return (["top": Double(ins.top), "bottom": Double(ins.bottom)], nil)

        // The aurora and black hole videos, handed to the game after launch so the game file itself stays small and opens fast
        case ("App", "aurora"), ("App", "blackhole"):
            let name = method
            let data = await Task.detached(priority: .utility) { () -> String? in
                guard let url = Bundle.main.url(forResource: name, withExtension: "mp4"),
                      let bytes = try? Data(contentsOf: url) else { return nil }
                return bytes.base64EncodedString()
            }.value
            guard let data else { return (nil, "\(name).mp4 is not in the app") }
            return (["data": data], nil)

        // Sharing: the iPhone's own share sheet with the score picture and a line of text
        case ("App", "share"):
            var items: [Any] = []
            if let url = opts["image"] as? String, let comma = url.firstIndex(of: ","),
               let data = Data(base64Encoded: String(url[url.index(after: comma)...])), let image = UIImage(data: data) { items.append(image) }
            if let text = opts["text"] as? String, !text.isEmpty { items.append(text) }
            guard !items.isEmpty, let top = topViewController(), let web = webView else { return (nil, "nothing to share") }
            let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
            if let pop = sheet.popoverPresentationController { // iPad: the sheet points at the bottom of the screen
                pop.sourceView = web; pop.sourceRect = CGRect(x: web.bounds.midX, y: web.bounds.maxY - 120, width: 1, height: 1)
            }
            top.present(sheet, animated: true)
            return ([String: Any](), nil)

        // Purchases: Plus, Pro, Max and Supporter, bought once through the App Store
        case ("Store", "products"):
            await Store.shared.loadProducts()
            return (["products": Store.shared.products.map { id, product -> [String: Any] in
                var p: [String: Any] = ["id": id, "price": product.displayPrice]
                if let period = product.subscription?.subscriptionPeriod { p["period"] = Store.periodName(period) }
                return p
            }], nil)
        case ("Store", "entitlement"):
            await Store.shared.refresh()
            return (Store.shared.status, nil)
        case ("Store", "buy"):
            let (_, error) = await Store.shared.buy(opts["id"] as? String ?? "")
            var reply = Store.shared.status
            if let error { reply["error"] = error }
            return (reply, nil)
        case ("Store", "restore"):
            await Store.shared.restore()
            return (Store.shared.status, nil)
        // Continues bought with money (consumables): the app holds them until the game confirms it has saved them
        case ("Store", "claimContinues"):
            return (["count": Store.shared.pendingContinues], nil)
        case ("Store", "ackContinues"):
            Store.shared.ackContinues((opts["count"] as? NSNumber)?.intValue ?? 0)
            return ([String: Any](), nil)
        // VIP: Apple's own sheet for managing or cancelling the subscription
        case ("Store", "manage"):
            guard let scene = webView?.window?.windowScene else { return (nil, "no window") }
            try? await AppStore.showManageSubscriptions(in: scene)
            await Store.shared.refresh(push: true)
            return ([String: Any](), nil)

        // Links (Terms of Use, Privacy Policy) open in Safari, never inside the game
        case ("App", "open"):
            guard let s = opts["url"] as? String, let url = URL(string: s), url.scheme == "https" else { return (nil, "bad link") }
            await UIApplication.shared.open(url)
            return ([String: Any](), nil)

        // Supporter's app icon: Classic or Gold on the Home Screen
        case ("App", "setIcon"):
            let name = (opts["name"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            guard UIApplication.shared.supportsAlternateIcons else { return (nil, "alternate icons are not available") }
            do { try await UIApplication.shared.setAlternateIconName(name); return ([String: Any](), nil) }
            catch { return (nil, error.localizedDescription) }

        // Haptics: the Taptic Engine, at the same moments as the game's sounds
        case ("Haptics", "feedback"):
            feedback(opts["kind"] as? String ?? "light")
            return ([String: Any](), nil)

        default:
            return (nil, "\(plugin).\(method) is not available")
        }
    }

    private var impacts: [String: UIImpactFeedbackGenerator] = [:]
    private var selection: UISelectionFeedbackGenerator?
    private var notification: UINotificationFeedbackGenerator?

    /// light / medium / heavy / soft / rigid taps, a selection tick, or success / warning / error. Needs iOS 17.5; older phones simply stay silent.
    private func feedback(_ kind: String) {
        guard #available(iOS 17.5, *), let view = webView else { return }
        let at = CGPoint(x: view.bounds.midX, y: view.bounds.midY)
        switch kind {
        case "selection":
            let g = selection ?? UISelectionFeedbackGenerator(view: view)
            selection = g
            g.selectionChanged(at: at)
        case "success", "warning", "error":
            let g = notification ?? UINotificationFeedbackGenerator(view: view)
            notification = g
            g.notificationOccurred(kind == "success" ? .success : kind == "warning" ? .warning : .error, at: at)
        default:
            let styles: [String: UIImpactFeedbackGenerator.FeedbackStyle] = ["light": .light, "medium": .medium, "heavy": .heavy, "soft": .soft, "rigid": .rigid]
            let g = impacts[kind] ?? UIImpactFeedbackGenerator(style: styles[kind] ?? .light, view: view)
            impacts[kind] = g
            g.impactOccurred(intensity: 1, at: at)
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
            // set the handler again on every attempt: this is what makes iOS try again after a failed or cancelled sign-in
            let bridge = self   // a constant reference: safe to hand to the main-thread task below
            GKLocalPlayer.local.authenticateHandler = { @Sendable viewController, error in
                let message = error?.localizedDescription
                Task { @MainActor in bridge.finishSignIn(viewController, message) }
            }
        }
    }

    private func finishSignIn(_ viewController: UIViewController?, _ error: String?) {
        if let viewController {
            topViewController()?.present(viewController, animated: true)
            return
        }
        let info = currentPlayer(error: error)
        // tell the game straight away, also when Game Center signs the player in later on its own (for example from Settings)
        if let data = try? JSONSerialization.data(withJSONObject: info.dictionary), let json = String(data: data, encoding: .utf8) {
            webView?.evaluateJavaScript("window.onGameCenter && window.onGameCenter(\(json))", completionHandler: nil)
        }
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

/// Asks the screen to run at its full ProMotion rate (120 Hz) while the app is open,
/// for everything iOS lets run that fast (system animations, scrolling, the game's sliding and fading menus).
@MainActor
final class ProMotion: NSObject {
    static let shared = ProMotion()
    private var link: CADisplayLink?

    func start() {
        guard link == nil else { return }
        let l = CADisplayLink(target: self, selector: #selector(tick(_:)))
        l.preferredFrameRateRange = CAFrameRateRange(minimum: 80, maximum: 120, preferred: 120)
        l.add(to: .main, forMode: .common)
        link = l
    }

    @objc private func tick(_ link: CADisplayLink) {}
}

/// The App Store side of the packs. Tiers: 0 free, 1 Plus, 2 Pro, 3 Max, 4 Supporter. Each pack is a one-time purchase
/// (non-consumable); upgrades are their own products priced at the difference. Owning any product gives at least its tier.
/// Mirror Drop VIP is separate: an auto-renewing subscription. It counts only while the App Store reports it active
/// (verified, not revoked, not expired); the packs and Supporter stay owned whatever happens to VIP.
@MainActor
final class Store {
    static let shared = Store()
    weak var bridge: NativeBridge?
    private(set) var products: [String: Product] = [:]
    private(set) var tier = 0
    private(set) var founding = false
    private(set) var vip = false
    private(set) var vipUntil: Date?
    private(set) var vipRenews = false
    private var started = false
    /// VIP's product IDs (one subscription group in App Store Connect). Its price is set there, not here.
    static let vipIds = ["mirrordrop.vip.monthly"]
    /// Continues sold for money: consumables, each adds that many continues. Prices are set in App Store Connect.
    static let continueIds: [String: Int] = ["mirrordrop.continues.1": 1, "mirrordrop.continues.2": 2, "mirrordrop.continues.5": 5, "mirrordrop.continues.10": 10, "mirrordrop.continues.20": 20]
    private static let pendingKey = "md.continues.pending", seenKey = "md.continues.seen"
    /// continues paid for but not yet saved by the game; kept in the app's own storage so a crash or restart never loses them
    var pendingContinues: Int { UserDefaults.standard.integer(forKey: Store.pendingKey) }
    func ackContinues(_ n: Int) { UserDefaults.standard.set(max(0, pendingContinues - max(0, n)), forKey: Store.pendingKey) }
    /// a transaction that finished outside the purchase sheet: continues are credited, everything else simply finished
    func handle(_ transaction: StoreKit.Transaction) async {
        if Store.continueIds[transaction.productID] != nil { await credit(transaction) } else { await transaction.finish() }
    }
    /// credits a verified consumable exactly once (by transaction ID), then finishes it
    func credit(_ transaction: StoreKit.Transaction) async {
        guard let n = Store.continueIds[transaction.productID], transaction.revocationDate == nil else { return }
        var seen = Set(UserDefaults.standard.stringArray(forKey: Store.seenKey) ?? [])
        let id = String(transaction.id)
        if !seen.contains(id) {
            seen.insert(id)
            UserDefaults.standard.set(Array(seen.suffix(500)), forKey: Store.seenKey)
            UserDefaults.standard.set(pendingContinues + n, forKey: Store.pendingKey)
        }
        await transaction.finish()
        bridge?.tellGame("window.onContinues && window.onContinues()")
    }

    var status: [String: Any] {
        var d: [String: Any] = ["tier": tier, "founding": founding, "vip": vip, "vipRenews": vipRenews]
        if let vipUntil { d["vipUntil"] = vipUntil.timeIntervalSince1970 * 1000 }
        return d
    }

    static func periodName(_ p: Product.SubscriptionPeriod) -> String {
        let unit: String
        switch p.unit { case .day: unit = "day"; case .week: unit = "week"; case .month: unit = "month"; case .year: unit = "year"; @unknown default: unit = "period" }
        return p.value == 1 ? unit : "\(p.value) \(unit)s"
    }
    /// Supporters who buy before this date get the Founding Supporter badge (set it to one year after launch)
    static let foundingUntil = DateComponents(calendar: Calendar(identifier: .gregorian), year: 2027, month: 12, day: 31).date ?? .distantFuture

    static let baseIds = ["mirrordrop.plus", "mirrordrop.pro", "mirrordrop.max", "mirrordrop.supporter",
                          "mirrordrop.upgrade.pro.from.plus", "mirrordrop.upgrade.max.from.plus", "mirrordrop.upgrade.max.from.pro",
                          "mirrordrop.upgrade.supporter.from.plus", "mirrordrop.upgrade.supporter.from.pro", "mirrordrop.upgrade.supporter.from.max"]
    /// a pack recreated in App Store Connect gets ".v2" on its ID (Apple never reuses a deleted ID); either one works
    static let ids = baseIds + baseIds.map { $0 + ".v2" }
    static func base(_ id: String) -> String { id.hasSuffix(".v2") ? String(id.dropLast(3)) : id }

    static func tier(of rawId: String) -> Int {
        let id = base(rawId)
        let target = id.hasPrefix("mirrordrop.upgrade.") ? String(id.dropFirst("mirrordrop.upgrade.".count).prefix { $0 != "." }) : String(id.dropFirst("mirrordrop.".count))
        switch target { case "plus": return 1; case "pro": return 2; case "max": return 3; case "supporter": return 4; default: return 0 }
    }

    func start() {
        guard !started else { return }
        started = true
        // purchases that finish outside the purchase sheet: Ask to Buy approvals, Family Sharing, refunds
        Task.detached(priority: .background) {
            for await update in Transaction.updates {
                if case .verified(let transaction) = update { await Store.shared.handle(transaction) }
                await Store.shared.refresh(push: true)
            }
        }
        Task {
            await loadProducts(); await refresh(push: true)
            // any paid continues whose purchase finished while the app was closed
            for await result in Transaction.unfinished { if case .verified(let t) = result, Store.continueIds[t.productID] != nil { await credit(t) } }
        }
    }

    func loadProducts() async {
        guard products.isEmpty, let list = try? await Product.products(for: Store.ids + Store.vipIds + Array(Store.continueIds.keys)) else { return }
        for product in list where products[Store.base(product.id)] == nil || product.id.hasSuffix(".v2") { products[Store.base(product.id)] = product } // the ".v2" pack wins when both exist
        // VIP's IDs are kept as they are
    }

    func refresh(push: Bool = false) async {
        var best = 0, firstSupporter: Date?, vipNow = false, vipEnd: Date?, vipProduct: String?
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result, transaction.revocationDate == nil else { continue }
            if Store.vipIds.contains(transaction.productID) {
                if let end = transaction.expirationDate, end > Date() { vipNow = true; vipEnd = max(vipEnd ?? end, end); vipProduct = transaction.productID }
                continue
            }
            let t = Store.tier(of: transaction.productID)
            best = max(best, t)
            if t == 4 { firstSupporter = min(firstSupporter ?? transaction.purchaseDate, transaction.purchaseDate) }
        }
        var renews = false
        if vipNow, let id = vipProduct {
            var product = products[id]
            if product == nil { product = (try? await Product.products(for: [id]))?.first }
            if let statuses = try? await product?.subscription?.status {
                for st in statuses { if case .verified(let info) = st.renewalInfo, info.willAutoRenew { renews = true } }
            }
        }
        let changed = best != tier || vipNow != vip
        tier = best
        vip = vipNow; vipUntil = vipEnd; vipRenews = renews
        founding = firstSupporter.map { $0 < Store.foundingUntil } ?? false
        if push && changed {
            let until = vipEnd.map { String(Int($0.timeIntervalSince1970 * 1000)) } ?? "0"
            bridge?.tellGame("window.onStore && window.onStore({tier: \(best), vip: \(vipNow), vipUntil: \(until), vipRenews: \(renews)})")
        }
    }

    func buy(_ id: String) async -> (Int, String?) {
        await loadProducts()
        guard let product = products[Store.base(id)] else { return (tier, "This pack isn't available right now. Try again in a moment.") }
        do {
            switch try await product.purchase() {
            case .success(let verification):
                guard case .verified(let transaction) = verification else { return (tier, "The App Store couldn't confirm this purchase.") }
                if Store.continueIds[transaction.productID] != nil { await credit(transaction); return (tier, nil) }
                await transaction.finish()
                await refresh()
                return (tier, nil)
            case .userCancelled: return (tier, "cancelled")
            case .pending: return (tier, "Waiting for approval. It unlocks as soon as it's approved.")
            @unknown default: return (tier, nil)
            }
        } catch {
            return (tier, error.localizedDescription)
        }
    }

    func restore() async {
        try? await AppStore.sync()
        await refresh()
    }
}
