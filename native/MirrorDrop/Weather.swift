// The weather's finer touches, as in the web version (which draws exactly these whenever its GPU sky is on):
//   storm: big out-of-focus drops in front of the lens, splashes on the floor, wet blocks, rain beading and running on the glass
//   hail:  out-of-focus ice drifting in the air, hailstones with their wakes, bounces and splashes, frost in the corners
//   wind:  fine silk ribbons of moving air, and dust
//   fog:   a soft bank of mist drifting in front of the blocks, and a little condensation

import SpriteKit
import CoreImage
import UIKit

// MARK: - textures

extension Textures {
    /// a drop on glass as Apple draws it: a clear, slightly lighter lens, a thin dark rim on top, a soft bright crescent underneath, an irregular outline
    static func wetDrop(_ g: CGContext, _ x: CGFloat, _ y: CGFloat, _ r: CGFloat, big: Bool = false) {
        g.saveGState(); g.translateBy(x: x, y: y)
        let n = 12, ph = CGFloat.random(in: 0..<6), sq = 1 + CGFloat.random(in: 0..<0.12)
        let path = CGMutablePath()
        for i in 0...n {
            let an = CGFloat(i) / CGFloat(n) * 6.283, rr = r * (1 + 0.1 * sin(an * 2 + ph) + 0.05 * sin(an * 3 - ph))
            let px = cos(an) * rr, py = sin(an) * rr * sq * (an > 0 && an < .pi ? 1.05 : 0.97)
            if i == 0 { path.move(to: CGPoint(x: px, y: py)) } else { path.addLine(to: CGPoint(x: px, y: py)) }
        }
        path.closeSubpath()
        g.saveGState(); g.addPath(path); g.clip()
        linear(g, [(0, rgba(40, 50, 72, 0.30)), (0.35, rgba(210, 222, 240, 0.06)), (0.8, rgba(225, 235, 250, 0.20)), (1, rgba(240, 246, 255, 0.34))], CGPoint(x: 0, y: -r), CGPoint(x: 0, y: r))
        g.setLineCap(.butt)
        g.setStrokeColor(rgba(30, 38, 58, 0.32).cgColor); g.setLineWidth(max(0.5, r * 0.16)); g.addArc(center: CGPoint(x: 0, y: r * 0.06), radius: r * 0.98, startAngle: 3.5, endAngle: 5.95, clockwise: false); g.strokePath()   // the thin dark rim along the top
        g.setStrokeColor(rgba(245, 249, 255, 0.55).cgColor); g.setLineWidth(max(0.5, r * 0.2)); g.addArc(center: CGPoint(x: 0, y: -r * 0.05), radius: r * 0.9, startAngle: 0.5, endAngle: 2.65, clockwise: false); g.strokePath()   // a soft bright crescent underneath
        g.restoreGState()
        if r > 2.2 {   // a tiny, soft glint
            g.saveGState(); g.translateBy(x: -r * 0.32, y: -r * 0.46); g.rotate(by: -0.5)
            g.setFillColor(rgba(255, 255, 255, big ? 0.5 : 0.38).cgColor); g.fillEllipse(in: CGRect(x: -r * 0.14, y: -r * 0.08, width: r * 0.28, height: r * 0.16)); g.restoreGState()
        }
        g.restoreGState()
    }
    var beadTex: SKTexture { paint("bead3", CGSize(width: 64, height: 64)) { g, _ in Textures.wetDrop(g, 32, 32, 20) } }
    var dropTex: SKTexture { paint("drop2", CGSize(width: 96, height: 96)) { g, _ in Textures.wetDrop(g, 48, 45, 30, big: true) } }
    /// built once: hundreds of drops, mostly tiny, a few larger, tiling seamlessly
    var glassFilm: SKTexture {
        paint("film2", CGSize(width: 260, height: 520)) { g, s in
            let W2 = s.width, H2 = s.height
            for _ in 0..<420 {
                let r = 0.5 + pow(CGFloat.random(in: 0..<1), 3.4) * 4.6, x = CGFloat.random(in: 0..<W2), y = CGFloat.random(in: 0..<H2)
                for dx in [-W2, 0, W2] { for dy in [-H2, 0, H2] where x + dx > -8 && x + dx < W2 + 8 && y + dy > -8 && y + dy < H2 + 8 { Textures.wetDrop(g, x + dx, y + dy, r) } }
            }
        }
    }
    /// a hailstone in layers: clear refractive rim, cloudy body, a bright caustic core where light focuses, a sharp glint
    var ice: SKTexture {
        paint("ice3", CGSize(width: 64, height: 64)) { g, _ in
            let c: CGFloat = 32, R: CGFloat = 28, cc = CGPoint(x: c, y: c)
            g.saveGState(); g.addEllipse(in: CGRect(x: c - R, y: c - R, width: R * 2, height: R * 2)); g.clip()
            Textures.radial(g, [(0, rgba(214, 232, 250, 0.35)), (0.8, rgba(180, 210, 240, 0.55)), (1, rgba(150, 190, 230, 0.9))], cc, R * 0.55, cc, R, extend: true); g.restoreGState()
            g.saveGState(); g.addEllipse(in: CGRect(x: c - R * 0.75, y: c - R * 0.75, width: R * 1.5, height: R * 1.5)); g.clip()
            Textures.radial(g, [(0, rgba(248, 252, 255, 0.95)), (1, rgba(230, 242, 252, 0.2))], CGPoint(x: c - 4, y: c - 4), 0, cc, R * 0.75, extend: true); g.restoreGState()
            let k = CGPoint(x: c + 4, y: c + 9)
            g.saveGState(); g.addEllipse(in: CGRect(x: k.x - R * 0.4, y: k.y - R * 0.4, width: R * 0.8, height: R * 0.8)); g.clip()
            Textures.radial(g, [(0, rgba(255, 255, 255, 1)), (1, rgba(210, 240, 255, 0))], k, 0, k, R * 0.4); g.restoreGState()
            g.setStrokeColor(rgba(255, 255, 255, 0.75).cgColor); g.setLineWidth(1.5); g.addArc(center: cc, radius: R - 1.5, startAngle: 3.6, endAngle: 5.2, clockwise: false); g.strokePath()
            g.saveGState(); g.translateBy(x: c - 10, y: c - 12); g.rotate(by: -0.6); g.setFillColor(UIColor.white.cgColor); g.fillEllipse(in: CGRect(x: -5.5, y: -3.5, width: 11, height: 7)); g.restoreGState()
        }
    }
    var hailWake: SKTexture { paint("hwake", CGSize(width: 16, height: 96)) { g, s in g.saveGState(); g.addEllipse(in: CGRect(origin: .zero, size: s)); g.clip(); Textures.linear(g, [(0, rgba(230, 240, 252, 0)), (1, rgba(240, 248, 255, 0.9))], .zero, CGPoint(x: 0, y: 96)); g.restoreGState() } }
    /// fine condensation that thickens toward the corners and edges, clear in the middle
    var frost: SKTexture {
        paint("frost", CGSize(width: 200, height: 400)) { g, s in
            let w = s.width, h = s.height
            for _ in 0..<1400 {
                let x = CGFloat.random(in: 0..<w), y = CGFloat.random(in: 0..<h)
                let ex: CGFloat = min(x, w - x) / (w / 2), ey: CGFloat = min(y, h - y) / (h / 2)
                let e1: CGFloat = min(ex * 1.2, ey * 1.6), e2: CGFloat = hypot(ex, ey) * 0.9, e: CGFloat = min(e1, e2)
                if CGFloat.random(in: 0..<1) > pow(1 - min(1, e), 3) { continue }
                let R = 0.8 + CGFloat.random(in: 0..<1) * 3.5 * (1 - e), a = 0.25 + CGFloat.random(in: 0..<0.5)
                Textures.radial(g, [(0, rgba(250, 251, 253, a)), (0.4, rgba(250, 251, 253, a * 0.58)), (1, rgba(250, 251, 253, 0))], CGPoint(x: x, y: y), 0, CGPoint(x: x, y: y), R)
            }
            g.setFillColor(rgba(255, 255, 255, 0.95).cgColor)
            for _ in 0..<60 {   // a few larger beads
                let x = CGFloat.random(in: 0..<w), y = CGFloat.random(in: 0..<h)
                let ex: CGFloat = min(x, w - x) / (w / 2), ey: CGFloat = min(y, h - y) / (h / 2), e: CGFloat = min(ex, ey); if e > 0.35 { continue }
                let r = 0.5 + CGFloat.random(in: 0..<1); g.fillEllipse(in: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2))
            }
        }
    }
    /// fog: a seamless horizontal strip of overlapping soft puffs, blurred once, with soft holes cut through it; shaded bellies, bright crowns
    var fogSheet: SKTexture {
        if let t = fogSheetTex { return t }
        let w: CGFloat = 512, h: CGFloat = 180, k2: CGFloat = 2
        let fmt = UIGraphicsImageRendererFormat(); fmt.scale = k2; fmt.opaque = false
        let blobImg = { (c: (CGFloat, CGFloat, CGFloat)) -> UIImage in
            UIGraphicsImageRenderer(size: CGSize(width: 64, height: 64), format: fmt).image { r in
                Textures.radial(r.cgContext, [(0, rgba(c.0, c.1, c.2, 1)), (0.2, rgba(c.0, c.1, c.2, 0.86)), (0.4, rgba(c.0, c.1, c.2, 0.58)), (0.6, rgba(c.0, c.1, c.2, 0.3)), (0.8, rgba(c.0, c.1, c.2, 0.1)), (1, rgba(c.0, c.1, c.2, 0))], CGPoint(x: 32, y: 32), 0, CGPoint(x: 32, y: 32), 32)
            }
        }
        let body = blobImg((140, 148, 164)), lit = blobImg((166, 174, 190)), hole = blobImg((0, 0, 0))
        let puffs = UIGraphicsImageRenderer(size: CGSize(width: w, height: h), format: fmt).image { _ in
            for _ in 0..<22 {
                let x = CGFloat.random(in: 0..<w), y = h * 0.2 + CGFloat.random(in: 0..<1) * h * 0.5, R = h * (0.22 + CGFloat.random(in: 0..<0.3)) * 1.2
                let a = 0.35 + CGFloat.random(in: 0..<0.5), la = 0.25 + CGFloat.random(in: 0..<0.2)
                for dx in [-w, 0, w] {
                    body.draw(in: CGRect(x: x + dx - R * 1.6, y: y - R, width: R * 3.2, height: R * 2), blendMode: .normal, alpha: a)
                    lit.draw(in: CGRect(x: x + dx - R * 1.1, y: y - R * 1.15, width: R * 2.2, height: R * 1.2), blendMode: .normal, alpha: la)
                }
            }
            for _ in 0..<7 {   // clear patches so density varies across the sheet
                let x = CGFloat.random(in: 0..<w), y = CGFloat.random(in: 0..<h), R = h * (0.15 + CGFloat.random(in: 0..<0.25)), a = 0.5 + CGFloat.random(in: 0..<0.4)
                for dx in [-w, 0, w] { hole.draw(in: CGRect(x: x + dx - R * 1.5, y: y - R, width: R * 3, height: R * 2), blendMode: .destinationOut, alpha: a) }
            }
        }
        // blur once (wrapping neighbours so the blur stays seamless), then feather top and bottom so no edge ever shows
        var out = puffs
        if let ci = CIImage(image: puffs) {
            let tiled = ci.transformed(by: CGAffineTransform(translationX: -ci.extent.width, y: 0)).composited(over: ci).composited(over: ci.transformed(by: CGAffineTransform(translationX: ci.extent.width, y: 0)))
            let blurred = tiled.applyingGaussianBlur(sigma: 9 * k2 * 0.6).cropped(to: ci.extent)
            if let cg = CIContext().createCGImage(blurred, from: ci.extent) { out = UIImage(cgImage: cg, scale: k2, orientation: .up) }
        }
        let final = UIGraphicsImageRenderer(size: CGSize(width: w, height: h), format: fmt).image { r in
            out.draw(in: CGRect(x: 0, y: 0, width: w, height: h))
            r.cgContext.setBlendMode(.destinationIn)
            Textures.linear(r.cgContext, [(0, rgba(0, 0, 0, 0)), (0.22, rgba(0, 0, 0, 1)), (0.62, rgba(0, 0, 0, 1)), (1, rgba(0, 0, 0, 0))], .zero, CGPoint(x: 0, y: h))
        }
        let t = SKTexture(image: final); fogSheetTex = t; return t
    }
}
@MainActor private var fogSheetTex: SKTexture? = nil

