// Mirror Drop: the rules of the game, in plain Swift (no UIKit, no SpriteKit), so they can be tested anywhere.
// Two mirrored balls, one tap. Squeeze together or spread apart. Dodge the blocks, catch the gems.
// Every 10 seconds the world speeds up, by less each time.
// This is a faithful port of the original web game: same numbers, same timings, same fairness rules.

import Foundation
import Combine

// MARK: - Small helpers

@inline(__always) func clamp01(_ x: Double) -> Double { min(1, max(0, x)) }
@inline(__always) func smooth(_ x: Double) -> Double { let c = clamp01(x); return c * c * (3 - 2 * c) }
@inline(__always) func easeOut(_ x: Double) -> Double { 1 - pow(1 - clamp01(x), 3) }
@inline(__always) func rnd(_ a: Double, _ b: Double) -> Double { a + Double.random(in: 0..<1) * (b - a) }
@inline(__always) func rnd() -> Double { Double.random(in: 0..<1) }
/// smooth pseudo-noise from incommensurate sines: drifting, uneven variation instead of perfect repetition
@inline(__always) func nz(_ x: Double, _ s: Double = 0) -> Double { (sin(x * 1.13 + s) + sin(x * 2.37 + s * 1.7) * 0.55 + sin(x * 4.71 + s * 2.9) * 0.25) / 1.8 }
@inline(__always) func hash1(_ n: Double) -> Double { let v = sin(n * 127.1 + 311.7) * 43758.5453; return v - floor(v) }

struct Pt { var x: Double; var y: Double }

struct Seed { let x: Double, y: Double, s: Double, k: Double }
let SEEDS: [Seed] = (0..<24).map { _ in Seed(x: rnd(), y: rnd(), s: rnd() * 99, k: 0.6 + rnd() * 0.8) }

// MARK: - Settings

enum GameState { case menu, play, paused, dead }
enum GameMode: String { case normal, infinite }

let DIFF_NAMES = ["Chill", "Easy", "Normal", "Hard", "Insane", "Impossible"]
let SECT_DIFF: [Double] = [0, 0.25, 0.5, 0.75, 1, 1.2]
let GOAL = 1000          // Normal mode ends the run at 1000 points
let LEVEL_TIME = 10.0    // seconds between speed-ups
let SPRING = 36.0

struct Params { let start, step, max, gap, shrink, minTime, flip: Double }

// MARK: - Things on the track

final class Thing {
    enum Kind { case block, gem }
    let kind: Kind
    var l: Int                 // lane (column)
    var y: Double
    let row: Int
    var ph: Double = 0         // gem shimmer phase
    var got = false            // gem collected (or passed)
    var nm = false             // near miss already checked
    var hitAt: Double? = nil   // the block that took the hit
    // lightning: a struck block is charged and slides to the mirror column and back
    var zap = false, elec = false, et = 0.0, l0 = 0, ex: Double? = nil, sw = 2, ts = 1.0
    init(kind: Kind, l: Int, y: Double, row: Int) { self.kind = kind; self.l = l; self.y = y; self.row = row }
}

struct Particle { var x, y, vx, vy, life, max: Double; var col: UInt32; var r, g: Double }
struct Floater { var x, y: Double; var txt: String; var col: UInt32; var life: Double }

struct Shard {
    enum Kind { case shard, drop, zap }
    var kind: Kind
    var a = 0.0, v = 0.0, spin = 0.0, life = 0.0, max = 0.0, sz = 0.0, tint = 0.0
    var verts: [Pt] = []
    var white = false
    var x = 0.0, y = 0.0, vx = 0.0, vy = 0.0, rot = 0.0
    var i = 0, m = 1.0, el = false
}
struct Wave { var x, y, t: Double; var i: Int; var el: Bool }
struct BallCrash { var at: Double; var burst: Bool; var elec: Bool; var chain = false; var bt = 0.0 }

struct Gate { var y: Double; var t: Double }

// MARK: - Weather

enum WxKind: String, CaseIterable { case fog, storm, hail, wind, heat, sun, aurora, meteor }
struct WxInfo { let dur, p, warn: Double; let title, sub: String }
let WX: [(WxKind, WxInfo)] = [
    (.fog, WxInfo(dur: 14, p: 1 / 55, warn: 2.2, title: "Fog rolling in", sub: "Visibility will drop")),
    (.storm, WxInfo(dur: 18, p: 1 / 140, warn: 2.2, title: "Storm incoming", sub: "Lightning can charge blocks")),
    (.hail, WxInfo(dur: 12, p: 1 / 90, warn: 1.6, title: "Hail incoming", sub: "Short and heavy")),
    (.wind, WxInfo(dur: 5.5, p: 1 / 110, warn: 2.2, title: "Wind gust", sub: "Both balls will drift")),
    (.heat, WxInfo(dur: 12, p: 1 / 140, warn: 0.8, title: "Heat wave", sub: "The air will shimmer")),
    (.sun, WxInfo(dur: 3.8, p: 1 / 200, warn: 0.5, title: "Sun flash", sub: "Brief glare")),
    (.aurora, WxInfo(dur: 17, p: 1 / 220, warn: 0.8, title: "Aurora", sub: "Northern lights overhead")),
    (.meteor, WxInfo(dur: 16, p: 1 / 150, warn: 1.2, title: "Meteor shower", sub: "Look up")),
]
func wxInfo(_ k: WxKind) -> WxInfo { WX.first { $0.0 == k }!.1 }

enum WxPhase { case none, warn, on, out }

