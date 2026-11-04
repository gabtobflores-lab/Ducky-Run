// The stage: three layers stacked behind the SwiftUI menus.
//   1. Apple's aurora, a real video (AVPlayer), shown only during the aurora
//   2. the event's sky, a GPU shader (SpriteKit), shown only during an event
//   3. the game itself (SpriteKit), transparent where its calm backdrop gives way to the sky

import SpriteKit
import Combine
import AVFoundation
import UIKit
import SwiftUI
import simd

// MARK: - the sky

@MainActor
final class SkyScene: SKScene {
    weak var store: GameStore?
    private let sprite = SKSpriteNode()
    private var cloudShader: SKShader!, fogShader: SKShader!
    private var u: [String: SKUniform] = [:]
    private var current: WxKind? = nil

    override init(size: CGSize) {
        super.init(size: size)
        scaleMode = .resizeFill; anchorPoint = .zero; backgroundColor = .clear
        sprite.texture = SKTexture(image: UIGraphicsImageRenderer(size: CGSize(width: 2, height: 2)).image { c in UIColor.white.setFill(); c.fill(CGRect(x: 0, y: 0, width: 2, height: 2)) }); sprite.anchorPoint = .zero
        addChild(sprite)
        let f1 = ["u_t", "u_scl", "u_stars", "u_mw", "u_cloudA", "u_hazeK", "u_shim", "u_rain", "u_mets"]
        let f2 = ["u_res", "u_drift", "u_flare"], f3 = ["u_cTop", "u_cMid", "u_cBot", "u_cd", "u_cl", "u_glowC", "u_hazeC"], f4 = ["u_cov", "u_moon", "u_glow", "u_bolt", "u_sun", "u_band"]
        for n in f1 { u[n] = SKUniform(name: n, float: 0) }
        for n in f2 { u[n] = SKUniform(name: n, vectorFloat2: SIMD2<Float>(0, 0)) }
        for n in f3 { u[n] = SKUniform(name: n, vectorFloat3: SIMD3<Float>(0, 0, 0)) }
        for n in f4 { u[n] = SKUniform(name: n, vectorFloat4: SIMD4<Float>(0, 0, 0, 0)) }
        let moon = SKTexture(imageNamed: "moon")
        u["u_moontex"] = SKUniform(name: "u_moontex", texture: moon)
        cloudShader = SKShader(source: SkyShaders.clouds, uniforms: Array(u.values))
        fogShader = SKShader(source: SkyShaders.fog, uniforms: [u["u_res"]!, u["u_t"]!])
        sprite.shader = cloudShader
    }
    required init?(coder: NSCoder) { fatalError() }

    override func didChangeSize(_ oldSize: CGSize) { sprite.size = size }

    private func f(_ n: String, _ v: Double) { u[n]?.floatValue = Float(v) }
    private func v2(_ n: String, _ a: Double, _ b: Double) { u[n]?.vectorFloat2Value = SIMD2<Float>(Float(a), Float(b)) }
    private func c3(_ n: String, _ r: Double, _ g: Double, _ b: Double) { u[n]?.vectorFloat3Value = SIMD3<Float>(Float(r / 255), Float(g / 255), Float(b / 255)) }
    private func v4(_ n: String, _ a: Double, _ b: Double, _ c: Double, _ d: Double) { u[n]?.vectorFloat4Value = SIMD4<Float>(Float(a), Float(b), Float(c), Float(d)) }