// MARK: - the weather layer

@MainActor
final class WeatherFX {
    private unowned let scene: GameScene
    private let tex: Textures
    private let back = SKNode(), mid = SKNode(), front = SKNode()
    private var blobs: Pool<SKSpriteNode>!, wakes: Pool<SKSpriteNode>!, stones: Pool<SKSpriteNode>!, rings: Pool<SKShapeNode>!, dots: Pool<SKSpriteNode>!
    private var lens: Pool<SKSpriteNode>!, wet: Pool<SKShapeNode>!, beads: Pool<SKSpriteNode>!, films: Pool<SKSpriteNode>!, sheets: Pool<SKSpriteNode>!
    private var ribbons: Pool<SKShapeNode>!, dust: Pool<SKSpriteNode>!
    private let frost = SKSpriteNode()
    private var ribbonShaders: [SKShader] = []
    private var lastT = 0.0

    // hail contacts, raindrops on the glass
    private struct Hit { var x, y, t, s, vx, r: Double }
    private var hits: [Hit] = []
    private struct Drop { var on = false, x = 0.0, y = 0.0, r = 0.0, life = 0.0, max = 0.0, slide = false, hold = 0.0, vy = 0.0, lastB = 0.0 }
    private var drops = Array(repeating: Drop(), count: 12), glassBeads = Array(repeating: Drop(), count: 48)
    private var glassWet = 0.0
    private var windHead = Array(repeating: -1.0, count: 7)