struct Stroke { var t: Double; var k: Double }
struct Fork { var i0: Int; var pts: [Pt] }
final class Bolt {
    var pts: [Pt]
    var o: Thing?            // the block it charges, if any
    var br: [Fork] = []
    var t = 0.0, pre = 0.0, lead = 0.0, dur = 0.0
    var st: [Stroke] = []
    init(pts: [Pt], o: Thing?) { self.pts = pts; self.o = o }
}
/// lightning inside the cloud: a crawler racing sideways (pts) or a hidden glow (x, y, r)
struct Glow { var pts: [Pt]?; var br: [Fork] = []; var x = 0.0, y = 0.0, r = 1.0; var t = 0.0, lead = 0.0, dur = 0.0; var st: [Stroke] = [] }

// MARK: - What the renderer and the app should do (sounds, haptics, screens)

enum Wave3 { case sine, triangle, sawtooth, square }
enum Haptic { case light, medium, heavy, soft, rigid, selection, success, warning, error }
enum GameEvent {
    case beep(f: Double, d: Double, type: Wave3, vol: Double, slide: Double, delay: Double)
    case thunder(delay: Double, vol: Double, len: Double)
    case haptic(Haptic, delay: Double)
    case wxNote(WxKind)
    case wxHide
    case showOver
    case runEnded(score: Int, newBest: Bool, won: Bool)
    case stateChanged
}

// MARK: - The game

final class GameModel {
    // settings (the app sets these from the menu)
    var per = 3 { didSet { layout() } }
    var mode: GameMode = .normal
    var sliderV = 50.0
    var section: Int { min(5, Int(floor(sliderV / 20))) }
    var diff: Double { SECT_DIFF[section] }
    var bestNow: () -> Int = { 0 }   // the saved best for the current setting

    // geometry, in game units: the field is W wide and H tall, the balls ride at BY
    private(set) var W = 520.0, N = 6, LX: [Double] = []
    private(set) var H = 800.0, BY = 550.0
    var aspect = 852.0 / 393.0 { didSet { layout() } }   // screen height / width
    var bw: Double { min(70, W / Double(N) * 0.82) }

    // state
    private(set) var state: GameState = .menu
    private(set) var t = 0.0
    var shake = 0.0
    private var demoT = 0.0
    private(set) var fog = 0, resumeT = 0.0, fogT = 0.0
    private(set) var bv = [0.0, 0.0], trail: [[Double]] = [[], []]
    var bestBanked = false
    private(set) var pos = 2, dirv = -1, bx = [0.0, 0.0]
    private(set) var things: [Thing] = []
    private(set) var parts: [Particle] = []
    private(set) var floaters: [Floater] = []
    private(set) var score = 0, combo = 1, speed = 230.0, nextY = -160.0, pulse = 0.0, level = 0, levelT = 0.0, fxA = 0.0
    private(set) var banner = "", newBest = false, won = false, gate: Gate? = nil
    private(set) var flashA = 0.0, flashLane = 0
    private var lastSafe = 2, rowId = 0, scored = Set<Int>(), genDir = -1
    private var freePause = false
    private(set) var overDue: Double? = nil   // seconds until the result screen appears

    // visual-only feedback timers (they never affect the rules)
    struct FX { var gem = 0.0, combo = 0.0, score = 0.0, arrow = 0.0, squash = 0.0, near = 0.0, nearCool = 0.0, freeze = 0.0, dead = 0.0, edgePending = false, lastMove = -9.0, maxCombo = 1 }
    private(set) var fx = FX()
    // the crash: the glass core shatters
    private(set) var crashBall: [BallCrash?] = [nil, nil], shards: [Shard] = [], waves: [Wave] = [], crashFirst = 0
    private var crashTmpl: [Shard]? = nil

    // weather
    private(set) var wxKind: WxKind? = nil
    private(set) var wxPhase: WxPhase = .none
    private(set) var wxT = 0.0, wxP = 0.0, wxA = 0.0, wxFlash = 0.0
    private var wxCool = 14.0, wxRoll = 0.0, nextBolt = 0.0, nextGlow = 0.0, hits = 0
    private(set) var bolt: Bolt? = nil
    private(set) var glows: [Glow] = []
    private(set) var windDir = 1.0

    private(set) var events: [GameEvent] = []
    func takeEvents() -> [GameEvent] { let e = events; events.removeAll(keepingCapacity: true); return e }
    private func emit(_ e: GameEvent) { events.append(e) }
    private func beep(_ f: Double, _ d: Double = 0.1, _ type: Wave3 = .sine, _ vol: Double = 0.07, _ slide: Double = 0, delay: Double = 0) { emit(.beep(f: f, d: d, type: type, vol: vol, slide: slide, delay: delay)) }
    private func haptic(_ h: Haptic, delay: Double = 0) { emit(.haptic(h, delay: delay)) }

    init() { layout(); reset() }

    func layout() {
        W = per == 2 ? 480 : 520; N = per * 2
        LX = (0..<N).map { (Double($0) + 0.5) * W / Double(N) }
        H = max(800, W * aspect); BY = H - 250   // keep the balls above where a thumb rests
    }

