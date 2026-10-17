// Every picture the game draws, painted once with Core Graphics in exactly the colours and gradients of the web version,
// then handed to SpriteKit as textures. Drawing a frame is then just moving and fading sprites, which the GPU does at 120 fps.

import UIKit
import Combine
import SpriteKit

func rgb(_ hex: UInt32, _ a: CGFloat = 1) -> UIColor {
    UIColor(red: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: a)
}
func rgba(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat) -> UIColor { UIColor(red: r / 255, green: g / 255, blue: b / 255, alpha: a) }

/// the system font in its rounded design, as the web version asked for ("SF Pro Rounded")
func roundedFont(_ size: CGFloat, _ weight: UIFont.Weight) -> UIFont {
    let base = UIFont.systemFont(ofSize: size, weight: weight)
    if let d = base.fontDescriptor.withDesign(.rounded) { return UIFont(descriptor: d, size: size) }
    return base
}

struct BallPalette { let base, hi, lo, deep: UInt32; let core: (CGFloat, CGFloat, CGFloat); let rgb: (CGFloat, CGFloat, CGFloat) }
let PAL = [
    BallPalette(base: 0xff6b81, hi: 0xffa6b3, lo: 0xe2496a, deep: 0xb8304f, core: (255, 228, 234), rgb: (255, 107, 129)),
    BallPalette(base: 0x2ec4d6, hi: 0x8fe7f1, lo: 0x169eb2, deep: 0x0b7a8c, core: (222, 250, 255), rgb: (46, 196, 214)),
]
let ELEC = BallPalette(base: 0x7cc4ff, hi: 0xffffff, lo: 0x3b82f6, deep: 0x1f56c9, core: (238, 248, 255), rgb: (124, 196, 255))

@MainActor
final class Textures {
    /// pixels per game unit (the game field is 520 units wide; on an iPhone that is about 2.3 pixels per unit)
    let k: CGFloat
    private var cache: [String: SKTexture] = [:]
    init(pixelsPerUnit: CGFloat) { k = max(1, pixelsPerUnit) }

    /// paints `size` game units into a texture at full screen sharpness
    func paint(_ key: String, _ size: CGSize, _ draw: (CGContext, CGSize) -> Void) -> SKTexture {
        if let t = cache[key] { return t }
        let fmt = UIGraphicsImageRendererFormat(); fmt.scale = k; fmt.opaque = false
        let img = UIGraphicsImageRenderer(size: size, format: fmt).image { c in draw(c.cgContext, size) }
        let t = SKTexture(image: img); t.filteringMode = .linear
        cache[key] = t
        return t
    }

