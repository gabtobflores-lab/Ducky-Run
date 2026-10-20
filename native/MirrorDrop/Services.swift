// Haptics (the Taptic Engine) and Game Center (sign-in, profile picture, leaderboards).

import UIKit
import Combine
import GameKit

// MARK: - Haptics

@MainActor
final class Haptics {
    static let shared = Haptics()
    weak var view: UIView?
    private var impacts: [Haptic: UIImpactFeedbackGenerator] = [:]
    private var selection: UISelectionFeedbackGenerator?
    private var notification: UINotificationFeedbackGenerator?
    private var last = 0.0

    /// light / medium / heavy / soft / rigid taps, a selection tick, or success / warning / error. Needs iOS 17.5; older phones simply stay silent.
    func play(_ kind: Haptic) {
        let now = CACurrentMediaTime()
        if now - last < 0.035 && kind != .error && kind != .success { return }
        last = now
        guard #available(iOS 17.5, *), let view else { return }
        let at = CGPoint(x: view.bounds.midX, y: view.bounds.midY)
        switch kind {
        case .selection:
            let g = selection ?? UISelectionFeedbackGenerator(view: view); selection = g; g.selectionChanged(at: at)
        case .success, .warning, .error:
            let g = notification ?? UINotificationFeedbackGenerator(view: view); notification = g
            g.notificationOccurred(kind == .success ? .success : kind == .warning ? .warning : .error, at: at)
        default:
            let style: UIImpactFeedbackGenerator.FeedbackStyle
            switch kind { case .medium: style = .medium; case .heavy: style = .heavy; case .soft: style = .soft; case .rigid: style = .rigid; default: style = .light }
            let g = impacts[kind] ?? UIImpactFeedbackGenerator(style: style, view: view); impacts[kind] = g
            g.impactOccurred(intensity: 1, at: at)
        }
    }
}

// MARK: - Game Center

@MainActor
final class GameCenter: ObservableObject {
    static let shared = GameCenter()
    @Published private(set) var signedIn = false
    @Published private(set) var alias = ""
    @Published private(set) var photo: UIImage? = nil
    private var started = false
    var save: SaveData?

    /// Apple asks games to sign in at launch; iOS shows a small "Welcome back" banner
    func signIn() {
        if GKLocalPlayer.local.isAuthenticated { refresh(); return }
        // setting the handler again makes iOS retry, so tapping Sign in after a failure works
        let gc = self
        GKLocalPlayer.local.authenticateHandler = { @Sendable viewController, _ in
            Task { @MainActor in
                if let viewController { gc.topViewController()?.present(viewController, animated: true); return }
                gc.refresh()
            }
        }
    }

    private func refresh() {
        let p = GKLocalPlayer.local
        signedIn = p.isAuthenticated
        alias = p.isAuthenticated ? p.alias : ""
        guard p.isAuthenticated else { return }
        flush()
        Task { @MainActor in
            if let img = try? await GKLocalPlayer.local.loadPhoto(for: .normal) { self.photo = img }
        }
    }

    /// scores made offline or before sign-in are sent once Game Center is reachable
    func flush() {
        guard GKLocalPlayer.local.isAuthenticated, let save, !save.pending.isEmpty else { return }
        let queue = save.pending
        Task { @MainActor in
            var sent: [Int] = []
            for (i, p) in queue.enumerated() {
                do { try await GKLeaderboard.submitScore(p.score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [p.id]); sent.append(i) } catch {}
            }
            let done = Set(sent.map { queue[$0].id + "#" + String(queue[$0].score) })
            save.pending.removeAll { done.contains($0.id + "#" + String($0.score)) }
            save.savePending()
        }
    }

    /// Apple's own Game Center screen, opened on this leaderboard (worldwide, all time)
    func showLeaderboard(_ id: String) {
        guard GKLocalPlayer.local.isAuthenticated else { signIn(); return }
        if #available(iOS 18.0, *) {
            GKAccessPoint.shared.trigger(leaderboardID: id, playerScope: .global, timeScope: .allTime) {}
        } else {
            GKAccessPoint.shared.trigger(state: .leaderboards) {}
        }
    }

    private func topViewController() -> UIViewController? {
        let windows = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap { $0.windows }
        var vc = (windows.first { $0.isKeyWindow } ?? windows.first)?.rootViewController
        while let presented = vc?.presentedViewController { vc = presented }
        return vc
    }
}

/// one Game Center leaderboard per mode and difficulty
func leaderboardId(section: Int, infinite: Bool) -> String { "mirrordrop." + (infinite ? "infinite." : "") + DIFF_NAMES[section].lowercased() }