    // MARK: difficulty
    func params() -> Params { let d = diff; return Params(start: 270 + 230 * d, step: 18 + 36 * d, max: 600 + 380 * d, gap: 280 - 70 * d, shrink: 4 + 12 * d, minTime: 0.46 - 0.20 * d, flip: 0.5 + 0.4 * d) }
    /// speed-ups shrink as you get faster: the first jumps are big, later ones smaller, approaching the top speed
    func targetSpeed(_ n: Int) -> Double { let p = params(); let k = 1 - min(0.55, 2.4 * (2 + 0.8 * diff) * p.step / (p.max - p.start)); return p.start + (p.max - p.start) * (1 - pow(k, Double(n))) }
    func rowGap() -> Double { let p = params(); return max(p.gap - Double(level) * p.shrink, speed * p.minTime) }
    var bestKey: String { "\(per)_\(section)" + (mode == .infinite ? "_inf" : "") }
    func bxOf(_ o: Thing) -> Double { o.ex ?? LX[o.l] }   // electrified blocks slide, so collisions use where they are drawn

    // MARK: lifecycle
    func reset() {
        let p = params()
        pos = per - 1; dirv = -1; bx = [LX[pos], LX[N - 1 - pos]]; bv = [0, 0]; trail = [[], []]; scored = []; things = []; parts = []; floaters = []
        fog = 0; resumeT = 0; fogT = 0
        bestBanked = false; score = 0; combo = 1; speed = state == .menu ? 230 : p.start; nextY = -160; pulse = 0; lastSafe = per - 1; genDir = -1; level = 0; levelT = 0; fxA = 0; banner = ""; newBest = false; won = false; gate = nil
        crashBall = [nil, nil]; shards = []; waves = []; overDue = nil
        wxKind = nil; wxPhase = .none; wxT = 0; wxP = 0; hits = 0; wxCool = 14; wxRoll = 0; wxA = 0; wxFlash = 0; nextBolt = 0; bolt = nil; glows = []; nextGlow = 0
        fx = FX()
        while nextY > -1000 { addRow() }
    }

    /// taps needed to reach `target` from position p heading in direction d (balls bounce at the edges)
    private func tapsTo(_ p0: Int, _ d0: Int, _ target: Int) -> (Int, Int, Int) {
        var p = p0, d = d0, n = 0
        while p != target && n < 6 { if p + d > per - 1 || p + d < 0 { d = -d }; p += d; n += 1 }
        return (n, p, d)
    }
    /// the generator follows the tap path a player would take, prefers rows that need one tap, and gives extra room when a row needs two or three
    private func addRow() {
        var sp = lastSafe
        if rnd() < params().flip {
            let opts = (0..<per).filter { $0 != lastSafe }.map { ($0, tapsTo(lastSafe, genDir, $0).0) }
            let w = opts.map { $0.1 == 1 ? 1.0 : $0.1 == 2 ? 0.15 + 0.25 * diff : 0.05 + 0.1 * diff }
            var r = rnd() * w.reduce(0, +), i = 0
            while i < w.count - 1 && r > w[i] { r -= w[i]; i += 1 }
            sp = opts[i].0
        }
        let (taps, _, nd) = tapsTo(lastSafe, genDir, sp); genDir = nd; lastSafe = sp; let row = rowId; rowId += 1
        for q in 0..<per where q != sp {
            let lanes = rnd() < 0.3 ? [q, N - 1 - q] : [rnd() < 0.5 ? q : N - 1 - q]
            for l in lanes { things.append(Thing(kind: .block, l: l, y: nextY, row: row)) }
        }
        if rnd() < 0.55 { let g = Thing(kind: .gem, l: rnd() < 0.5 ? sp : N - 1 - sp, y: nextY - rnd(0, 40), row: row); g.ph = rnd(0, 6); things.append(g) }
        nextY -= rowGap() * (per == 3 ? 1.12 : 1) * (1 + 0.6 * Double(max(0, taps - 1)))
    }

    private func burst(_ x: Double, _ y: Double, _ n: Int, _ col: UInt32, _ sp: Double = 220, _ life: Double = 0.6, _ g: Double = 500, _ size: Double = 1) {
        for _ in 0..<n { let a = rnd(0, 6.283), v = rnd(sp * 0.2, sp); parts.append(Particle(x: x, y: y, vx: cos(a) * v, vy: sin(a) * v, life: rnd(life * 0.5, life), max: life, col: col, r: rnd(1.5, 3.5) * size, g: g)) }
    }
    private func float(_ x: Double, _ y: Double, _ txt: String, _ col: UInt32) { floaters.append(Floater(x: x, y: y, txt: txt, col: col, life: 1)) }

    func startGame() { state = .play; reset(); beep(520, 0.15, .triangle, 0.06, 300); haptic(.medium); emit(.stateChanged) }
    func goMenu() { emit(.wxHide); state = .menu; reset(); emit(.stateChanged) }
    func pauseGame(away: Bool = false) {
        guard state == .play, resumeT <= 0 else { return }
        freePause = away; emit(.wxHide); state = .paused; emit(.stateChanged)
    }
    var pauseNote: String { freePause ? "Paused while you were away. No fog this time." : fog > 0 ? "Fog level \(fog). Resuming brings thicker fog for 5 seconds." : "Careful: resuming brings in fog for 5 seconds." }
    func resumeGame() {
        guard state == .paused else { return }
        if !freePause { fog += 1; fogT = 5 }   // fog lingers 5 s after the countdown, thicker with every pause
        resumeT = 3; state = .play; beep(300, 0.3, .sine, 0.06, -100); emit(.stateChanged)
    }