    init(scene: GameScene, tex: Textures, backLayer: SKNode, midLayer: SKNode, frontLayer: SKNode) {
        self.scene = scene; self.tex = tex
        backLayer.addChild(back); midLayer.addChild(mid); frontLayer.addChild(front)
        mid.zPosition = 1.5; front.zPosition = 4
        let t = tex
        blobs = Pool(back) { let s = SKSpriteNode(texture: t.blob((240, 246, 255))); return s }
        wakes = Pool(back) { SKSpriteNode(texture: t.hailWake) }
        stones = Pool(back) { SKSpriteNode(texture: t.ice) }
        rings = Pool(back) { let s = SKShapeNode(); s.fillColor = .clear; s.lineWidth = 1; return s }
        dots = Pool(back) { let s = SKSpriteNode(texture: t.dot); s.colorBlendFactor = 1; return s }
        lens = Pool(back) { SKSpriteNode(texture: t.blob((225, 232, 246))) }
        wet = Pool(mid) { let s = SKShapeNode(); s.lineCap = .round; s.lineJoin = .round; return s }
        sheets = Pool(mid) { let s = SKSpriteNode(texture: t.fogSheet); s.anchorPoint = CGPoint(x: 0, y: 1); return s }
        films = Pool(front) { let s = SKSpriteNode(texture: t.glassFilm); s.anchorPoint = CGPoint(x: 0, y: 1); return s }
        beads = Pool(front) { SKSpriteNode(texture: t.beadTex) }
        ribbons = Pool(back) { let s = SKShapeNode(); s.lineCap = .round; s.lineJoin = .round; s.fillColor = .clear; return s }
        dust = Pool(back) { let s = SKSpriteNode(texture: t.dot); s.color = rgba(160, 145, 120, 1); s.colorBlendFactor = 1; return s }
        frost.texture = t.frost; front.addChild(frost)
        // each ribbon fades in from its tail, brightens toward the gust front, then ends softly: a gradient along the path
        let fsh = """
        void main() {
            float q = v_path_distance / max(u_path_length, 0.001);
            float a = q < 0.55 ? q / 0.55 * 0.6 : (q < 0.88 ? 0.6 + (q - 0.55) / 0.33 * 0.4 : 1.0 - (q - 0.88) / 0.12);
            a *= u_col.a;
            gl_FragColor = vec4(u_col.rgb * a, a);
        }
        """
        for _ in 0..<4 { ribbonShaders.append(SKShader(source: fsh, uniforms: [SKUniform(name: "u_col", vectorFloat4: SIMD4<Float>(1, 1, 1, 1))])) }
    }

