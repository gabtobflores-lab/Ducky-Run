// Connects the game to everything around it: the SwiftUI screens, saving, sound, haptics and Game Center.
// The game runs every frame inside SpriteKit; SwiftUI only hears about things that change rarely (a new screen, a toast, a banner).

import SwiftUI
import UIKit

enum Screen: Equatable { case menu, play, paused, over }

@MainActor
final class GameStore: ObservableObject {
    let model = GameModel()
    let save = SaveData()
    let gc = GameCenter.shared
    weak var stage: Stage?

    @Published var screen: Screen = .menu
    @Published var showPause = false            // the pause button (hidden during the resume countdown)
    @Published var note: (kind: WxKind, id: Int)? = nil
    @Published var banner: (text: String, level: Int, id: Int)? = nil
    @Published var over = OverInfo()
    @Published var sliderV: Double { didSet { model.sliderV = sliderV; save.slider = sliderV; save.saveSettings() } }
    @Published var per: Int { didSet { if per != model.per { model.per = per; model.reset(); save.per = per; save.saveSettings() } } }
    @Published var mode: GameMode { didSet { model.mode = mode; save.mode = mode.rawValue; save.saveSettings() } }
    @Published var profileOpen = false
    @Published var profileTab = 0
    @Published var profileVersion = 0           // bumps when the profile changes, so the screens refresh

    struct OverInfo { var won = false, score = 0, newBest = false, maxCombo = 1 }

    // geometry: points on screen vs game units
    private var viewSize = CGSize(width: 393, height: 852)
    private var safeTop: CGFloat = 0
    var hudDY: Double = 0
    var previewRect: CGRect = .zero              // where the menu leaves room for the ball preview (points, top-left origin)
    var previewRectScene: CGRect? {
        guard previewRect.width > 0 else { return nil }
        let k = model.W / Double(viewSize.width)
        return CGRect(x: Double(previewRect.minX) * k, y: model.H - Double(previewRect.maxY) * k, width: Double(previewRect.width) * k, height: Double(previewRect.height) * k)
    }
    private var noteSeq = 0, bannerSeq = 0, lastLevel = 0

    init() {
        sliderV = save.slider; per = save.per; mode = save.mode == "infinite" ? .infinite : .normal
        model.per = per; model.mode = mode; model.sliderV = sliderV
        model.bestNow = { [unowned self] in self.save.best(self.model.bestKey) }
        model.reset()
        gc.save = save
    }

    func layout(size: CGSize, safeTop: CGFloat) {
        guard size.width > 0, size.height > 0 else { return }
        viewSize = size; self.safeTop = safeTop
        let aspect = Double(size.height / size.width)
        if abs(aspect - model.aspect) > 0.001 { model.aspect = aspect; if model.state == .menu { model.reset() } }
        hudDY = max(0, Double(safeTop) - 14) * model.W / Double(size.width)   // full screen on a notched iPhone: the top bar drops below the Dynamic Island
    }
    /// game units to points (for SwiftUI elements placed over the game, such as the banner)
    func pt(y: Double) -> CGFloat { CGFloat(y) * viewSize.width / CGFloat(model.W) }

    // MARK: actions from the screens
    func play() { model.startGame(); lastLevel = 0 }
    func pause() { model.pauseGame() }
    func resume() { model.resumeGame() }
    func menu() { model.goMenu() }
    func setPer(_ p: Int) { per = p; model.layout() }

    // MARK: every frame, from the game scene
    func frame(_ scene: GameScene) {
        let m = model
        let sp = m.state == .play && m.resumeT <= 0
        if sp != showPause { showPause = sp }
        if m.level != lastLevel && m.state == .play { lastLevel = m.level; bannerSeq += 1; banner = (m.banner, m.level, bannerSeq) }
        else if m.banner == "FINAL STRETCH" && banner?.text != "FINAL STRETCH" && m.state == .play { bannerSeq += 1; banner = (m.banner, m.level, bannerSeq) }
        stage?.sync(m, skyE: scene.skyE)
    }

    // MARK: what the game asked for this frame
    func handle(_ events: [GameEvent]) {
        for e in events {
            switch e {
            case let .beep(f, d, type, vol, slide, delay): Synth.shared.beep(f, d, type, vol, slide, delay: delay)
            case let .thunder(delay, vol, len): Synth.shared.thunder(delay: delay, vol: vol, len: len)
            case let .haptic(h, delay):
                if delay > 0 { DispatchQueue.main.asyncAfter(deadline: .now() + delay) { Haptics.shared.play(h) } } else { Haptics.shared.play(h) }
            case .wxNote(let k): noteSeq += 1; let id = noteSeq; withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) { note = (k, id) }
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.6) { [weak self] in if self?.note?.id == id { withAnimation(.easeOut(duration: 0.3)) { self?.note = nil } } }
            case .wxHide: if note != nil { withAnimation(.easeOut(duration: 0.25)) { note = nil } }
            case let .runEnded(score, newBest, won):
                let key = model.bestKey
                save.recordRun(score: score, key: key, newBest: newBest, maxCombo: model.fx.maxCombo, leaderboardId: leaderboardId(section: model.section, infinite: model.mode == .infinite))
                gc.flush()
                over = OverInfo(won: won, score: score, newBest: newBest, maxCombo: model.fx.maxCombo)
                profileVersion += 1
            case .showOver: if model.state == .dead { withAnimation(.spring(response: 0.38, dampingFraction: 0.86)) { screen = .over } }
            case .stateChanged:
                let s: Screen
                switch model.state { case .menu: s = .menu; case .play: s = .play; case .paused: s = .paused; case .dead: s = screen == .over ? .over : .play }
                if s != screen { withAnimation(.spring(response: 0.38, dampingFraction: 0.86)) { screen = s } }
            }
        }
    }

    // MARK: app lifecycle
    func wentToBackground() {
        if model.state == .play && model.resumeT <= 0 { model.pauseGame(away: true) }
        if model.state == .play || model.state == .paused { save.bankBest(score: model.score, key: model.bestKey); model.bestBanked = true }
    }
    func cameBack() { Synth.shared.resume() }

    // MARK: profile
    var shownName: String { gc.signedIn ? gc.alias : save.name }
    var bestText: String { let b = save.best(model.bestKey); return b > 0 ? "\(b)" : "–" }
    var settingText: String { "\(DIFF_NAMES[model.section]) · \(model.N) columns" + (mode == .infinite ? " · infinite" : "") }
    func profileChanged() { save.saveProfile(); profileVersion += 1 }
}