    // MARK: input: tap anywhere, the balls step one column; at the edge they turn around
    func tap() { if pos + dirv > per - 1 || pos + dirv < 0 { dirv = -dirv }; setPos(pos + dirv) }
    private func setPos(_ np0: Int) {
        guard state == .play, resumeT <= 0 else { return }
        let np = max(0, min(per - 1, np0)); flashA = 1; flashLane = np
        if np == pos { beep(300, 0.04, .triangle, 0.03); haptic(.rigid) }
        else {
            let d = np - pos; pos = np; pulse = 1; beep(380 + Double(pos) * 90, 0.08, .triangle, 0.05, Double(d) * 80); haptic(.light)
            fx.arrow = 1; fx.lastMove = t; fx.edgePending = np == 0 || np == per - 1
        }
    }
    /// which way the next tap will go (for the little arrows)
    var nextDir: Int { (pos + dirv > per - 1 || pos + dirv < 0) ? -dirv : dirv }

    // MARK: endings
    private func finish() {   // Normal mode: the balls cross the finish line; light washes up the screen and the world eases to a stop
        state = .dead; won = true; shake = 0; fx.freeze = 0; fx.dead = 0; crashBall = [nil, nil]; shards = []; waves = []; crashTmpl = nil; emit(.wxHide)
        for (i, f) in [523.0, 659, 784, 1047].enumerated() { beep(f, 0.5, .sine, 0.06, 0, delay: Double(i) * 0.09) }
        haptic(.success)
        for i in 0..<2 { burst(bx[i], BY, 14, 0xf5b93a, 300, 1.9, 160, 1.6); burst(bx[i], BY, 10, i == 1 ? 0x2ec4d6 : 0xff6b81, 260, 1.9, 160, 1.5); burst(bx[i], BY, 6, 0xffffff, 200, 1.2, 100, 0.9) }
        burst(W / 2, BY, 22, 0xf5b93a, 460, 2, 220, 1.5); burst(W / 2, BY, 10, 0xffffff, 380, 1.6, 200, 0.9)
        endRun(); overDue = 1.9; emit(.stateChanged)
    }
    private func endRun() {
        let best = bestNow()
        if score > best || (bestBanked && score >= best) { newBest = true }
        emit(.runEnded(score: score, newBest: newBest, won: won))
    }
    private func die(_ bi: Int, _ blk: Thing?) {
        state = .dead; shake = 0; fx.freeze = 0.03; fx.dead = 0   // tiny hit-stop; the shatter itself starts on the impact frame
        crashBall = [nil, nil]; shards = []; waves = []; crashTmpl = nil
        crashBall[bi] = BallCrash(at: 0, burst: false, elec: blk?.elec ?? false); blk?.hitAt = 0; emit(.wxHide); crashFirst = bi
        // the twin ball: if it is meeting its own block at (nearly) the same moment, both shatter together as a mirror pair
        let j = 1 - bi
        for o in things where o.kind == .block && o !== blk && abs(o.y - BY) < 52 && abs(bx[j] - bxOf(o)) < 38 { crashBall[j] = BallCrash(at: 0, burst: false, elec: o.elec); o.hitAt = 0; break }
        if crashBall[j] == nil { let e = crashBall[bi]!.elec; crashBall[j] = BallCrash(at: (e ? 0.12 : 0) + 0.11, burst: false, elec: e, chain: true) }   // linked twin: shatters a beat later
        for k in 0..<2 {
            guard var c = crashBall[k], !c.chain else { continue }
            if c.elec { c.at = 0.12 } else { c.burst = true; c.bt = 0; shatter(k, bx[k], BY) }   // normal: burst instantly; electrified: a short electrocution flash first
            crashBall[k] = c
        }
        beep(190, 0.45, .sawtooth, 0.1, -140); haptic(.error)
        endRun(); overDue = 0.75; emit(.stateChanged)
    }
    private func crashTemplate() -> [Shard] {   // one fragment pattern per crash, built for the left ball and mirrored for the right
        var out: [Shard] = []
        for i in 0..<14 {   // larger curved glass shards
            let a = i < 10 ? rnd(-0.25, .pi + 0.25) : rnd(.pi + 0.3, .pi * 2 - 0.3), sz = rnd(7, 14)
            let n = rnd() < 0.5 ? 3 : 4
            let verts = (0..<n).map { k -> Pt in let va = Double(k) / Double(n) * 6.283 + rnd(-0.4, 0.4), vr = sz * rnd(0.55, 1); return Pt(x: cos(va) * vr, y: sin(va) * vr) }
            var s = Shard(kind: .shard); s.a = a; s.v = rnd(170, 430); s.spin = rnd(-11, 11); s.life = rnd(0.5, 0.8); s.verts = verts; s.sz = sz; s.tint = rnd(); out.append(s)
        }
        for _ in 0..<26 { var s = Shard(kind: .drop); s.a = rnd(0, 6.283); s.v = rnd(140, 560); s.life = rnd(0.3, 0.6); s.sz = rnd(1.4, 3.4); s.white = rnd() < 0.3; out.append(s) }   // small liquid droplets
        return out
    }
    private func shatter(_ i: Int, _ x: Double, _ y: Double, _ el: Bool = false) {
        if crashTmpl == nil { crashTmpl = crashTemplate() }
        let m: Double = i == 0 ? 1 : -1
        for f in crashTmpl! {
            var s = f
            let vx = cos(f.a) * f.v * m * (el ? 1.15 : 1), vy = sin(f.a) * f.v * (el ? 1.15 : 1)
            s.x = x + vx * 0.018; s.y = y + vy * 0.018; s.vx = vx; s.vy = vy; s.rot = 0; s.spin = f.spin * m; s.max = f.life; s.i = i; s.m = m; s.el = el; s.white = f.white || (el && rnd() < 0.35)
            shards.append(s)
        }
        if el { for _ in 0..<10 { let a = rnd() * 6.283, v = 220 + rnd() * 380; var s = Shard(kind: .zap); s.x = x; s.y = y; s.vx = cos(a) * v; s.vy = sin(a) * v; s.life = 0.28; s.max = 0.28; s.i = i; s.m = m; s.el = el; s.sz = 6 + rnd() * 6; s.a = a; shards.append(s) } }
        waves.append(Wave(x: x, y: y - 12, t: 0, i: i, el: el))
        shake = max(shake, el ? 4.5 : 3.5)
        beep(el ? 1300 : i == 1 ? 980 : 880, 0.18, el ? .square : .triangle, 0.05, -800); haptic(.heavy)
    }
    private func updateCrash(_ dt: Double) {
        for i in shards.indices {
            shards[i].x += shards[i].vx * dt; shards[i].y += shards[i].vy * dt; shards[i].vy += (shards[i].kind == .shard ? 620 : 480) * dt
            let d = 1 - 1.6 * dt; shards[i].vx *= d; shards[i].vy *= d; shards[i].rot += shards[i].spin * dt; shards[i].life -= dt
        }
        shards.removeAll { $0.life <= 0 }
        for i in waves.indices { waves[i].t += dt }
        waves.removeAll { $0.t >= 0.5 }
    }