    /// Apple Weather palettes for each event: sky gradient, cloud shadow and light, and where the clouds gather
    func configure(_ m: GameModel) {
        guard let k = m.wxKind else { return }
        f("u_t", m.t.truncatingRemainder(dividingBy: 1000)); v2("u_res", Double(size.width), Double(size.height))
        if k == .fog { if current != .fog { sprite.shader = fogShader; current = .fog }; return }
        if current != k { sprite.shader = cloudShader; current = k }
        // defaults (as the web version sent them)
        for n in ["u_cTop", "u_cMid", "u_cBot", "u_cd", "u_cl", "u_glowC", "u_hazeC"] { c3(n, 0, 0, 0) }
        v4("u_cov", 0, 1, 0, 0.1); v4("u_moon", 0, 0, 1, 0); v4("u_glow", 0, 0, 0, 0); v4("u_bolt", 0, 0, 0, 0)
        v2("u_drift", 0, 0); f("u_scl", 2); f("u_stars", 0); f("u_mw", 0); f("u_cloudA", 0); f("u_hazeK", 0); f("u_shim", 0); f("u_rain", 0)
        v4("u_sun", 0, 0, 0, 0); v2("u_flare", 0, 0); v4("u_band", 0, 1, 0, 0); f("u_mets", 0)
        let W = m.W, H = m.H, uv: (Double, Double) -> (Double, Double) = { x, y in (x / W, y / H) }
        switch k {
        case .storm:
            c3("u_cTop", 44, 52, 70); c3("u_cMid", 64, 76, 96); c3("u_cBot", 88, 100, 120); c3("u_cd", 28, 33, 46); c3("u_cl", 146, 156, 174)
            v4("u_cov", 0.08, 1.02, 1.15, 0.16); f("u_scl", 1.8); v2("u_drift", 0.05, 0); f("u_cloudA", 1); f("u_rain", 1)
        case .hail:
            c3("u_cTop", 84, 100, 128); c3("u_cMid", 104, 120, 148); c3("u_cBot", 128, 144, 170); c3("u_cd", 60, 70, 92); c3("u_cl", 180, 192, 210)
            v4("u_cov", 0.08, 1.02, 1.12, 0.18); f("u_scl", 1.7); v2("u_drift", 0.06, 0); f("u_cloudA", 1)
        case .wind:
            c3("u_cTop", 62, 110, 184); c3("u_cMid", 86, 138, 206); c3("u_cBot", 120, 166, 222); c3("u_cd", 104, 130, 180); c3("u_cl", 255, 255, 255)
            v4("u_cov", -0.04, 0.82, 0.8, 0.08); f("u_scl", 1.05); v2("u_drift", 0.1 * m.windDir, 0); f("u_cloudA", 1)
        case .heat:
            let s = uv(W * 0.78, H * 0.09)
            c3("u_cTop", 40, 92, 170); c3("u_cMid", 70, 130, 204); c3("u_cBot", 108, 156, 214); c3("u_hazeC", 90, 60, 30); f("u_hazeK", 0.22)
            v4("u_cov", 0, 1, 0, 0.1); f("u_shim", 1); c3("u_glowC", 255, 246, 232); v4("u_sun", s.0, s.1, 1, 0)
        case .sun:   // the glare slides in from the edge, peaks, then dissolves
            let q = clamp01(m.wxT / wxInfo(.sun).dur), e = q * q * (3 - 2 * q), env = smooth(clamp01(q / 0.3)) * smooth(clamp01((1 - q) / 0.35))
            let g = uv(W * (-0.08 + e * 1.16), H * (0.16 + 0.05 * sin(q * .pi)))
            c3("u_cTop", 46, 92, 166); c3("u_cMid", 74, 124, 194); c3("u_cBot", 112, 156, 214); v4("u_cov", 0, 1, 0, 0.1); c3("u_glowC", 255, 250, 238)
            v4("u_sun", g.0, g.1, env, 0); v2("u_flare", q, env)
        case .meteor:
            let mm = uv(W * 0.27, H * 0.26)
            c3("u_cTop", 12, 10, 38); c3("u_cMid", 62, 42, 112); c3("u_cBot", 172, 110, 164); c3("u_cd", 50, 34, 94); c3("u_cl", 214, 170, 226)
            v4("u_cov", 0.05, 1.05, 0.42, 0.16); v4("u_band", mm.1 + 0.05, 0.045, 0.16, 0); f("u_mets", 0.8); f("u_scl", 1.8); v2("u_drift", 0.03, 0); f("u_cloudA", 0.85)
            f("u_stars", 1); f("u_mw", 1); v4("u_moon", mm.0, mm.1, W * 0.1 / H, 1); c3("u_glowC", 150, 120, 210)
        default: break
        }
    }
}

// MARK: - the stage view

@MainActor
final class Stage: UIView {
    let gameView = SKView(), skyView = SKView(), playerView = UIView()
    private var player: AVQueuePlayer?, looper: AVPlayerLooper?, playerLayer = AVPlayerLayer()
    private(set) var game: GameScene?
    private var sky: SkyScene?
    private var playing = false

    func setup(store: GameStore) {
        backgroundColor = UIColor(red: 0xf6 / 255, green: 0xf1 / 255, blue: 0xea / 255, alpha: 1)
        for v in [playerView, skyView, gameView] as [UIView] { v.isOpaque = false; v.backgroundColor = .clear; addSubview(v) }
        playerView.layer.addSublayer(playerLayer); playerLayer.videoGravity = .resizeAspectFill; playerView.isHidden = true
        if let url = Bundle.main.url(forResource: "aurora", withExtension: "mp4") {
            let q = AVQueuePlayer(); q.isMuted = true; q.preventsDisplaySleepDuringVideoPlayback = false
            looper = AVPlayerLooper(player: q, templateItem: AVPlayerItem(url: url)); player = q; playerLayer.player = q
        }
        skyView.allowsTransparency = true; skyView.preferredFramesPerSecond = 120; skyView.isHidden = true; skyView.isPaused = true; skyView.isUserInteractionEnabled = false
        skyView.contentScaleFactor = 1   // the sky is soft by nature: one pixel per point looks identical and costs a ninth
        gameView.allowsTransparency = true; gameView.preferredFramesPerSecond = 120; gameView.ignoresSiblingOrder = false
        let s = GameScene(model: store.model); s.store = store; game = s
        let sk = SkyScene(size: bounds.size); sk.store = store; sky = sk
        skyView.presentScene(sk); gameView.presentScene(s)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        for v in [playerView, skyView, gameView] as [UIView] { v.frame = bounds }
        playerLayer.frame = playerView.bounds
        skyView.contentScaleFactor = 1
    }

    /// called every game frame: show only the layers this moment needs
    func sync(_ m: GameModel, skyE: Double) {
        let aurora = m.wxKind == .aurora && skyE > 0
        let skyOn = !aurora && m.wxKind != nil && skyE > 0
        if skyOn { sky?.configure(m) }
        if skyView.isHidden == skyOn { skyView.isHidden = !skyOn; skyView.isPaused = !skyOn }
        if playerView.isHidden == aurora { playerView.isHidden = !aurora }
        if aurora != playing { playing = aurora; if aurora { player?.play() } else { player?.pause() } }
    }
}

struct StageView: UIViewRepresentable {
    let store: GameStore
    func makeUIView(context: Context) -> Stage { let s = Stage(); s.setup(store: store); store.stage = s; return s }
    func updateUIView(_ uiView: Stage, context: Context) {}
}
