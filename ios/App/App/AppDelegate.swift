import UIKit
import Capacitor
import GameKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// MARK: - Game Center


/// Hosts the game and registers the app's own native plugins.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(GameCenterPlugin())
    }
}

/// A small bridge to Apple's Game Center: sign-in, the player's name and photo, scores and leaderboards.
/// The game calls it from JavaScript as Capacitor.registerPlugin('GameCenter').
@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "player", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "photo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboard", returnType: CAPPluginReturnPromise),
    ]

    private var signInCalls: [CAPPluginCall] = []
    private var handlerSet = false

    private func playerInfo() -> [String: Any] {
        let p = GKLocalPlayer.local
        guard p.isAuthenticated else { return ["authenticated": false] }
        return ["authenticated": true, "alias": p.alias, "displayName": p.displayName, "playerId": p.gamePlayerID, "underage": p.isUnderage]
    }

    /// Signs in with the Apple ID's Game Center account. iOS shows its own sign-in sheet only if the player has never signed in.
    @objc func signIn(_ call: CAPPluginCall) {
        if GKLocalPlayer.local.isAuthenticated { call.resolve(playerInfo()); return }
        signInCalls.append(call)
        guard !handlerSet else { return }
        handlerSet = true
        GKLocalPlayer.local.authenticateHandler = { [weak self] vc, error in
            guard let self = self else { return }
            DispatchQueue.main.async {
                if let vc = vc {
                    self.bridge?.viewController?.present(vc, animated: true)
                    return
                }
                var info = self.playerInfo()
                if let error = error { info["error"] = error.localizedDescription }
                let calls = self.signInCalls
                self.signInCalls.removeAll()
                calls.forEach { $0.resolve(info) }
                self.notifyListeners("playerChanged", data: info)
            }
        }
    }

    @objc func player(_ call: CAPPluginCall) { call.resolve(playerInfo()) }

    /// The player's Game Center picture as a small JPEG data URL.
    @objc func photo(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else { call.resolve([:]); return }
        GKLocalPlayer.local.loadPhoto(for: .normal) { image, _ in
            guard let image = image, let data = image.jpegData(compressionQuality: 0.85) else { call.resolve([:]); return }
            call.resolve(["dataUrl": "data:image/jpeg;base64," + data.base64EncodedString()])
        }
    }

    /// Posts a score. Game Center keeps it and sends it once the phone is back online.
    @objc func submitScore(_ call: CAPPluginCall) {
        guard let id = call.getString("leaderboardId"), let score = call.getInt("score") else { call.reject("leaderboardId and score are required"); return }
        guard GKLocalPlayer.local.isAuthenticated else { call.reject("not signed in"); return }
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [id]) { error in
            if let error = error { call.reject(error.localizedDescription) } else { call.resolve() }
        }
    }

    /// Opens Apple's leaderboard screen for one leaderboard (worldwide, all time).
    @objc func showLeaderboard(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard GKLocalPlayer.local.isAuthenticated else { call.reject("not signed in"); return }
            let vc: GKGameCenterViewController
            if let id = call.getString("leaderboardId") {
                vc = GKGameCenterViewController(leaderboardID: id, playerScope: .global, timeScope: .allTime)
            } else {
                vc = GKGameCenterViewController(state: .leaderboards)
            }
            vc.gameCenterDelegate = self
            self.bridge?.viewController?.present(vc, animated: true)
            call.resolve()
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