    // MARK: - update
    func update(_ dt: Double) {
        if let od = overDue { let n = od - dt; overDue = n > 0 ? n : nil; if n <= 0 { emit(.showOver) } }
        if state == .paused { return }
        if state == .play && resumeT <= 0 { fogT = max(0, fogT - dt) }
        if state == .play && resumeT > 0 { let before = ceil(resumeT); resumeT -= dt; if ceil(resumeT) != before && resumeT > 0 { beep(440, 0.1, .triangle, 0.05) }; return }
        if state == .dead && fx.freeze > 0 { fx.freeze -= dt; updateCrash(dt); return }   // hit-stop: hold the impact frame
        t += dt; flashA = max(0, flashA - dt * 3.5); shake = max(0, shake - dt * 30); pulse = max(0, pulse - dt * 4); fxA = max(0, fxA - dt / 1.2)
        fx.gem = max(0, fx.gem - dt * 3); fx.near = max(0, fx.near - dt * 3)
        fx.combo = max(0, fx.combo - dt * 4.5); fx.score = max(0, fx.score - dt * 4.5); fx.arrow = max(0, fx.arrow - dt * 4.5); fx.squash = max(0, fx.squash - dt * 4.5)
        fx.nearCool = max(0, fx.nearCool - dt)
        for i in parts.indices { parts[i].x += parts[i].vx * dt; parts[i].y += parts[i].vy * dt; parts[i].vy += parts[i].g * dt; parts[i].life -= dt }
        parts.removeAll { $0.life <= 0 }
        for i in floaters.indices { floaters[i].y -= 50 * dt; floaters[i].life -= dt * 1.1 }
        floaters.removeAll { $0.life <= 0 }
        updateCrash(dt)
        if state == .dead {
            fx.dead += dt
            let drift = won ? pow(max(0, 1 - fx.dead / 1.6), 2) : max(0, 1 - fx.dead / 0.35)   // the world glides to a stop instead of carrying on
            let mv = speed * dt * (won ? 1 : 0.3) * drift; for o in things { o.y += mv }; if gate != nil { gate!.y += mv }
            for j in 0..<2 { if var c = crashBall[j], !c.burst, fx.dead >= c.at { c.burst = true; c.bt = fx.dead; crashBall[j] = c; shatter(j, bx[j], BY, c.elec) } }
            return
        }
        let wo = windOffset(), tx = [LX[pos] + wo, LX[N - 1 - pos] + wo]
        for i in 0..<2 {   // critically damped spring, integrated in small steps so every frame shows real in-between motion
            let ox = bx[i]; var h = dt
            while h > 0 { let s = min(0.004, h); bv[i] += (SPRING * SPRING * (tx[i] - bx[i]) - 2 * SPRING * bv[i]) * s; bx[i] += bv[i] * s; h -= 0.004 }
            if abs(tx[i] - bx[i]) < 0.3 && abs(bv[i]) < 6 { bx[i] = tx[i]; bv[i] = 0 }
            if abs(bv[i]) > 60 { trail[i].append(ox) } else if !trail[i].isEmpty { trail[i].removeFirst() }   // faint trail while sliding between columns
            if trail[i].count > 5 { trail[i].removeFirst() }
        }
        if fx.edgePending && abs(tx[0] - bx[0]) < 4 { fx.edgePending = false; fx.squash = 1 }   // tiny squash on arriving at the edge

        if state == .menu {   // decorative demo behind the menu: no collisions
            demoT += dt; if demoT > 1.2 { demoT = 0; if pos + dirv > per - 1 || pos + dirv < 0 { dirv = -dirv }; pos += dirv }
            for o in things { o.y += speed * dt }; nextY += speed * dt; things.removeAll { $0.y >= H + 80 }
            while nextY > -300 { addRow() }
            return
        }

        // predictable speed-ups every 10 seconds, eased in over ~1 s, tapering toward the difficulty's top speed
        let p = params()
        levelT += dt
        if levelT >= LEVEL_TIME && gate == nil {   // no speed-ups during the final stretch
            levelT -= LEVEL_TIME; level += 1; fxA = 1; let capped = p.max - targetSpeed(level) < 8
            banner = capped ? "MAX SPEED" : "SPEED UP!"; beep(380 + Double(min(level, 12)) * 35, 0.4, .triangle, 0.08, 280); haptic(.medium)
        }
        speed += (targetSpeed(level) - speed) * min(1, dt * 2.5)
        updateWeather(dt)

        let lane = W / Double(N)
        for o in things {
            o.y += speed * dt
            if o.kind == .block && o.y > BY + 40 && !scored.contains(o.row) {
                scored.insert(o.row)
                if !(mode == .normal && score >= GOAL) { score += 1; if score % 10 == 0 { float(W / 2, 300, "\(score)!", 0xe9a23b); beep(760, 0.2, .triangle, 0.07, 300) } }
            }
            let x = bxOf(o)
            if o.kind == .block && !o.nm && o.y > BY {   // near miss (visual only): a block slides past right beside a ball that just dodged
                o.nm = true
                if t - fx.lastMove < 0.32 && fx.nearCool <= 0 { for i in 0..<2 where abs(bx[i] - x) > lane * 0.55 && abs(bx[i] - x) < lane * 1.25 { fx.near = 1; fx.nearCool = 0.9; burst(bx[i], BY, 4, i == 1 ? 0x2ec4d6 : 0xff6b81, 120, 0.35, 0, 0.8) } }
            }
            if abs(o.y - BY) < 44 {
                for bi in 0..<2 where abs(bx[bi] - x) < (o.kind == .block ? 30 : 34) {
                    if o.kind == .block { die(bi, o); return }
                    if !o.got {
                        o.got = true; score = mode == .normal ? min(GOAL, score + combo) : score + combo; combo = min(8, combo + 1); beep(700 + Double(combo) * 70, 0.12, .triangle, 0.07, 400); haptic(.soft)
                        fx.gem = 1; fx.combo = 1; fx.maxCombo = max(fx.maxCombo, combo)
                        burst(x, o.y, 7, 0xffc867, 160, 0.4, 60, 0.9); burst(x, o.y, 3, 0xffffff, 120, 0.3, 0, 0.8); float(x, o.y - 24, "+\(combo - 1 == 0 ? 1 : combo - 1)", 0xe9a23b)
                    }
                }
            }
            if o.kind == .gem && !o.got && o.y > BY + 70 { o.got = true; combo = 1 }
        }
        things.removeAll { $0.y >= H + 80 || ($0.got && $0.kind == .gem) }
        if mode == .normal && gate == nil && score >= GOAL { gate = Gate(y: min(nextY + 40, -80), t: 0); banner = "FINAL STRETCH"; fxA = 1; beep(520, 0.5, .sine, 0.06, 260); haptic(.medium) }   // no new rows: the finish line comes down behind the last one
        if gate != nil { gate!.y += speed * dt; gate!.t += dt; if gate!.y >= BY { finish(); return } }
        nextY += speed * dt
        if gate == nil { while nextY > -300 { addRow() } }
    }