    private func P(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: x, y: scene.model.H - y) }

    func render() {
        let m = scene.model, t = m.t, W = m.W, H = m.H, a = m.wxA, e = a * a * (3 - 2 * a)
        let dt = min(0.05, max(0, t - lastT)); lastT = t
        let reduce = UIAccessibility.isReduceMotionEnabled
        for p in [blobs!, wakes!, stones!, dots!, lens!, beads!, films!, sheets!, dust!] { p.begin() }
        for p in [rings!, wet!, ribbons!] { p.begin() }
        frost.isHidden = true
        let kind = m.wxKind

        // MARK: hail
        if kind == .hail && a > 0.01 {
            for k in 0..<40 {   // layers of out-of-focus ice drifting in the air
                let z = 0.3 + hash1(Double(k)) * 0.7
                let x = (hash1(Double(k) * 3.1) * W + t * 18 * z + sin(t * 0.7 + Double(k)) * 14).truncatingRemainder(dividingBy: W + 20) - 10
                let y = (hash1(Double(k) * 7.7) * H + t * (70 + 140 * z)).truncatingRemainder(dividingBy: H + 20) - 10
                let r = 2 + z * 5, s = blobs.next(); s.texture = tex.blob((240, 246, 255)); s.position = P(x, y); s.size = CGSize(width: r * 2, height: r * 2); s.alpha = CGFloat((0.18 + 0.3 * (1 - z)) * a)
            }
            for d in WeatherBits.hail {   // ice beads of uneven size and speed, drifting slightly, with occasional splashes
                let sway = nz(t * 0.8, d.x * 40) * 14
                let x = (d.x * (W + 40) + t * 40 * d.s).truncatingRemainder(dividingBy: W + 40) - 20 + sway, y = (d.y * (H + 60) + t * 600 * d.s).truncatingRemainder(dividingBy: H + 60) - 30
                let wk = wakes.next(); wk.position = P(x, y - d.r * 12 + d.r * 6.25); wk.size = CGSize(width: d.r * 1.8, height: d.r * 12.5); wk.alpha = CGFloat(0.4 * a)
                let st = stones.next(); st.position = P(x, y - d.r * 1.4 + d.r * 1.425); st.size = CGSize(width: d.r * 2.6, height: d.r * 2.85); st.alpha = CGFloat(0.8 * a)
                if y > m.BY + 55 && y < m.BY + 70 && rnd() < 0.3 && hits.count < 16 { hits.append(Hit(x: x, y: y, t: 0, s: 0.6 + rnd() * 0.8, vx: (rnd() - 0.5) * 60, r: d.r)) }
                if hits.count < 16 && rnd() < 0.35 { for o in m.things where o.kind == .block && abs(x - m.bxOf(o)) < m.bw / 2 - 4 && y > o.y - 30 && y < o.y - 18 { hits.append(Hit(x: x, y: o.y - 22, t: 0, s: 0.5 + rnd() * 0.6, vx: (rnd() - 0.5) * 90, r: d.r * 0.8)); break } }   // stones bounce off the blocks
            }
            if a > 0.01 { frost.isHidden = false; frost.alpha = CGFloat(0.3 * a * a) }
        }
        for i in hits.indices { hits[i].t += dt }
        hits.removeAll { $0.t > 0.4 }
        if kind != .hail { hits.removeAll() }
        for h in hits {
            let k = h.t / 0.4
            if k < 0.25 { let f = blobs.next(); f.texture = tex.blob((255, 255, 255)); f.position = P(h.x, h.y); f.size = CGSize(width: 14, height: 8); f.alpha = CGFloat((1 - k / 0.25) * a) }   // crisp contact flash
            let d = dots.next(); d.color = .white; d.position = P(h.x + h.vx * h.t, h.y - sin(k * .pi) * 14 * h.s); d.size = CGSize(width: h.r * 1.6, height: h.r * 1.6); d.alpha = CGFloat((1 - k) * 0.8 * a)
            let rg = rings.next(); let rw = (3 + k * 10) * h.s, rh = (1 + k * 3) * h.s
            rg.path = CGPath(ellipseIn: CGRect(x: -rw, y: -rh, width: rw * 2, height: rh * 2), transform: nil); rg.position = P(h.x, h.y); rg.strokeColor = rgba(200, 225, 245, CGFloat((1 - k) * 0.55 * a)); rg.lineWidth = 1
        }

        // MARK: storm
        if kind == .storm && a > 0.01 {
            let lit = 1 + m.boltK * 0.8
            for k in 0..<6 {   // big out-of-focus drops right in front of the lens
                let sd = SEEDS[k + 11], sp = 1700 + sd.k * 700, L = 140 + sd.k * 120, wdt = 7 + sd.k * 6
                let v = t * sp + sd.y * (H + L), cyc = floor(v / (H + L))
                let x = (sd.x * 997 + cyc * 211).truncatingRemainder(dividingBy: W), y = v.truncatingRemainder(dividingBy: H + L) - L
                let s = lens.next(); s.position = P(x, y + L / 2); s.size = CGSize(width: wdt, height: L); s.alpha = CGFloat(e * (0.07 + sd.k * 0.05) * lit)
            }
            for k in 0..<14 {   // splashes: a tiny ring and a crown of droplets
                let sd = SEEDS[(k + 3) % 24], rate = 2.2 + sd.k, v = t * rate + sd.s, ph = v.truncatingRemainder(dividingBy: 1), cyc = floor(v)
                let x = (sd.x * W + cyc * 131 * Double(k + 1)).truncatingRemainder(dividingBy: W), y = m.BY + 50 + (sd.y + cyc * 0.37).truncatingRemainder(dividingBy: 1) * 110, f = (1 - ph) * (1 - ph)
                let rg = rings.next(); let rw = 1.5 + ph * 8, rh = 0.5 + ph * 2
                rg.path = CGPath(ellipseIn: CGRect(x: -rw, y: -rh, width: rw * 2, height: rh * 2), transform: nil); rg.position = P(x, y); rg.strokeColor = rgba(185, 200, 222, CGFloat(e * 0.5 * f)); rg.lineWidth = 0.8
                if ph < 0.5 { let u = ph / 0.5; for dx in [-1.0, 1, -0.4, 0.5] { let d = dots.next(); d.color = rgba(200, 212, 230, 1); d.position = P(x + dx * (2 + u * 7), y - sin(u * .pi) * (5 + abs(dx) * 3)); d.size = CGSize(width: 1.6, height: 1.6); d.alpha = CGFloat(e * 0.6 * f) } }
            }
            if m.wxPhase != .warn { renderWetBlocks(m, t, W8: e) }
        }

        // MARK: wind
        if kind == .wind && a > 0.01 { renderWind(m, t, dt, a) }

        // MARK: fog: one soft bank of mist in front of the blocks (the GPU sky paints the rest), and a little condensation
        if kind == .fog && a > 0.01 {
            let breath = 0.78 + 0.22 * nz(t * 0.13, 15), yy = H * 0.64 + nz(t * 0.07, 9) * 18, hh = H * 0.42 * (1 + 0.06 * nz(t * 0.1, 3))
            let S = W * 1.9, x = ((t * -8).truncatingRemainder(dividingBy: S) + S).truncatingRemainder(dividingBy: S)
            var k = -1.0
            while x + k * S < W + 20 { let s = sheets.next(); s.position = P(x + k * S - 10, yy); s.size = CGSize(width: S + 1, height: hh); s.alpha = CGFloat(0.38 * e * breath); k += 1 }
            frost.isHidden = false; frost.alpha = CGFloat(0.12 * a * a)
        }
        if !frost.isHidden { frost.size = CGSize(width: W + 20, height: H + 20); frost.position = CGPoint(x: W / 2, y: H / 2) }

        // MARK: rain on the glass: lots of tiny beads, a few drops, some sliding away
        if !reduce { renderGlass(m, t, dt) }

        for p in [blobs!, wakes!, stones!, dots!, lens!, beads!, films!, sheets!, dust!] { p.end() }
        for p in [rings!, wet!, ribbons!] { p.end() }
    }

    /// rain on a block: a thin pool shining along the top, ripples, little splash crowns, and drops gathering and falling from the bottom corners
    private func renderWetBlocks(_ m: GameModel, _ t: Double, W8: Double) {
        guard W8 > 0.02 else { return }
        let w = m.bw, h = 44.0
        for o in m.things where o.kind == .block && !(o.hitAt != nil && m.state == .dead) {
            let x = m.bxOf(o), y = o.y, x0 = x - w / 2, y0 = y - h / 2, sd = Double(o.row) * 7.31 + Double(o.l) * 1.7
            let men = wet.next(), mp = CGMutablePath()   // the pool's bright meniscus along the top
            for i in 0...8 { let px = x0 + 9 + (w - 18) * Double(i) / 8, py = y0 + 1.2 - sin(Double(i) / 8 * .pi) * 1.1 + sin(t * 3 + Double(i) + sd) * 0.25; if i == 0 { mp.move(to: P(px, py)) } else { mp.addLine(to: P(px, py)) } }
            men.path = mp; men.position = .zero; men.strokeColor = rgba(228, 238, 255, CGFloat(0.6 * W8)); men.lineWidth = 1.6; men.fillColor = .clear
            for k in 0..<3 {   // drops landing on top: a ring spreading in the pool and a small crown of droplets
                let rate = 1.6 + hash1(sd + Double(k)) * 1.4, v = t * rate + hash1(sd * 3 + Double(k)), ph = v.truncatingRemainder(dividingBy: 1), c = floor(v)
                let sx = x0 + 10 + hash1(c * 1.37 + sd + Double(k) * 9) * (w - 20)
                let rg = wet.next(); let rw = 1.5 + ph * 9, rh = 0.5 + ph * 1.6
                rg.path = CGPath(ellipseIn: CGRect(x: -rw, y: -rh, width: rw * 2, height: rh * 2), transform: nil); rg.position = .zero; rg.position = P(sx, y0 + 1); rg.strokeColor = rgba(220, 234, 255, CGFloat(0.7 * (1 - ph) * W8)); rg.lineWidth = 1; rg.fillColor = .clear
                if ph < 0.4 {
                    let u = ph / 0.4, cr = wet.next(), cp = CGMutablePath()
                    for (dx, hgt) in [(-1.0, 7.0), (1, 8), (-0.45, 10), (0.55, 9)] { let c2 = P(sx + dx * (2 + u * 8), y0 - sin(u * .pi) * hgt * 1.2); cp.addEllipse(in: CGRect(x: c2.x - 1.25, y: c2.y - 1.25, width: 2.5, height: 2.5)) }
                    cr.path = cp; cr.position = .zero; cr.fillColor = rgba(232, 242, 255, CGFloat(0.8 * (1 - u) * W8)); cr.strokeColor = .clear
                }
            }
            for side in 0..<2 {   // a drop swells at each lower corner, hangs, then lets go
                let per = 1.3 + hash1(sd + Double(side) * 5) * 0.9, ph = (t / per + hash1(sd + Double(side))).truncatingRemainder(dividingBy: 1)
                let cx = side == 1 ? x0 + w - 7 : x0 + 7, cy = y0 + h - 0.5, dn = wet.next(), dp = CGMutablePath()
                if ph < 0.72 { let g = ph / 0.72, r = 0.6 + g * 2.1, c2 = P(cx, cy + r * 0.9); dp.addEllipse(in: CGRect(x: c2.x - r * 0.85, y: c2.y - r * 1.15, width: r * 1.7, height: r * 2.3)); dn.fillColor = rgba(214, 228, 250, CGFloat(0.75 * W8)) }
                else { let f = (ph - 0.72) / 0.28, dy = 3 + f * f * 46, c2 = P(cx, cy + dy), ry = 2.6 + f * 1.5; dp.addEllipse(in: CGRect(x: c2.x - 1.7, y: c2.y - ry, width: 3.4, height: ry * 2)); dn.fillColor = rgba(214, 228, 250, CGFloat(0.8 * (1 - f) * W8)) }
                dn.path = dp; dn.position = .zero; dn.strokeColor = .clear
            }
        }
    }

    /// air currents drawn as fine silk ribbons: a bright gust front races along each one, its tail dissolving behind
    private func renderWind(_ m: GameModel, _ t: Double, _ dt: Double, _ a: Double) {
        let W = m.W, H = m.H, dir = m.windDir
        let gust = 0.7 + 0.3 * (nz(t * 0.3, 2) * 0.5 + 0.5)
        let styles: [(Double, Double, Double, Double)] = [(1, 1, 1, 0.09), (150 / 255, 168 / 255, 200 / 255, 0.1), (1, 1, 1, 0.85), (1, 1, 1, 0.5)]
        for (i, s) in styles.enumerated() { ribbonShaders[i].uniforms.first?.vectorFloat4Value = SIMD4<Float>(Float(s.0), Float(s.1), Float(s.2), Float(s.3 * a)) }
        for k in 0..<7 {
            let sd = SEEDS[k + 3], base = H * (0.1 + Double(k) * 0.125 + sd.y * 0.05), amp = 10 + sd.k * 18, span = W * 1.9
            if windHead[k] < 0 { windHead[k] = sd.x * span }
            windHead[k] += dt * (360 + sd.k * 300) * (0.85 + 0.15 * nz(t * 0.2, Double(k)))   // each ribbon glides at its own steady pace
            let head = windHead[k].truncatingRemainder(dividingBy: span) - W * 0.45, len = W * (0.55 + sd.k * 0.3) * gust
            let hx: Double = dir > 0 ? head : W - head
            let tx: Double = dir > 0 ? head - len : W - head + len
            let sds: Double = sd.s, ampK: Double = 14 + amp * 0.6, phase0: Double = base * 0.004 - t * 0.5 * dir
            let flow: (Double) -> Double = { (x: Double) -> Double in   // one shared current: neighbouring ribbons bend together
                let w1: Double = sin(x * 0.0055 + phase0) * ampK
                let n1: Double = nz(x * 0.004 + t * 0.1, 1) * 16
                let n2: Double = nz(x * 0.01 + t * 0.18, sds) * 5
                return base + w1 + n1 + n2
            }
            let n = max(2, Int(abs(hx - tx) / 8))
            func path(_ off: (Double) -> Double) -> CGPath {   // drawn from the tail to the head, so the gradient runs the right way
                let p = CGMutablePath()
                for i in 0...n { let x = tx + (hx - tx) * Double(i) / Double(n); let pt = P(x, flow(x) + off(x)); if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) } }
                return p
            }
            let body = ribbons.next(); body.path = path { _ in 0 }; body.lineWidth = CGFloat(26 + sd.k * 10); body.strokeShader = ribbonShaders[0]   // a soft, wide body of moving air
            let shade = ribbons.next(); shade.path = path { _ in 3 }; shade.lineWidth = 7; shade.strokeShader = ribbonShaders[1]   // the faintest cool shade beneath, for depth
            for j in 0..<3 {   // fine strands that drift apart and weave back together
                let extra: Double = j == 1 ? 0.9 : 0, lw: Double = 0.8 + extra + sd.k * 0.5, side = Double(j - 1), jj = Double(j), kk = Double(k)
                let s = ribbons.next(); s.lineWidth = CGFloat(lw); s.strokeShader = ribbonShaders[j == 1 ? 2 : 3]
                s.path = path { (x: Double) -> Double in let ph: Double = x * 0.011 - t * 0.7 * dir + jj * 2.1 + kk; return side * (4 + 3.5 * sin(ph)) }
            }
        }
        for k in 0..<12 {   // dust
            let sd = SEEDS[(k + 6) & 15], x = (sd.x * (W + 100) + t * (300 + sd.k * 260)).truncatingRemainder(dividingBy: W + 100) - 50, X = dir > 0 ? x : W - x
            let y = (sd.y + Double(k) * 0.29).truncatingRemainder(dividingBy: 1) * H + nz(t * 0.5 + Double(k), sd.s) * 30
            let d = dust.next(); d.position = P(X, y); d.size = CGSize(width: (1.3 + sd.k) * 2, height: 1.6); d.zRotation = -CGFloat(t * 1.2 + Double(k)); d.alpha = CGFloat(0.4 * a)
        }
    }

    private func bead(_ x: Double, _ y: Double, _ r: Double, _ max: Double) {
        if let i = glassBeads.firstIndex(where: { !$0.on }) { glassBeads[i] = Drop(on: true, x: x, y: y, r: r, life: 0, max: max) }
    }
    /// rain on the glass: lots of tiny beads, a few drops, some sliding away in teardrops, a fine film of droplets building up
    private func renderGlass(_ m: GameModel, _ t: Double, _ dt: Double) {
        let W = m.W, H = m.H
        let raining = m.wxKind == .storm && m.wxPhase != .warn && m.wxA > 0.3, A = m.wxKind == .storm ? m.wxA : 0
        if raining {
            if rnd() < dt * 9 { bead(8 + rnd() * (W - 16), rnd() * H * 0.92, 1.2 + pow(rnd(), 2) * 3.2, 3 + rnd() * 5) }   // fine beads keep landing
            if rnd() < dt * 2.4, let i = drops.firstIndex(where: { !$0.on }) {
                drops[i] = Drop(on: true, x: 14 + rnd() * (W - 28), y: rnd() * H * 0.8, r: 5 + pow(rnd(), 2) * 9, life: 0, max: 3 + rnd() * 3, slide: rnd() < 0.45, hold: 0.6 + rnd() * 1.8, vy: 0, lastB: 0)
                for _ in 0..<3 { let an = rnd() * 6.283, rr = drops[i].r * (1.3 + rnd()); bead(drops[i].x + cos(an) * rr, drops[i].y + sin(an) * rr, 0.7 + rnd() * 1.1, 1.5 + rnd() * 2) }   // splash specks around a new drop
            }
        }
        if A > 0.01 { glassWet = raining ? min(1, glassWet + dt / 7) : max(0, glassWet - dt / 2.5) } else { glassWet = 0 }
        if glassWet > 0.01 {   // the fine film of droplets, tiled across the glass
            let fk = glassWet * A, tw = 260.0, th = 520.0
            var x = 0.0
            while x < W { var y = 0.0; while y < H { let f = films.next(); f.position = P(x, y); f.size = CGSize(width: tw, height: th); f.alpha = CGFloat(min(1, fk)); y += th }; x += tw }
        }
        for i in glassBeads.indices where glassBeads[i].on { glassBeads[i].life += dt; if glassBeads[i].life > glassBeads[i].max || (!raining && A < 0.02) { glassBeads[i].on = false } }
        for i in drops.indices where drops[i].on {
            var d = drops[i]
            d.life += dt
            if d.slide && d.life > d.hold {   // gravity wins: the drop runs, wobbling, swallowing beads in its way and leaving a beaded trail
                d.vy = min(d.vy + (180 + d.r * 14) * dt, 50 + d.r * 20) * (rnd() < dt * 2 ? 0.35 : 1); d.y += d.vy * dt; d.x += nz(t * 2.2, d.r * 3) * 0.35
                for b in glassBeads.indices where glassBeads[b].on && abs(glassBeads[b].x - d.x) < d.r && glassBeads[b].y > d.y - d.r && glassBeads[b].y < d.y + d.r * 1.4 && glassBeads[b].life > 0.2 { glassBeads[b].on = false; d.r = min(15, d.r + glassBeads[b].r * 0.12) }
                for o in drops.indices where o != i && drops[o].on && hypot(drops[o].x - d.x, drops[o].y - d.y) < (drops[o].r + d.r) * 0.8 { drops[o].on = false; d.r = min(16, sqrt(d.r * d.r + drops[o].r * drops[o].r)); d.vy *= 0.6 }   // drops merge
                if d.y - d.lastB > 7 + rnd() * 6 { d.lastB = d.y; bead(d.x + (rnd() - 0.5) * d.r * 0.4, d.y - d.r * 1.1, d.r * (0.14 + rnd() * 0.14), 1.6 + rnd() * 1.6) }
            } else if d.lastB == 0 { d.lastB = d.y }
            if d.y > H + 20 || d.life > d.max + (d.slide ? 5 : 0) || (!raining && A < 0.02) { d.on = false }
            drops[i] = d
        }
        for b in glassBeads where b.on {
            let k = smooth(b.life / 0.1) * (1 - smooth((b.life - b.max + 0.8) / 0.8)) * min(1, A * 1.6); if k < 0.02 { continue }
            let s = beads.next(); s.texture = tex.beadTex; s.position = P(b.x, b.y); s.size = CGSize(width: b.r * 3.2, height: b.r * 3.2); s.alpha = CGFloat(k)
        }
        for d in drops where d.on {
            let run = d.slide && d.life > d.hold, sp = run ? clamp01(d.vy / (50 + d.r * 20)) : 0
            let k = smooth(d.life / 0.12) * (d.slide ? 1 : 1 - smooth((d.life - d.max + 1) / 1)) * min(1, A * 1.6 + (run ? 0.4 : 0)); if k < 0.01 { continue }
            let rx = d.r * (1 - sp * 0.12), ry = d.r * (1.06 + sp * 0.32), cy = d.y + sp * d.r * 0.15   // a teardrop when running
            let s = beads.next(); s.texture = tex.dropTex; s.position = P(d.x, cy - ry * 1.3 + ry * 1.4); s.size = CGSize(width: rx * 3, height: ry * 2.8); s.alpha = CGFloat(k)
        }
    }
}