    // MARK: gradient helpers
    static func gradient(_ stops: [(CGFloat, UIColor)]) -> CGGradient {
        CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: stops.map { $0.1.cgColor } as CFArray, locations: stops.map { $0.0 })!
    }
    static func linear(_ c: CGContext, _ stops: [(CGFloat, UIColor)], _ p0: CGPoint, _ p1: CGPoint) {
        c.drawLinearGradient(gradient(stops), start: p0, end: p1, options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
    }
    static func radial(_ c: CGContext, _ stops: [(CGFloat, UIColor)], _ c0: CGPoint, _ r0: CGFloat, _ c1: CGPoint, _ r1: CGFloat, extend: Bool = false) {
        c.drawRadialGradient(gradient(stops), startCenter: c0, startRadius: r0, endCenter: c1, endRadius: r1, options: extend ? [.drawsBeforeStartLocation, .drawsAfterEndLocation] : [.drawsBeforeStartLocation])
    }
    static func rrect(_ r: CGRect, _ rad: CGFloat) -> CGPath { CGPath(roundedRect: r, cornerWidth: min(rad, r.width / 2), cornerHeight: min(rad, r.height / 2), transform: nil) }

    // MARK: shared shapes
    /// smooth, near-gaussian falloff: no visible edge
    func blob(_ c: (CGFloat, CGFloat, CGFloat)) -> SKTexture {
        paint("blob\(c)", CGSize(width: 128, height: 128)) { g, s in
            Textures.radial(g, [(0, rgba(c.0, c.1, c.2, 1)), (0.2, rgba(c.0, c.1, c.2, 0.86)), (0.4, rgba(c.0, c.1, c.2, 0.58)), (0.6, rgba(c.0, c.1, c.2, 0.3)), (0.8, rgba(c.0, c.1, c.2, 0.1)), (1, rgba(c.0, c.1, c.2, 0))], CGPoint(x: 64, y: 64), 0, CGPoint(x: 64, y: 64), 64)
        }
    }
    var dot: SKTexture { paint("dot", CGSize(width: 16, height: 16)) { g, _ in g.setFillColor(UIColor.white.cgColor); g.fillEllipse(in: CGRect(x: 0, y: 0, width: 16, height: 16)) } }
    var white: SKTexture { paint("white", CGSize(width: 4, height: 4)) { g, s in g.setFillColor(UIColor.white.cgColor); g.fill(CGRect(origin: .zero, size: s)) } }
    func pill(_ w: CGFloat, _ h: CGFloat) -> SKTexture {
        paint("pill\(w)x\(h)", CGSize(width: w, height: h)) { g, s in g.addPath(Textures.rrect(CGRect(origin: .zero, size: s), h / 2)); g.setFillColor(UIColor.white.cgColor); g.fillPath() }
    }

    // MARK: background (the calm cream field, pink on the left, cyan on the right)
    func background(_ W: CGFloat, _ H: CGFloat) -> SKTexture {
        paint("bg\(W)x\(H)", CGSize(width: W + 40, height: H + 40)) { g, s in
            g.translateBy(x: 20, y: 20)
            Textures.linear(g, [(0, rgb(0xfbf7f2)), (1, rgb(0xf2ece4))], CGPoint(x: 0, y: 0), CGPoint(x: 0, y: H))
            g.saveGState(); g.clip(to: CGRect(x: -20, y: -20, width: W / 2 + 20, height: H + 40))
            Textures.linear(g, [(0, rgba(255, 107, 129, 0.13)), (1, rgba(255, 107, 129, 0.06))], CGPoint(x: 0, y: 0), CGPoint(x: W / 2, y: 0)); g.restoreGState()
            g.saveGState(); g.clip(to: CGRect(x: W / 2, y: -20, width: W / 2 + 20, height: H + 40))
            Textures.linear(g, [(0, rgba(46, 196, 214, 0.14)), (1, rgba(46, 196, 214, 0.06))], CGPoint(x: W, y: 0), CGPoint(x: W / 2, y: 0)); g.restoreGState()
        }
    }
    /// the soft white light pooling around the balls (its strength pulses with each speed-up)
    func centreGlow(_ R: CGFloat) -> SKTexture {
        paint("cg\(R)", CGSize(width: R * 2, height: R * 2)) { g, s in Textures.radial(g, [(0, rgba(255, 255, 255, 1)), (1, rgba(255, 255, 255, 0))], CGPoint(x: R, y: R), 10, CGPoint(x: R, y: R), R) }
    }
    /// a vertical band fading out to both sides (the divider glow, light streaks)
    var hBand: SKTexture { paint("hband", CGSize(width: 64, height: 4)) { g, s in Textures.linear(g, [(0, rgba(255, 255, 255, 0)), (0.5, rgba(255, 255, 255, 1)), (1, rgba(255, 255, 255, 0))], .zero, CGPoint(x: 64, y: 0)) } }
    var vFade: SKTexture { paint("vfade", CGSize(width: 4, height: 64)) { g, s in Textures.linear(g, [(0, rgba(255, 255, 255, 0)), (1, rgba(255, 255, 255, 1))], .zero, CGPoint(x: 0, y: 64)) } }   // transparent at the top, opaque at the bottom (in texture space)
    var dash: SKTexture { paint("dash", CGSize(width: 3, height: 22)) { g, s in g.addPath(Textures.rrect(CGRect(origin: .zero, size: s), 1.5)); g.setFillColor(rgba(43, 45, 66, 0.045).cgColor); g.fillPath() } }

    // MARK: blocks
    func block(_ w: CGFloat, elec: Bool) -> SKTexture {
        let h: CGFloat = 44, pad: CGFloat = elec ? w * 0.5 : 8
        return paint("block\(w)\(elec)", CGSize(width: w + pad * 2, height: h + pad * 2 + 8)) { g, s in
            g.translateBy(x: pad, y: pad)
            let r: CGFloat = 12
            if elec {   // lightning-struck: blue charge around it
                Textures.radial(g, [(0, rgba(110, 175, 255, 0.38)), (1, rgba(110, 175, 255, 0))], CGPoint(x: w / 2, y: h / 2), 10, CGPoint(x: w / 2, y: h / 2), w * 0.95)
            }
            g.addPath(Textures.rrect(CGRect(x: 2, y: 6, width: w - 4, height: h), r)); g.setFillColor(rgba(43, 45, 66, 0.13).cgColor); g.fillPath()   // contact shadow
            g.saveGState(); g.addPath(Textures.rrect(CGRect(x: 0, y: 0, width: w, height: h), r)); g.clip()
            Textures.linear(g, [(0, rgb(0x41445f)), (1, rgb(0x25273b))], CGPoint(x: 0, y: 0), CGPoint(x: 0, y: h)); g.restoreGState()
            g.addPath(Textures.rrect(CGRect(x: 6, y: 3, width: w - 12, height: 3), 2)); g.setFillColor(rgba(255, 255, 255, 0.10).cgColor); g.fillPath()   // top highlight
            let bar = CGRect(x: w / 2 - w * 0.29, y: h / 2 - 3.5, width: w * 0.58, height: 7)
            if elec {
                g.addPath(Textures.rrect(CGRect(x: 0, y: 0, width: w, height: h), r)); g.setFillColor(rgba(70, 140, 255, 0.38).cgColor); g.fillPath()
                g.addPath(Textures.rrect(CGRect(x: 1, y: 1, width: w - 2, height: h - 2), r)); g.setStrokeColor(rgba(190, 225, 255, 0.88).cgColor); g.setLineWidth(2); g.strokePath()
                g.saveGState(); g.addPath(Textures.rrect(bar, 3.5)); g.clip(); Textures.linear(g, [(0, rgb(0xffffff)), (1, rgb(0x8cc8ff))], CGPoint(x: 0, y: bar.minY), CGPoint(x: 0, y: bar.maxY)); g.restoreGState()
            } else {
                g.saveGState(); g.addPath(Textures.rrect(bar, 3.5)); g.clip(); Textures.linear(g, [(0, rgb(0xffc867)), (1, rgb(0xf08f1c))], CGPoint(x: 0, y: bar.minY), CGPoint(x: 0, y: bar.maxY)); g.restoreGState()
            }
        }
    }
    func blockShape(_ w: CGFloat, _ color: UIColor, key: String) -> SKTexture {
        paint("bshape\(w)\(key)", CGSize(width: w, height: 44)) { g, s in g.addPath(Textures.rrect(CGRect(origin: .zero, size: s), 12)); g.setFillColor(color.cgColor); g.fillPath() }
    }
    func blockRim(_ w: CGFloat) -> SKTexture {   // warm rim light at night
        paint("brim\(w)", CGSize(width: w, height: 44)) { g, s in g.addPath(Textures.rrect(CGRect(x: 0.5, y: 0.5, width: w - 1, height: 43), 12)); g.setStrokeColor(rgba(255, 236, 205, 1).cgColor); g.setLineWidth(1.5); g.strokePath() }
    }

    // MARK: gems
    var gem: SKTexture {
        paint("gem", CGSize(width: 26, height: 26)) { g, s in
            g.saveGState(); g.addPath(Textures.rrect(CGRect(origin: .zero, size: s), 6)); g.clip()
            Textures.linear(g, [(0, rgb(0xffd37a)), (0.55, rgb(0xffad33)), (1, rgb(0xf08f1c))], .zero, CGPoint(x: 26, y: 26)); g.restoreGState()
            g.addPath(Textures.rrect(CGRect(x: 4, y: 4, width: 8, height: 8), 2)); g.setFillColor(rgba(255, 255, 255, 0.55).cgColor); g.fillPath()
        }
    }
    var gemGlow: SKTexture { paint("gemglow", CGSize(width: 60, height: 60)) { g, s in Textures.radial(g, [(0, rgba(255, 200, 103, 0.30)), (1, rgba(255, 200, 103, 0))], CGPoint(x: 30, y: 30), 4, CGPoint(x: 30, y: 30), 30) } }
    var gemMask: SKTexture { paint("gemmask", CGSize(width: 26, height: 26)) { g, s in g.addPath(Textures.rrect(CGRect(origin: .zero, size: s), 6)); g.setFillColor(UIColor.white.cgColor); g.fillPath() } }

    // MARK: the ball, layer by layer (drawn for the left ball; the right one is its mirror image)
    // A glossy glass shell around a softly pulsing energy core, with a rim light and a specular highlight.
    static let R: CGFloat = 20
    func ballGlow(_ P: BallPalette) -> SKTexture {   // drawn at full strength; its opacity carries the glow amount
        let R = Textures.R, gr = R * 2.55
        return paint("bglow\(P.base)", CGSize(width: gr * 2, height: gr * 2)) { g, s in Textures.radial(g, [(0, rgba(P.rgb.0, P.rgb.1, P.rgb.2, 1)), (1, rgba(P.rgb.0, P.rgb.1, P.rgb.2, 0))], CGPoint(x: gr, y: gr), R * 0.7, CGPoint(x: gr, y: gr), gr) }
    }
    var ballShadow: SKTexture { paint("bshadow", CGSize(width: 30, height: 8)) { g, s in g.setFillColor(rgba(43, 45, 66, 0.09).cgColor); g.fillEllipse(in: CGRect(origin: .zero, size: s)) } }
    func ballShell(_ P: BallPalette) -> SKTexture {
        let R = Textures.R, side: CGFloat = -1
        return paint("bshell\(P.base)", CGSize(width: R * 2, height: R * 2)) { g, s in
            g.translateBy(x: R, y: R)
            g.saveGState(); g.addEllipse(in: CGRect(x: -R, y: -R, width: R * 2, height: R * 2)); g.clip()
            Textures.radial(g, [(0, rgb(P.hi)), (0.42, rgb(P.base)), (0.82, rgb(P.lo)), (1, rgb(P.deep))], CGPoint(x: side * R * 0.3, y: -R * 0.36), R * 0.06, CGPoint(x: 0, y: R * 0.08), R * 1.04, extend: true)
            // caustic: light pooling inside the lower glass
            let cx = -side * R * 0.2, cy = R * 0.62
            g.saveGState(); g.addEllipse(in: CGRect(x: cx - R * 0.5, y: cy - R * 0.2, width: R, height: R * 0.4)); g.clip()
            Textures.radial(g, [(0, rgba(255, 255, 255, 0.30)), (1, rgba(255, 255, 255, 0))], CGPoint(x: cx, y: cy), 0, CGPoint(x: cx, y: cy), R * 0.48); g.restoreGState()
            g.restoreGState()
        }
    }
    func ballCore(_ P: BallPalette) -> SKTexture {   // the energy core's brightest state; it breathes through its opacity
        let R = Textures.R, side: CGFloat = -1, cx = -side * R * 0.08, cy = R * 0.14
        return paint("bcore\(P.base)", CGSize(width: R * 2, height: R * 2)) { g, s in
            g.translateBy(x: R, y: R)
            g.addEllipse(in: CGRect(x: -R, y: -R, width: R * 2, height: R * 2)); g.clip()
            Textures.radial(g, [(0, rgba(P.core.0, P.core.1, P.core.2, 0.62)), (0.45, rgba(P.rgb.0, P.rgb.1, P.rgb.2, 0.28)), (1, rgba(P.rgb.0, P.rgb.1, P.rgb.2, 0))], CGPoint(x: cx, y: cy), 0, CGPoint(x: cx, y: cy), R * 0.66)
        }
    }
    /// the slow internal swirl: two faint arcs, centred on the core, that the renderer turns
    var ballSwirl: SKTexture {
        let R = Textures.R
        return paint("bswirl", CGSize(width: R * 1.2, height: R * 1.2)) { g, s in
            let c = CGPoint(x: R * 0.6, y: R * 0.6)
            g.setStrokeColor(rgba(255, 255, 255, 0.16).cgColor); g.setLineWidth(R * 0.07); g.setLineCap(.round)
            g.addArc(center: c, radius: R * 0.5, startAngle: 0, endAngle: 1.1, clockwise: false); g.strokePath()
            g.addArc(center: c, radius: R * 0.32, startAngle: 3.3, endAngle: 4.1, clockwise: false); g.strokePath()
        }
    }
    var ballFlash: SKTexture { paint("bflash", CGSize(width: Textures.R * 2, height: Textures.R * 2)) { g, s in g.setFillColor(UIColor.white.cgColor); g.fillEllipse(in: CGRect(origin: .zero, size: s)) } }
    var ballFresnel: SKTexture {
        let R = Textures.R
        return paint("bfres", CGSize(width: R * 2, height: R * 2)) { g, s in g.setStrokeColor(UIColor.white.cgColor); g.setLineWidth(1.6); g.strokeEllipse(in: CGRect(x: 0.7, y: 0.7, width: R * 2 - 1.4, height: R * 2 - 1.4)) }
    }
    /// rim light, specular oval and the sharp glint, for the left ball
    var ballGloss: SKTexture {
        let R = Textures.R, side: CGFloat = -1
        return paint("bgloss", CGSize(width: R * 2, height: R * 2)) { g, s in
            g.translateBy(x: R, y: R)
            g.setStrokeColor(rgba(255, 255, 255, 0.42).cgColor); g.setLineWidth(R * 0.09); g.setLineCap(.round)
            let ra = CGFloat.pi * 0.18; g.addArc(center: .zero, radius: R * 0.86, startAngle: ra - 0.5, endAngle: ra + 0.5, clockwise: false); g.strokePath()
            g.saveGState(); g.translateBy(x: side * R * 0.36, y: -R * 0.44); g.rotate(by: side * 0.65); g.scaleBy(x: 1, y: 0.55)
            Textures.radial(g, [(0, rgba(255, 255, 255, 0.85)), (0.55, rgba(255, 255, 255, 0.25)), (1, rgba(255, 255, 255, 0))], .zero, 0, .zero, R * 0.42); g.restoreGState()
            g.setFillColor(rgba(255, 255, 255, 0.9).cgColor); g.fillEllipse(in: CGRect(x: side * R * 0.5 - R * 0.065, y: -R * 0.5 - R * 0.065, width: R * 0.13, height: R * 0.13))
        }
    }

    // MARK: crash and finish
    var ring: SKTexture {   // the shockwave's soft inner glow
        paint("ring", CGSize(width: 128, height: 128)) { g, s in Textures.radial(g, [(0, rgba(255, 255, 255, 0)), (0.85, rgba(255, 255, 255, 1)), (1, rgba(255, 255, 255, 0))], CGPoint(x: 64, y: 64), 64 * 0.55, CGPoint(x: 64, y: 64), 64) }
    }
    func goldRibbon(_ w: CGFloat) -> SKTexture {
        paint("gold\(w)", CGSize(width: w, height: 6)) { g, s in g.saveGState(); g.addPath(Textures.rrect(CGRect(origin: .zero, size: s), 3)); g.clip()
            Textures.linear(g, [(0, rgb(0xffcf5a)), (0.5, rgb(0xfff0b8)), (1, rgb(0xffcf5a))], .zero, CGPoint(x: w, y: 0)); g.restoreGState() }
    }
    func ribbonMask(_ w: CGFloat) -> SKTexture { paint("rmask\(w)", CGSize(width: w, height: 6)) { g, s in g.addPath(Textures.rrect(CGRect(origin: .zero, size: s), 3)); g.setFillColor(UIColor.white.cgColor); g.fillPath() } }
    var warmCurtain: SKTexture { paint("curtain", CGSize(width: 8, height: 190)) { g, s in Textures.linear(g, [(0, rgba(255, 214, 120, 0)), (1, rgba(255, 212, 120, 1))], .zero, CGPoint(x: 0, y: 190)) } }
    var warmBand: SKTexture { paint("wband", CGSize(width: 8, height: 320)) { g, s in Textures.linear(g, [(0, rgba(255, 206, 110, 0)), (0.5, rgba(255, 206, 110, 1)), (1, rgba(255, 206, 110, 0))], .zero, CGPoint(x: 0, y: 320)) } }
    func warmWash(_ R: CGFloat) -> SKTexture { paint("wash\(R)", CGSize(width: R * 2, height: R * 2)) { g, s in Textures.radial(g, [(0, rgba(255, 214, 130, 1)), (1, rgba(255, 214, 130, 0.19))], CGPoint(x: R, y: R), 0, CGPoint(x: R, y: R), R, extend: true) } }
    var flashGlow: SKTexture { paint("flash", CGSize(width: 92, height: 92)) { g, s in Textures.radial(g, [(0, rgba(255, 255, 255, 1)), (1, rgba(255, 255, 255, 0))], CGPoint(x: 46, y: 46), 0, CGPoint(x: 46, y: 46), 46) } }
    var comboGlow: SKTexture { paint("cglow", CGSize(width: 92, height: 92)) { g, s in Textures.radial(g, [(0, rgba(255, 200, 103, 0.25)), (1, rgba(255, 200, 103, 0))], CGPoint(x: 46, y: 46), 4, CGPoint(x: 46, y: 46), 46) } }
    var elecGlow: SKTexture { paint("eglow", CGSize(width: 108, height: 108)) { g, s in Textures.radial(g, [(0, rgba(190, 225, 255, 0.55)), (1, rgba(190, 225, 255, 0))], CGPoint(x: 54, y: 54), 10, CGPoint(x: 54, y: 54), 54) } }
    func gradientBar(_ w: CGFloat, _ h: CGFloat) -> SKTexture {   // pink to cyan, as the speed-up meter and countdown ring
        paint("gbar\(w)x\(h)", CGSize(width: w, height: h)) { g, s in g.saveGState(); g.addPath(Textures.rrect(CGRect(origin: .zero, size: s), h / 2)); g.clip()
            Textures.linear(g, [(0, rgb(0xff6b81)), (1, rgb(0x2ec4d6))], .zero, CGPoint(x: w, y: 0)); g.restoreGState() }
    }
}