    // MARK: - weather
    func windOffset() -> Double {   // a soft sideways nudge that rises and falls smoothly during the gust
        guard wxKind == .wind, wxPhase == .on else { return 0 }
        let q = clamp01(wxT / wxInfo(.wind).dur); return windDir * 22 * sin(q * .pi) * min(1, wxA * 1.2)
    }
    var cloudH: Double { H * 0.26 }
    /// start an event right away (used by the event viewer and tests)
    func forceWeather(_ k: WxKind) { wxKind = k; wxPhase = .on; wxT = 1; wxP = 1; wxA = 1; wxCool = 999; nextBolt = 1; nextGlow = 0.6; hits = 0 }
    private func updateWeather(_ dt: Double) {
        if wxKind == nil {
            wxCool -= dt
            if wxCool <= 0 { wxRoll += dt; if wxRoll >= 1 {   // one luck roll per second; storms are far rarer than fog
                wxRoll -= 1; var r = rnd(), k: WxKind? = nil
                for (name, e) in WX { if r < e.p { k = name; break }; r -= e.p }
                if let k { wxKind = k; wxPhase = .warn; wxT = 0; if k == .wind { windDir = rnd() < 0.5 ? -1 : 1 }; emit(.wxNote(k)) }
            } }
        } else if let k = wxKind {
            wxT += dt
            let e = wxInfo(k)
            if wxPhase == .warn && wxT >= e.warn { wxPhase = .on; wxT = 0; nextBolt = 2 + rnd() * 2.5; nextGlow = 0.6; hits = 0 }   // warning always comes first
            else if wxPhase == .on && wxT >= e.dur { wxPhase = .out; wxT = 0 }
            else if wxPhase == .out && wxP <= 0 { wxKind = nil; wxPhase = .none; wxCool = 30 + rnd() * 30 }   // long quiet spell before the next one
        }
        let quick = wxKind == .sun || wxKind == .wind, slow = wxKind == .aurora || wxKind == .meteor
        let fin = quick ? 0.7 : slow ? 4 : 3, fout = quick ? 0.8 : slow ? 3.2 : 2.6   // the night skies arrive and leave unhurried
        wxP = wxPhase == .on ? min(1, wxP + dt / fin) : max(0, wxP - dt / fout)
        let p = wxP; wxA = p * p * p * (p * (p * 6 - 15) + 10)   // smootherstep: starts and settles gently, no pop
        wxFlash = max(0, wxFlash - dt * 3)
        if let b = bolt, let o = b.o, o.zap, b.t >= b.pre + b.lead {   // the strike lands: the block is charged, and its slides are fitted to finish well before it reaches the balls
            o.zap = false; o.elec = true; o.et = 0; o.l0 = o.l; o.ex = LX[o.l]
            let av = (BY - o.y) / max(1, speed) - 0.35; o.sw = av >= 1.53 ? 2 : av >= 0.45 ? 1 : 0; o.ts = o.sw == 1 && av < 0.83 ? 0.83 / av : 1
        }
        if let b = bolt { b.t += dt; if b.t > b.dur { bolt = nil } }
        for i in glows.indices { glows[i].t += dt }
        glows.removeAll { $0.t >= $0.dur }
        if wxKind == .storm && wxPhase == .on { nextGlow -= dt; if nextGlow <= 0 { nextGlow = 0.7 + rnd() * 1.8; cloudGlow() } }
        if wxKind == .storm && wxPhase == .on { nextBolt -= dt; if nextBolt <= 0 { nextBolt = 2.4 + rnd() * 3.2; lightning() } }
        for o in things where o.elec {   // electrified blocks: two readable side switches (to the mirror column and back), finished long before they reach the balls
            o.et += dt; let A = LX[o.l0], B = LX[N - 1 - o.l0], te = o.et * o.ts, sw = o.sw
            let sm: (Double) -> Double = { q in q * q * (3 - 2 * q) }
            let p1 = sw > 0 ? sm(clamp01((te - 0.45) / 0.38)) : 0, p2 = sw > 1 ? sm(clamp01((te - 1.15) / 0.38)) : 0
            let ex = A + (B - A) * (p1 - p2); o.ex = ex; o.l = abs(ex - A) <= abs(ex - B) ? o.l0 : N - 1 - o.l0
        }
    }

    // MARK: lightning
    /// midpoint displacement perpendicular to the channel: jagged at every scale, like real lightning
    func boltPts(_ x0: Double, _ y0: Double, _ x1: Double, _ y1: Double, _ rough: Double = 0.32) -> [Pt] {
        var pts = [Pt(x: x0, y: y0), Pt(x: x1, y: y1)]
        for _ in 0..<5 {
            var nx: [Pt] = []
            for k in 0..<(pts.count - 1) {
                let a = pts[k], b = pts[k + 1], L = max(1e-9, hypot(b.x - a.x, b.y - a.y)), d = (rnd() - 0.5) * L * rough, al = (rnd() - 0.5) * L * 0.12
                nx.append(a); nx.append(Pt(x: (a.x + b.x) / 2 - (b.y - a.y) / L * d + (b.x - a.x) / L * al, y: (a.y + b.y) / 2 + (b.x - a.x) / L * d + (b.y - a.y) / L * al))
            }
            nx.append(pts[pts.count - 1]); pts = nx
        }
        return pts
    }
    private func forks(_ main: [Pt], _ n: Int, _ horiz: Bool = false) -> [Fork] {   // thinner branches peeling away from the channel
        var out: [Fork] = []
        for _ in 0..<n {
            let i0 = 3 + Int(rnd() * (Double(main.count) * 0.7)), p = main[min(i0, main.count - 2)], L = 40 + rnd() * 100, dir: Double = rnd() < 0.5 ? -1 : 1
            let ex = horiz ? p.x + (main[main.count - 1].x > main[0].x ? 1 : -1) * L : p.x + dir * L * (0.4 + rnd() * 0.6), ey = horiz ? p.y + dir * L * 0.35 : p.y + L
            let pts = boltPts(p.x, p.y, ex, ey, 0.5); out.append(Fork(i0: i0, pts: Array(pts.prefix(10 + Int(rnd() * 22)))))
        }
        return out
    }
    private func strokes() -> [Stroke] {   // one bright return stroke, then a few dimmer re-strikes down the same channel
        var st = [Stroke(t: 0, k: 1)]; let n = rnd() < 0.25 ? 0 : 1 + Int(rnd() * 3)
        for _ in 0..<n { st.append(Stroke(t: st[st.count - 1].t + 0.045 + rnd() * 0.09, k: 0.45 + rnd() * 0.4)) }
        return st
    }
    /// does this channel cross a block (where that block will be while the bolt is visible) or a ball?
    private func blocked(_ pts: [Pt], _ skip: Thing?, _ ahead: Double = 0) -> Bool {
        let hw = bw / 2 + 8
        for o in things where o.kind == .block && o !== skip {
            let x = bxOf(o), y0 = o.y + speed * ahead - 26, y1 = o.y + speed * (ahead + 0.22) + 26
            for p in pts where abs(p.x - x) < hw && p.y > y0 && p.y < y1 { return true }
        }
        for i in 0..<2 { for p in pts where hypot(p.x - bx[i], p.y - BY) < 34 { return true } }
        return false
    }
    private func cloudGlow() {   // lightning inside the cloud: mostly a crawler racing sideways through the deck; sometimes just a hidden glow
        let ch = cloudH, st = strokes()
        if rnd() < 0.7 {
            let x0 = W * (0.05 + rnd() * 0.4), dir: Double = rnd() < 0.5 ? 1 : -1, xs = dir > 0 ? x0 : W - x0, xe = xs + dir * W * (0.35 + rnd() * 0.45), y0 = ch * (0.08 + rnd() * 0.55)
            let pts = boltPts(xs, y0, xe, y0 + (rnd() - 0.5) * ch * 0.35, 0.38), lead = 0.14 + rnd() * 0.16
            glows.append(Glow(pts: pts, br: forks(pts, 2 + Int(rnd() * 3), true), t: 0, lead: lead, dur: 0.14 + 0.16 + st[st.count - 1].t + 0.5, st: st))
        } else { glows.append(Glow(pts: nil, x: W * (0.1 + rnd() * 0.8), y: ch * (0.05 + rnd() * 0.55), r: 0.7 + rnd() * 0.6, t: 0, lead: 0, dur: st[st.count - 1].t + 0.5, st: st)) }
        if rnd() < 0.5 { emit(.thunder(delay: 0.5 + rnd() * 0.9, vol: 0.035 + rnd() * 0.03, len: 2.6)) }
    }
    /// a strike from the cloud base: threads between the blocks to the floor; only now and then does one find a block
    private func lightning() {
        let y0 = -30.0, st = strokes(), lead = 0.16 + rnd() * 0.12, pre = 0.3 + rnd() * 0.35, ahead = pre + lead
        let preZ = 0.2 + rnd() * 0.12, aZ = preZ + lead   // a strike aimed at a block builds up a little quicker, so it can land while the block is still high
        let react = 0.7
        let landOK: (Thing) -> Bool = { o in let yl = o.y + self.speed * aZ; return yl > 24 && (self.BY - yl) / self.speed > react }
        let cand = things.filter { $0.kind == .block && !$0.elec && !$0.zap && landOK($0) }
        var bolt: Bolt? = nil, pre2 = pre
        let need = 2 - hits, left = (wxInfo(.storm).dur - wxT) / 4   // every storm charges at least two blocks
        let must = need > 0 && left <= Double(need) + 1.5
        if must && cand.isEmpty { cloudGlow(); nextBolt = 0.5; return }   // no block in a fair spot this instant: it rumbles in the cloud and tries again moments later
        if !cand.isEmpty && (must || rnd() < 0.33) {
            for o in cand.shuffled() {
                for i in 0..<16 where bolt == nil {
                    let pts = boltPts(LX[o.l] + (rnd() - 0.5) * (i < 6 ? 140 : W * 0.8), y0, LX[o.l], o.y + speed * aZ - 22)
                    if !blocked(pts, o, aZ) { bolt = Bolt(pts: pts, o: o) }
                }
                if bolt != nil { o.zap = true; pre2 = preZ; hits += 1; break }
            }
            if bolt == nil && must { cloudGlow(); nextBolt = 0.5; return }
        }
        var i = 0
        while bolt == nil && i < 120 {   // find a channel that misses every block and both balls; later tries run straighter
            let xe = W * (0.1 + rnd() * 0.8), x0 = min(W * 0.94, max(W * 0.06, xe + (rnd() - 0.5) * W * (i < 60 ? 0.5 : 0.15)))
            let pts = boltPts(x0, y0, xe, H + 60, i < 60 ? 0.32 : 0.16)
            if !blocked(pts, nil, ahead) && pts.allSatisfy({ $0.x > 6 && $0.x < W - 6 }) { bolt = Bolt(pts: pts, o: nil) }
            i += 1
        }
        guard let b = bolt else { cloudGlow(); nextBolt = 0.6 + rnd() * 0.6; return }   // nowhere clear to land: it stays in the cloud this time
        let pz = b.o != nil ? pre2 : pre
        b.br = forks(b.pts, 2 + Int(rnd() * 2)).filter { !blocked($0.pts, b.o, pz + lead) }
        b.t = 0; b.pre = pz; b.lead = lead; b.st = st; b.dur = pz + lead + st[st.count - 1].t + 0.55
        self.bolt = b; wxFlash = 1
        let at = b.pre + lead
        if b.o != nil { beep(1500, 0.12, .square, 0.03, -1100, delay: at); haptic(.heavy, delay: at); emit(.thunder(delay: at + 0.05, vol: 0.1, len: 2.4)) }
        else { emit(.thunder(delay: at + 0.15 + rnd() * 0.3, vol: 0.08 + rnd() * 0.03, len: 2.6)) }
    }
    /// brightness after the leader: each stroke flares and decays fast
    func flashK(t bt: Double, pre: Double, lead: Double, st: [Stroke]) -> Double {
        let s0 = pre + lead; if bt < s0 { return 0 }; let tt = bt - s0; var k = 0.0
        for s in st where tt >= s.t { k = max(k, s.k * exp(-(tt - s.t) * 13)) }
        return k
    }
    var boltK: Double { guard let b = bolt else { return 0 }; return flashK(t: b.t, pre: b.pre, lead: b.lead, st: b.st) }

    // MARK: - the look depends on the sky
    /// 0 = day style, 1 = night style (white text, rim light) during the aurora, meteors, storm and fog
    var nightK: Double { switch wxKind { case .aurora?, .meteor?: return wxA; case .storm?: return wxA * 0.85; case .fog?: return wxA * 0.8; default: return 0 } }
    var uiNight: Double { smooth((nightK - 0.3) / 0.3) }

    // MARK: - testing hooks
    /// the column that is safe for the row nearest above the balls (used by the auto-player in tests)
    func safeTargetPos() -> Int {
        let ahead = things.filter { $0.kind == .block && $0.y < BY + 30 }.sorted { $0.y > $1.y }
        guard let first = ahead.first else { return pos }
        let rowBlocks = ahead.filter { $0.row == first.row }
        for p in 0..<per { let l1 = p, l2 = N - 1 - p; if !rowBlocks.contains(where: { $0.l == l1 || $0.l == l2 }) { return p } }
        return pos
    }
    var position: Int { pos }
    var direction: Int { dirv }
}
