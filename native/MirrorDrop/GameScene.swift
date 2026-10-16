// The game, drawn with SpriteKit at the screen's full rate (120 Hz on ProMotion iPhones).
// Game coordinates match the web version (y grows downwards, the field is W x H units); `P()` turns them into SpriteKit's.

import SpriteKit
import UIKit

/// reuses nodes from frame to frame
@MainActor
final class Pool<T: SKNode> {
    private var items: [T] = []
    private var used = 0
    private let make: () -> T
    private weak var parent: SKNode?
    init(_ parent: SKNode, _ make: @escaping () -> T) { self.parent = parent; self.make = make }
    func begin() { used = 0 }
    func next() -> T {
        if used == items.count { let n = make(); parent?.addChild(n); items.append(n) }
        let n = items[used]; used += 1; n.isHidden = false; return n
    }
    func end() { if used < items.count { for i in used..<items.count { items[i].isHidden = true } } }
}

/// a label in the rounded system font; rebuilt only when its text, size or colour changes
@MainActor
final class Text {
    let node = SKLabelNode()
    private var key = ""
    init(_ align: SKLabelHorizontalAlignmentMode = .center, _ v: SKLabelVerticalAlignmentMode = .baseline) { node.horizontalAlignmentMode = align; node.verticalAlignmentMode = v }
    func set(_ s: String, _ size: CGFloat, _ color: UIColor, _ weight: UIFont.Weight = .black, spacing: CGFloat = 0) {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0; color.getRed(&r, green: &g, blue: &b, alpha: &a)
        let k = "\(s)|\(size)|\(Int(r * 255))|\(Int(g * 255))|\(Int(b * 255))|\(weight.rawValue)|\(spacing)"
        if k == key { node.alpha = a; return }
        key = k
        node.attributedText = NSAttributedString(string: s, attributes: [.font: roundedFont(size, weight), .foregroundColor: UIColor(red: r, green: g, blue: b, alpha: 1), .kern: spacing])
        node.alpha = a
    }
}

@MainActor
final class BlockNode: SKNode {
    let motion = SKSpriteNode(), boltShadow = SKSpriteNode(), body = SKSpriteNode(), elecBody = SKSpriteNode(), rim = SKSpriteNode(), arcs = SKShapeNode()
    var w: CGFloat = 0
    func setup(_ tex: Textures, _ w: CGFloat) {
        self.w = w
        if children.isEmpty { for n in [motion, boltShadow, body, elecBody, rim] { addChild(n) }; addChild(arcs) }
        let pad: CGFloat = 8, h: CGFloat = 44
        body.texture = tex.block(w, elec: false); body.size = CGSize(width: w + pad * 2, height: h + pad * 2 + 8)
        body.anchorPoint = CGPoint(x: 0.5, y: (pad + h / 2 + 8) / (h + pad * 2 + 8))
        let ep = w * 0.5
        elecBody.texture = tex.block(w, elec: true); elecBody.size = CGSize(width: w + ep * 2, height: h + ep * 2 + 8)
        elecBody.anchorPoint = CGPoint(x: 0.5, y: (ep + h / 2 + 8) / (h + ep * 2 + 8))
        motion.texture = tex.blockShape(w - 8, rgba(43, 45, 66, 1), key: "m"); motion.size = CGSize(width: w - 8, height: h)
        boltShadow.texture = tex.blockShape(w, rgba(10, 14, 28, 1), key: "s"); boltShadow.size = CGSize(width: w, height: h)
        rim.texture = tex.blockRim(w); rim.size = CGSize(width: w, height: h)
        arcs.strokeColor = rgba(200, 232, 255, 0.85); arcs.lineWidth = 1.4; arcs.lineCap = .round; arcs.lineJoin = .round
    }
}

@MainActor
final class GemNode: SKNode {
    let glow = SKSpriteNode(), spin = SKNode(), crop = SKCropNode(), gem = SKSpriteNode(), shine = SKSpriteNode()
    func setup(_ tex: Textures) {
        guard children.isEmpty else { return }
        glow.texture = tex.gemGlow; glow.size = CGSize(width: 60, height: 60); addChild(glow)
        gem.texture = tex.gem; gem.size = CGSize(width: 26, height: 26)
        let mask = SKSpriteNode(texture: tex.gemMask, size: CGSize(width: 26, height: 26)); crop.maskNode = mask
        shine.texture = tex.white; shine.color = .white; shine.size = CGSize(width: 6, height: 40); shine.alpha = 0.45
        crop.addChild(gem); crop.addChild(shine); spin.addChild(crop); addChild(spin)
    }
}

@MainActor
final class BallNode: SKNode {
    let glow = SKSpriteNode(), shadow = SKSpriteNode(), body = SKNode(), shell = SKSpriteNode(), core = SKSpriteNode(), swirl = SKSpriteNode(), flash = SKSpriteNode(), fresnel = SKSpriteNode(), gloss = SKSpriteNode()
    private var palKey: UInt32 = 0
    func setup(_ tex: Textures) {
        guard children.isEmpty else { return }
        let R = Textures.R
        addChild(glow); addChild(shadow); addChild(body)
        for n in [shell, core, swirl, flash, fresnel, gloss] { body.addChild(n) }
        shadow.texture = tex.ballShadow; shadow.position = CGPoint(x: 0, y: -R * 0.98)
        swirl.texture = tex.ballSwirl; swirl.size = CGSize(width: R * 1.2, height: R * 1.2); swirl.position = CGPoint(x: R * 0.08, y: -R * 0.14)
        flash.texture = tex.ballFlash; flash.size = CGSize(width: R * 2, height: R * 2)
        fresnel.texture = tex.ballFresnel; fresnel.size = CGSize(width: R * 2, height: R * 2)
        gloss.texture = tex.ballGloss; gloss.size = CGSize(width: R * 2, height: R * 2)
    }
    func palette(_ tex: Textures, _ P: BallPalette) {
        guard palKey != P.base else { return }
        palKey = P.base
        let R = Textures.R
        glow.texture = tex.ballGlow(P); glow.size = CGSize(width: R * 5.1, height: R * 5.1)
        shell.texture = tex.ballShell(P); shell.size = CGSize(width: R * 2, height: R * 2)
        core.texture = tex.ballCore(P); core.size = CGSize(width: R * 2, height: R * 2)
    }
    /// r: radius, side: -1 left / +1 right (mirror), sx/sy: squash and stretch, glow, bright: white flash, a: opacity
    func draw(_ tex: Textures, at p: CGPoint, r: CGFloat, P: BallPalette, side: CGFloat, sx: CGFloat = 1, sy: CGFloat = 1, glow g: CGFloat = 0.2, bright: CGFloat = 0, a: CGFloat = 1, t: Double, rimA: CGFloat) {
        palette(tex, P)
        position = p; alpha = a
        let k = r / Textures.R
        glow.setScale(k * (2 + g * 0.55) / 2.55); glow.alpha = 0.18 + g * 0.32
        shadow.size = CGSize(width: r * 0.72 * sx * 2, height: r * 0.4); shadow.position = CGPoint(x: 0, y: -r * 0.98)
        body.xScale = k * sx * (side > 0 ? -1 : 1); body.yScale = k * sy
        let beat = 0.82 + 0.18 * sin(t * 2.6); core.alpha = CGFloat(beat)
        swirl.zRotation = -CGFloat(t * 1.3)
        flash.alpha = bright * 0.55
        fresnel.alpha = 0.22 + rimA * 0.6
    }
}

@MainActor
final class GameScene: SKScene {
    let model: GameModel
    weak var store: GameStore?
    private(set) var tex: Textures!
    private var lastTime: TimeInterval = 0
    private var built = false
    private var builtW = 0.0, builtH = 0.0, builtBW = 0.0

    // layers (back to front)
    private let world = SKEffectNode()           // everything that greys out on a crash
    private let backLayer = SKNode(), guideLayer = SKNode(), weatherBack = SKNode(), thingLayer = SKNode(), ballLayer = SKNode(), fxLayer = SKNode(), frontLayer = SKNode()
    private let overLayer = SKNode()             // crash shards and the win light stay in colour
    private let hud = SKNode()
    private let previewLayer = SKNode()

    // background
    private let bg = SKSpriteNode(), centre = SKSpriteNode(), divBand = SKSpriteNode(), divLine = SKSpriteNode()
    private var guides: Pool<SKSpriteNode>!, blocks: Pool<BlockNode>!, gems: Pool<GemNode>!, parts: Pool<SKSpriteNode>!, floaters: Pool<SKLabelNode>!
    private var shardShapes: Pool<SKShapeNode>!, dropSprites: Pool<SKSpriteNode>!, waveNodes: Pool<SKNode>!, streaks: Pool<SKSpriteNode>!
    private var rainPool: Pool<SKSpriteNode>!, hailPool: Pool<SKSpriteNode>!, glowPool: Pool<SKSpriteNode>!
    private let balls = [BallNode(), BallNode()]
    private let trails = [SKShapeNode(), SKShapeNode(), SKShapeNode(), SKShapeNode()]
    private let arrows = [SKShapeNode(), SKShapeNode()]
    private let link = SKShapeNode(), twinPulse = SKShapeNode()
    private let elecGlows = [SKSpriteNode(), SKSpriteNode()], elecArcs = [SKShapeNode(), SKShapeNode()]
    // finish line
    private let gateNode = SKNode(), gateCurtain = SKSpriteNode(), gateBlob = SKSpriteNode(), gateRibbon = SKSpriteNode(), gateCrop = SKCropNode(), gateShine = SKSpriteNode(), gateLabel = Text()
    private var gateMotes: [SKSpriteNode] = []
    // win light
    private let winBand = SKSpriteNode(), winWash = SKSpriteNode(), winRings = SKShapeNode()
    // crash overlay
    private let deadDark = SKSpriteNode()
    private let desat = CIFilter(name: "CIColorControls")
    // pause fog and countdown
    private let fogBody = SKShapeNode(), fogFall = SKSpriteNode(), fogLip = SKShapeNode(), fogLipShadow = SKShapeNode()
    private let cdNode = SKNode(), cdDisc = SKShapeNode(), cdTrack = SKShapeNode(), cdArc = SKShapeNode(), cdNum = Text(), cdLabel = Text()
    // lightning
    private let boltLayer = SKNode()
    private var boltShapes: Pool<SKShapeNode>!
    private let flashOverlay = SKSpriteNode()
    // HUD
    private let scoreShadow = Text(), scoreText = Text(), levelText = Text(), bestLabel = Text(.right), bestValue = Text(.right), comboText = Text(.center, .center)
    private let scoreNode = SKNode(), comboNode = SKNode(), comboPill = SKSpriteNode(), comboGlow = SKSpriteNode(), barTrack = SKSpriteNode(), barCrop = SKCropNode(), barFill = SKSpriteNode(), barMask = SKSpriteNode()
    private var shownScore = 0
    // menu preview
    private let pvBalls = [BallNode(), BallNode()], pvLink = SKShapeNode(), pvLines = SKShapeNode(), pvDivider = SKSpriteNode()

    init(model: GameModel) {
        self.model = model
        super.init(size: CGSize(width: model.W, height: model.H))
        scaleMode = .fill; anchorPoint = .zero; backgroundColor = .clear
    }
    required init?(coder: NSCoder) { fatalError() }

    private func P(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: x, y: model.H - y) }
    private var W: Double { model.W }
    private var H: Double { model.H }

    override func didMove(to view: SKView) {
        view.isMultipleTouchEnabled = false
        Haptics.shared.view = view
        rebuild()
    }

    /// sets up every node; called again whenever the field changes (columns, screen shape)
    func rebuild() {
        guard let view, view.bounds.width > 0 else { return }
        size = CGSize(width: W, height: H)
        let ppu = view.bounds.width * view.contentScaleFactor / CGFloat(W)
        if tex == nil || abs(tex.k - ppu) > 0.01 { tex = Textures(pixelsPerUnit: ppu) }
        builtW = W; builtH = H; builtBW = model.bw
        removeAllChildren()
        for n in [backLayer, guideLayer, weatherBack, thingLayer, ballLayer, fxLayer, frontLayer] { n.removeAllChildren(); n.removeFromParent(); world.addChild(n) }
        world.removeFromParent(); addChild(world)
        world.shouldEnableEffects = false; world.shouldRasterize = false
        if let desat { desat.setValue(1.0, forKey: kCIInputSaturationKey); world.filter = desat }
        overLayer.removeAllChildren(); overLayer.removeFromParent(); addChild(overLayer); overLayer.zPosition = 50
        hud.removeAllChildren(); hud.removeFromParent(); addChild(hud); hud.zPosition = 100
        previewLayer.removeAllChildren(); previewLayer.removeFromParent(); addChild(previewLayer); previewLayer.zPosition = 90
        for (i, n) in [backLayer, guideLayer, weatherBack, thingLayer, ballLayer, fxLayer, frontLayer].enumerated() { n.zPosition = CGFloat(i) * 5 }

        // background
        bg.texture = tex.background(CGFloat(W), CGFloat(H)); bg.size = CGSize(width: W + 40, height: H + 40); bg.anchorPoint = .zero; bg.position = CGPoint(x: -20, y: -20); backLayer.addChild(bg)
        let R = CGFloat(H * 0.7); centre.texture = tex.centreGlow(R); centre.size = CGSize(width: R * 2, height: R * 2); centre.position = P(W / 2, model.BY); backLayer.addChild(centre)
        divBand.texture = tex.hBand; divBand.size = CGSize(width: 18, height: H + 40); divBand.position = CGPoint(x: W / 2, y: H / 2); backLayer.addChild(divBand)
        divLine.texture = tex.white; divLine.color = rgba(43, 45, 66, 1); divLine.colorBlendFactor = 1; divLine.size = CGSize(width: 2, height: H + 40); divLine.position = CGPoint(x: W / 2, y: H / 2); backLayer.addChild(divLine)

        let t = tex!
        guides = Pool(guideLayer) { let s = SKSpriteNode(texture: t.dash); s.size = CGSize(width: 3, height: 22); s.anchorPoint = CGPoint(x: 0.5, y: 1); return s }
        let bwv = CGFloat(model.bw)
        blocks = Pool(thingLayer) { let b = BlockNode(); b.setup(t, bwv); return b }
        gems = Pool(thingLayer) { let g = GemNode(); g.setup(t); return g }
        parts = Pool(fxLayer) { let s = SKSpriteNode(texture: t.dot); s.colorBlendFactor = 1; return s }
        floaters = Pool(fxLayer) { let l = SKLabelNode(); l.horizontalAlignmentMode = .center; l.verticalAlignmentMode = .baseline; return l }
        streaks = Pool(frontLayer) { let s = SKSpriteNode(texture: t.white); s.colorBlendFactor = 1; s.anchorPoint = CGPoint(x: 0.5, y: 1); return s }
        rainPool = Pool(weatherBack) { let s = SKSpriteNode(texture: t.vFade); s.color = rgba(232, 238, 248, 1); s.colorBlendFactor = 1; s.anchorPoint = CGPoint(x: 0.5, y: 0); return s }
        hailPool = Pool(weatherBack) { let s = SKSpriteNode(texture: t.blob((240, 246, 255))); return s }
        glowPool = Pool(frontLayer) { let s = SKSpriteNode(texture: t.blob((205, 222, 255))); s.blendMode = .screen; return s }
        boltLayer.removeAllChildren(); boltLayer.removeFromParent(); frontLayer.addChild(boltLayer); boltLayer.zPosition = 2
        boltShapes = Pool(boltLayer) { let s = SKShapeNode(); s.lineCap = .round; s.lineJoin = .round; s.fillColor = .clear; return s }
        flashOverlay.texture = t.blob((200, 215, 255)); flashOverlay.blendMode = .screen; flashOverlay.size = CGSize(width: W * 1.6, height: H * 1.2); flashOverlay.position = CGPoint(x: W / 2, y: H / 2); frontLayer.addChild(flashOverlay)

        // finish line
        gateNode.removeAllChildren(); thingLayer.addChild(gateNode); gateNode.zPosition = 2
        gateCurtain.texture = t.warmCurtain; gateCurtain.anchorPoint = CGPoint(x: 0, y: 0); gateCurtain.size = CGSize(width: W + 40, height: 190); gateCurtain.position = CGPoint(x: -20, y: 0); gateNode.addChild(gateCurtain)
        gateBlob.texture = t.blob((255, 200, 100)); gateBlob.blendMode = .screen; gateBlob.size = CGSize(width: W * 1.3, height: 92); gateBlob.position = CGPoint(x: W / 2, y: 0); gateNode.addChild(gateBlob)
        gateRibbon.texture = t.goldRibbon(CGFloat(W - 12)); gateRibbon.size = CGSize(width: W - 12, height: 6); gateRibbon.position = CGPoint(x: W / 2, y: 0); gateNode.addChild(gateRibbon)
        gateCrop.removeAllChildren(); gateCrop.maskNode = SKSpriteNode(texture: t.ribbonMask(CGFloat(W - 12)), size: CGSize(width: W - 12, height: 6)); gateCrop.position = CGPoint(x: W / 2, y: 0); gateNode.addChild(gateCrop)
        gateShine.texture = t.hBand; gateShine.size = CGSize(width: 140, height: 8); gateShine.alpha = 0.95; gateCrop.addChild(gateShine)
        gateMotes = (0..<16).map { _ in let m = SKSpriteNode(texture: t.dot); m.color = rgb(0xffe9a8); m.colorBlendFactor = 1; gateNode.addChild(m); return m }
        gateLabel.node.position = CGPoint(x: W / 2 + 2, y: 16); gateNode.addChild(gateLabel.node)

        // links, trails, balls, arrows
        for s in trails { s.removeFromParent(); s.lineCap = .round; ballLayer.addChild(s) }
        link.removeFromParent(); link.lineWidth = 3; link.lineCap = .round; ballLayer.addChild(link)
        twinPulse.removeFromParent(); twinPulse.lineWidth = 4; twinPulse.lineCap = .round; ballLayer.addChild(twinPulse)
        for (i, b) in balls.enumerated() {
            b.removeFromParent(); b.setup(t); ballLayer.addChild(b); b.zPosition = 2
            elecGlows[i].removeFromParent(); elecGlows[i].texture = t.elecGlow; elecGlows[i].size = CGSize(width: 108, height: 108); ballLayer.addChild(elecGlows[i]); elecGlows[i].zPosition = 3
            elecArcs[i].removeFromParent(); elecArcs[i].strokeColor = rgba(200, 232, 255, 0.95); elecArcs[i].lineWidth = 1.4; elecArcs[i].lineCap = .round; ballLayer.addChild(elecArcs[i]); elecArcs[i].zPosition = 4
            arrows[i].removeFromParent(); arrows[i].strokeColor = rgb(0x2b2d42); arrows[i].lineWidth = 3.2; arrows[i].lineCap = .round; arrows[i].lineJoin = .round; ballLayer.addChild(arrows[i]); arrows[i].zPosition = 3
        }

        // crash and win
        shardShapes = Pool(overLayer) { let s = SKShapeNode(); s.lineWidth = 0; return s }
        dropSprites = Pool(overLayer) { let s = SKSpriteNode(texture: t.dot); s.colorBlendFactor = 1; return s }
        waveNodes = Pool(overLayer) {
            let n = SKNode(); let glow = SKSpriteNode(texture: t.ring); glow.name = "g"; n.addChild(glow)
            for nm in ["c", "w", "a"] { let s = SKShapeNode(); s.name = nm; s.fillColor = .clear; s.lineCap = .round; n.addChild(s) }
            let fl = SKSpriteNode(texture: t.flashGlow); fl.name = "f"; n.addChild(fl); return n
        }
        deadDark.texture = t.white; deadDark.color = rgba(43, 45, 66, 1); deadDark.colorBlendFactor = 1; deadDark.size = CGSize(width: W + 40, height: H + 40); deadDark.position = CGPoint(x: W / 2, y: H / 2); frontLayer.addChild(deadDark); deadDark.zPosition = 20
        winBand.texture = t.warmBand; winBand.size = CGSize(width: W + 40, height: 320); overLayer.addChild(winBand)
        let wr = CGFloat(H * 0.9); winWash.texture = t.warmWash(wr); winWash.size = CGSize(width: wr * 2, height: wr * 2); winWash.position = P(W / 2, model.BY); overLayer.addChild(winWash)
        winRings.fillColor = .clear; overLayer.addChild(winRings)

        // pause fog and countdown
        for n in [fogBody, fogLipShadow, fogLip] as [SKShapeNode] { n.removeFromParent(); frontLayer.addChild(n); n.zPosition = 10 }
        fogFall.removeFromParent(); fogFall.texture = t.vFade; fogFall.color = rgba(248, 245, 241, 1); fogFall.colorBlendFactor = 1; fogFall.anchorPoint = CGPoint(x: 0.5, y: 0); frontLayer.addChild(fogFall); fogFall.zPosition = 9
        fogBody.fillColor = rgb(0xf7f4f0); fogBody.strokeColor = .clear
        fogLipShadow.strokeColor = rgba(43, 45, 66, 0.06); fogLipShadow.lineWidth = 8; fogLipShadow.lineCap = .round; fogLipShadow.fillColor = .clear
        fogLip.strokeColor = rgba(255, 255, 255, 0.95); fogLip.lineWidth = 2; fogLip.lineCap = .round; fogLip.fillColor = .clear
        cdNode.removeAllChildren(); cdNode.removeFromParent(); frontLayer.addChild(cdNode); cdNode.zPosition = 12
        cdDisc.path = CGPath(ellipseIn: CGRect(x: -62, y: -62, width: 124, height: 124), transform: nil); cdDisc.fillColor = rgba(255, 255, 255, 0.7); cdDisc.strokeColor = .clear; cdNode.addChild(cdDisc)
        cdTrack.path = CGPath(ellipseIn: CGRect(x: -56, y: -56, width: 112, height: 112), transform: nil); cdTrack.strokeColor = rgba(43, 45, 66, 0.08); cdTrack.lineWidth = 6; cdTrack.fillColor = .clear; cdNode.addChild(cdTrack)
        cdArc.strokeColor = rgb(0xb093ac); cdArc.lineWidth = 6; cdArc.lineCap = .round; cdArc.fillColor = .clear; cdNode.addChild(cdArc)
        cdNode.addChild(cdNum.node); cdNode.addChild(cdLabel.node)

        // HUD
        hud.addChild(scoreNode); scoreNode.addChild(scoreShadow.node); scoreNode.addChild(scoreText.node); scoreShadow.node.position = CGPoint(x: 0, y: -3)
        for t2 in [levelText, bestLabel, bestValue] { hud.addChild(t2.node) }
        hud.addChild(comboNode); comboGlow.texture = t.comboGlow; comboGlow.size = CGSize(width: 92, height: 92); comboNode.addChild(comboGlow)
        comboPill.texture = t.pill(64, 32); comboPill.alpha = 0.82; comboNode.addChild(comboPill); comboNode.addChild(comboText.node)
        barTrack.texture = t.pill(160, 6); barTrack.color = rgba(43, 45, 66, 1); barTrack.colorBlendFactor = 1; barTrack.alpha = 0.08; barTrack.size = CGSize(width: 160, height: 6); hud.addChild(barTrack)
        barFill.texture = t.gradientBar(160, 6); barFill.size = CGSize(width: 160, height: 6); barFill.anchorPoint = CGPoint(x: 0, y: 0.5)
        barMask.texture = t.pill(160, 6); barMask.size = CGSize(width: 160, height: 6); barMask.anchorPoint = CGPoint(x: 0, y: 0.5)
        barCrop.removeAllChildren(); barCrop.maskNode = barMask; barCrop.addChild(barFill); hud.addChild(barCrop)

        // menu preview
        for b in pvBalls { b.removeFromParent(); b.setup(t); previewLayer.addChild(b) }
        pvLines.removeFromParent(); pvLines.strokeColor = rgba(43, 45, 66, 0.06); pvLines.lineWidth = 2; pvLines.lineCap = .round; previewLayer.addChild(pvLines)
        pvLink.removeFromParent(); pvLink.strokeColor = rgba(43, 45, 66, 0.16); pvLink.lineWidth = 2.4; pvLink.lineCap = .round; previewLayer.addChild(pvLink)
        pvDivider.removeFromParent(); pvDivider.texture = t.hBand; previewLayer.addChild(pvDivider)
        built = true
    }

    // MARK: input
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard model.state == .play else { return }
        model.tap()
    }

    // MARK: frame
    override func update(_ currentTime: TimeInterval) {
        let dt = lastTime == 0 ? 1.0 / 120 : min(0.033, max(0, currentTime - lastTime)); lastTime = currentTime
        if let v = view, v.bounds.width > 0 {   // first real size, a new screen shape, or new columns: set everything up again
            let ppu = v.bounds.width * v.contentScaleFactor / CGFloat(W)
            if !built || abs(builtW - W) > 0.1 || abs(builtH - H) > 0.1 || abs(builtBW - model.bw) > 0.1 || abs((tex?.k ?? 0) - max(1, ppu)) > 0.01 { rebuild() }
        }
        guard built else { return }
        model.update(dt)
        store?.handle(model.takeEvents())
        render()
        store?.frame(self)
    }

    var skyE: Double { (model.state != .menu && model.wxKind != nil && model.wxA >= 0.005) ? model.wxA * model.wxA * (3 - 2 * model.wxA) : 0 }
    private func hudInk(_ al: Double) -> UIColor { let k = model.uiNight; return rgba(CGFloat(43 + 202 * k), CGFloat(45 + 202 * k), CGFloat(66 + 186 * k), CGFloat(al + (1 - al) * k * 0.5)) }

    private func render() {
        let m = model, t = m.t, BY = m.BY, sE = skyE, bgA = 1 - sE
        let rimA = CGFloat(m.uiNight * 0.8)
        // backdrop: it gives way to the event's sky
        bg.alpha = CGFloat(bgA)
        let pulseA = m.fxA * m.fxA; centre.alpha = CGFloat(bgA * (0.35 + pulseA * 0.25)); centre.position = P(W / 2, BY)
        let dk = max(m.pulse * 0.5, m.fxA); divBand.xScale = CGFloat(2 * (9 + dk * 24)) / 18; divBand.alpha = CGFloat((0.28 + dk * 0.5) * (1 - sE * 0.85)); divLine.alpha = CGFloat((0.07 + dk * 0.06) * (1 - sE * 0.85))
        let sk = UIAccessibility.isReduceMotionEnabled ? 0 : m.shake
        world.position = CGPoint(x: (rnd() - 0.5) * sk, y: (rnd() - 0.5) * sk)
        let playing = m.state != .menu
        for n in [guideLayer, weatherBack, thingLayer, ballLayer, fxLayer, frontLayer, overLayer, hud] { n.isHidden = !playing }
        previewLayer.isHidden = playing
        if !playing { renderPreview(); return }

        // column guides
        guides.begin()
        let off = (t * m.speed * 0.5).truncatingRemainder(dividingBy: 64)
        for x in m.LX { var y = -64 + off; while y < H { let s = guides.next(); s.position = P(x, y); y += 64 } }
        guides.end()

        renderWeatherBack(sE)

        // blocks and gems
        blocks.begin(); gems.begin()
        let motion = clamp01((m.speed - 450) / 500), bk = m.wxKind == .storm ? m.boltK : 0
        for o in m.things {
            let x = m.bxOf(o)
            if o.kind == .gem {
                let g = gems.next(); g.position = P(x, o.y)
                let s = 1 + sin(t * 5 + o.ph) * 0.06
                g.spin.zRotation = -CGFloat(Double.pi / 4 + sin(t * 2.4 + o.ph) * 0.18); g.spin.setScale(CGFloat(s))
                let sw = ((t * 0.9 + o.ph).truncatingRemainder(dividingBy: 2.2)) * 40 - 40
                g.shine.position = CGPoint(x: sw - 1 - 13 + 13, y: 0)
                continue
            }
            let b = blocks.next()
            if abs(b.w - CGFloat(m.bw)) > 0.1 { b.setup(tex, CGFloat(m.bw)) }
            b.position = P(x, o.y); b.xScale = 1; b.yScale = 1
            if let hit = o.hitAt, m.state == .dead {   // the block takes the hit: a short jolt and squash
                let k = max(0, m.fx.dead - hit), dmp = max(0, 1 - k / 0.3), sq = max(0, 1 - k / 0.18)
                b.position = P(x + sin(k * 75) * 3.2 * dmp, o.y - 3 * sq); b.xScale = CGFloat(1 + 0.07 * sq); b.yScale = CGFloat(1 - 0.13 * sq)
            }
            b.body.isHidden = o.elec; b.elecBody.isHidden = !o.elec
            let mo = m.state == .dead ? 0 : motion
            b.motion.isHidden = mo <= 0 || o.elec; b.motion.alpha = CGFloat(0.05 * mo); b.motion.position = CGPoint(x: 0, y: 26 * mo)
            b.rim.isHidden = rimA <= 0 || o.elec; b.rim.alpha = 0.55 * rimA
            if bk > 0.08, let bolt = m.bolt, !o.elec { let sx2: Double = (x - bolt.pts[0].x) >= 0 ? 1 : -1; b.boltShadow.isHidden = false; b.boltShadow.alpha = CGFloat(0.4 * bk); b.boltShadow.position = CGPoint(x: sx2 * 14 * bk, y: -16 * bk) } else { b.boltShadow.isHidden = true }
            if o.elec { b.arcs.isHidden = false; b.arcs.path = arcsPath(0, 0, Double(b.w) * 0.55, 44 * 0.6, 3); b.elecBody.alpha = 1 } else { b.arcs.isHidden = true }
        }
        blocks.end(); gems.end()

        renderGate()

        // the mirror link between the pair
        if m.state != .dead {
            link.isHidden = false
            link.strokeColor = m.uiNight > 0.5 ? rgba(235, 240, 255, CGFloat(0.3 + m.pulse * 0.1)) : rgba(43, 45, 66, CGFloat(0.16 + m.pulse * 0.1))
            let p = CGMutablePath(); p.move(to: P(m.bx[0], BY)); p.addLine(to: P(m.bx[1], BY))
            link.path = p.copy(dashingWithPhase: 0, lengths: [1, 9])
        } else { link.isHidden = true }
        twinPulse.isHidden = true
        if m.state == .dead, let tw = m.crashBall[1 - m.crashFirst], tw.chain, !tw.burst {   // a bright pulse races along the link to the twin
            let a0 = m.bx[m.crashFirst], a1 = m.bx[1 - m.crashFirst], pr = clamp01(m.fx.dead / max(0.01, tw.at)), xp = a0 + (a1 - a0) * pr
            let p = CGMutablePath(); p.move(to: P(a0 + (xp - a0) * 0.5, BY)); p.addLine(to: P(xp, BY))
            twinPulse.path = p; twinPulse.strokeColor = tw.elec ? rgba(190, 225, 255, 0.95) : rgba(255, 255, 255, 0.95); twinPulse.isHidden = false
        }

        // the balls: identical size, timing, glow and squash; highlight mirrored
        let fx = m.fx
        let glow = min(1, 0.15 + min(0.35, abs(m.bv[0]) / 3000) + fx.gem * 0.5 + fx.near * 0.45 + fx.squash * 0.35 + m.fxA * 0.3)
        let st = min(0.16, abs(m.bv[0]) / 4500)
        let sx = (1 + st) * (1 - 0.12 * fx.squash), sy = (1 - st * 0.7) * (1 + 0.09 * fx.squash)
        let r = 20 * (1 + m.pulse * 0.04 + fx.gem * 0.08)
        for i in 0..<2 {
            let x = m.bx[i], Pl = PAL[i], side: CGFloat = i == 1 ? 1 : -1, ball = balls[i]
            // short motion trail
            let tr = m.trail[i]
            if !tr.isEmpty && m.state != .dead {
                let p1 = CGMutablePath(); p1.move(to: P(tr[0], BY)); p1.addLine(to: P(x, BY)); trails[i * 2].path = p1; trails[i * 2].strokeColor = rgb(Pl.base, 0.12); trails[i * 2].lineWidth = 28; trails[i * 2].isHidden = false
                let p2 = CGMutablePath(); p2.move(to: P(tr[tr.count >> 1], BY)); p2.addLine(to: P(x, BY)); trails[i * 2 + 1].path = p2; trails[i * 2 + 1].strokeColor = rgb(Pl.base, 0.2); trails[i * 2 + 1].lineWidth = 36; trails[i * 2 + 1].isHidden = false
            } else { trails[i * 2].isHidden = true; trails[i * 2 + 1].isHidden = true }
            elecGlows[i].isHidden = true; elecArcs[i].isHidden = true
            let c = m.state == .dead ? m.crashBall[i] : nil
            ball.isHidden = false
            if c == nil {
                ball.draw(tex, at: P(x, BY), r: CGFloat(r), P: Pl, side: side, sx: CGFloat(sx), sy: CGFloat(sy), glow: CGFloat(m.state == .dead ? 0.25 : glow), bright: CGFloat(fx.gem * 0.8), t: t, rimA: rimA)
            } else if let c, c.chain, !c.burst, !c.elec {   // charging as the pulse arrives
                let q = clamp01(fx.dead / c.at)
                ball.draw(tex, at: P(x, BY), r: CGFloat(r * (1 + 0.12 * q)), P: Pl, side: side, sx: CGFloat(1 + 0.06 * q), sy: CGFloat(1 - 0.05 * q), glow: CGFloat(0.6 + q * 0.4), bright: CGFloat(q * 0.9), t: t, rimA: rimA)
            } else if let c, c.elec, !c.burst {   // electrocution: blue-white flash wrapped in small arcs, then it bursts
                ball.draw(tex, at: P(x, BY), r: CGFloat(r * (1 + 0.06 * rnd())), P: ELEC, side: side, glow: 1, bright: 0.85, t: t, rimA: rimA)
                elecGlows[i].isHidden = false; elecGlows[i].position = P(x, BY)
                elecArcs[i].isHidden = false; elecArcs[i].path = arcsPath(x, BY, 24, 24, 6)
            } else if let c {   // impact frame: the ball squashes flat and flares white as it bursts, gone within ~60 ms
                let k = clamp01((fx.dead - c.bt) / 0.06)
                if k < 1 { ball.draw(tex, at: P(x, BY + 3), r: CGFloat(r), P: c.elec ? ELEC : Pl, side: side, sx: CGFloat(1.32 + 0.25 * k), sy: CGFloat(0.7 - 0.3 * k), glow: 1, bright: 1, a: CGFloat(1 - k), t: t, rimA: rimA) } else { ball.isHidden = true }
            }
            if m.state == .play {
                let nd = Double(m.nextDir), dir = (x < W / 2 ? 1.0 : -1.0) * nd, nudge = easeOut(fx.arrow), ox = x + dir * (33 + nudge * 5)
                let p = CGMutablePath(); p.move(to: P(ox, BY - 6.5)); p.addLine(to: P(ox + dir * 6.5, BY)); p.addLine(to: P(ox, BY + 6.5))
                arrows[i].path = p; arrows[i].alpha = CGFloat(0.32 + fx.arrow * 0.4); arrows[i].isHidden = false
                arrows[i].strokeColor = m.uiNight > 0.5 ? rgba(235, 240, 255, 1) : rgb(0x2b2d42)
            } else { arrows[i].isHidden = true }
        }

        // sparks and score pops
        parts.begin()
        for q in m.parts { let s = parts.next(); s.position = P(q.x, q.y); s.size = CGSize(width: q.r * 2, height: q.r * 2); s.color = rgb(q.col); s.alpha = CGFloat(max(0, q.life / q.max)) }
        parts.end()
        floaters.begin()
        for f in m.floaters { let l = floaters.next(); l.position = P(f.x, f.y); l.attributedText = NSAttributedString(string: f.txt, attributes: [.font: roundedFont(22, .black), .foregroundColor: rgb(f.col)]); l.alpha = CGFloat(f.life) }
        floaters.end()

        renderStorm()
        renderSpeedStreaks()
        renderPauseFog()
        renderCountdown()

        // a crash greys out the frozen scene
        if m.state == .dead && !m.won {
            let k = clamp01(m.fx.dead / 0.4)
            world.shouldEnableEffects = true; desat?.setValue(1 - k * 0.55, forKey: kCIInputSaturationKey)
            deadDark.isHidden = false; deadDark.alpha = CGFloat(k * 0.1)
        } else { world.shouldEnableEffects = false; deadDark.isHidden = true }
        renderWinLight()
        renderCrash()
        renderHUD()
    }

    /// small flickering electric arcs around a shape (centre in game coordinates when x/y are given, else around 0,0 in node space)
    private func arcsPath(_ x: Double, _ y: Double, _ rw: Double, _ rh: Double, _ n: Int) -> CGPath {
        let p = CGMutablePath()
        let local = x == 0 && y == 0
        for _ in 0..<n {
            let ang = rnd() * 6.283, sx = x + cos(ang) * rw, sy = y + sin(ang) * rh, len = 8 + rnd() * 10, d = ang + (rnd() - 0.5)
            let pts = [(sx, sy), (sx + cos(d) * len * 0.5 + (rnd() - 0.5) * 6, sy + sin(d) * len * 0.5 + (rnd() - 0.5) * 6), (sx + cos(d) * len, sy + sin(d) * len)]
            for (j, q) in pts.enumerated() { let pt = local ? CGPoint(x: q.0, y: -q.1) : P(q.0, q.1); if j == 0 { p.move(to: pt) } else { p.addLine(to: pt) } }
        }
        return p
    }

    // MARK: finish line and win light
    private func renderGate() {
        let m = model
        guard let gate = m.gate, gate.y > -220, gate.y < H + 120 else { gateNode.isHidden = true; return }
        let hit = m.won ? max(0, 1 - m.fx.dead / 0.9) : 0, fade = m.won ? max(0, 1 - m.fx.dead / 1.6) : 1, br = (1 + hit * 1.2) * fade, intro = smooth(gate.t / 0.6)
        guard br >= 0.01 else { gateNode.isHidden = true; return }
        gateNode.isHidden = false; gateNode.position = CGPoint(x: 0, y: H - gate.y)
        gateCurtain.alpha = CGFloat(intro * min(0.6, 0.26 * br))
        gateBlob.alpha = CGFloat(intro * min(1, 0.75 * br))
        gateRibbon.alpha = CGFloat(intro * min(1, fade + hit)); gateCrop.alpha = gateRibbon.alpha
        let sx = (gate.t * 260).truncatingRemainder(dividingBy: W + 240) - 120; gateShine.position = CGPoint(x: sx - W / 2, y: 0)
        for (k, mote) in gateMotes.enumerated() {
            let sd = SEEDS[k], ph = (gate.t * (0.45 + sd.k * 0.3) + sd.s).truncatingRemainder(dividingBy: 1), x = sd.x * W + sin(ph * 6 + Double(k)) * 6
            mote.position = CGPoint(x: x, y: 4 + ph * 130); let rr = 0.9 + sd.k * 0.9; mote.size = CGSize(width: rr * 2, height: rr * 2); mote.alpha = CGFloat(intro * (1 - ph) * min(1, br) * 0.9)
        }
        gateLabel.set("FINISH", 12, rgba(214, 150, 30, 0.95), .black, spacing: 4); gateLabel.node.alpha *= CGFloat(intro * min(1, fade))
    }
    private func renderWinLight() {
        let m = model
        guard m.state == .dead && m.won else { winBand.isHidden = true; winWash.isHidden = true; winRings.isHidden = true; return }
        let k = m.fx.dead, y = m.BY - k * 560, a = max(0, 1 - k / 1.9)
        winBand.isHidden = a <= 0; winBand.position = P(W / 2, y); winBand.alpha = CGFloat(0.28 * a)
        let wash = 0.14 * min(1, k / 0.25) * max(0.5, 1 - k / 2.6); winWash.isHidden = false; winWash.alpha = CGFloat(wash * 1.6)
        let p = CGMutablePath()
        winRings.isHidden = false
        // rings ripple out, one after another (gold first, then white)
        for i in 0..<2 { for r in 0..<3 { let q = (k - Double(r) * 0.18) / 1.1; if q <= 0 || q >= 1 { continue }; let rad = 18 + smooth(q) * 120; p.addEllipse(in: CGRect(x: m.bx[i] - rad, y: H - m.BY - rad, width: rad * 2, height: rad * 2)) } }
        winRings.path = p; winRings.strokeColor = rgba(255, 236, 190, 0.7 * CGFloat(a)); winRings.lineWidth = 2
    }

    // MARK: crash
    private func renderCrash() {
        let m = model
        waveNodes.begin()
        for w in m.waves {   // translucent shockwave + a glossy refraction glint sweeping around it
            let n = waveNodes.next(), k = w.t / 0.5, e = easeOut(k), R = 18 + e * 120, Pl = w.el ? ELEC : PAL[w.i]
            n.position = P(w.x, w.y)
            if let g = n.childNode(withName: "g") as? SKSpriteNode { g.size = CGSize(width: R * 2, height: R * 2); g.alpha = CGFloat(0.16 * (1 - k)) }
            if let c = n.childNode(withName: "c") as? SKShapeNode { c.path = CGPath(ellipseIn: CGRect(x: -R * 0.92, y: -R * 0.92, width: R * 1.84, height: R * 1.84), transform: nil); c.strokeColor = rgba(Pl.rgb.0, Pl.rgb.1, Pl.rgb.2, CGFloat(0.35 * (1 - k))); c.lineWidth = CGFloat(7 * (1 - k)) }
            if let c = n.childNode(withName: "w") as? SKShapeNode { c.path = CGPath(ellipseIn: CGRect(x: -R, y: -R, width: R * 2, height: R * 2), transform: nil); c.strokeColor = rgba(255, 255, 255, CGFloat(0.8 * (1 - k))); c.lineWidth = CGFloat(2.4 * (1 - k) + 0.4) }
            if let c = n.childNode(withName: "a") as? SKShapeNode {
                let ga = (w.i == 1 ? Double.pi - 1.2 : -1.2) + (w.i == 1 ? -1 : 1) * k * 5, p = CGMutablePath()
                p.addArc(center: .zero, radius: R * 0.78, startAngle: -ga, endAngle: -(ga + 0.8), clockwise: true)
                c.path = p; c.strokeColor = rgba(255, 255, 255, CGFloat(0.7 * (1 - k))); c.lineWidth = CGFloat(5 * (1 - k))
            }
            if let f = n.childNode(withName: "f") as? SKSpriteNode { f.isHidden = w.t >= 0.12; f.alpha = CGFloat(1 - w.t / 0.12); f.position = CGPoint(x: 0, y: -12) }
        }
        waveNodes.end()
        shardShapes.begin(); dropSprites.begin()
        for f in m.shards {
            let Pl = f.el ? ELEC : PAL[f.i], al = CGFloat(clamp01(f.life / f.max * 1.5))
            switch f.kind {
            case .shard:   // curved glass shard with a lit edge
                let s = shardShapes.next(), p = CGMutablePath(), v = f.verts
                p.move(to: CGPoint(x: v[0].x, y: -v[0].y))
                for k in 1...v.count { let p0 = v[k - 1], p1 = v[k % v.count]; p.addQuadCurve(to: CGPoint(x: p1.x, y: -p1.y), control: CGPoint(x: (p0.x + p1.x) * 0.62, y: -(p0.y + p1.y) * 0.62)) }
                p.closeSubpath(); s.path = p
                s.fillColor = f.tint < 0.5 ? rgb(Pl.hi) : rgb(Pl.base); s.strokeColor = rgba(255, 255, 255, 0.75); s.lineWidth = 1.0
                s.position = P(f.x, f.y); s.zRotation = -CGFloat(f.rot); s.xScale = CGFloat(f.m); s.alpha = al
            case .zap:   // electric spark streak
                let s = shardShapes.next(), p = CGMutablePath()
                p.move(to: CGPoint(x: -f.sz, y: 0)); p.addLine(to: CGPoint(x: -f.sz * 0.3, y: -2.5)); p.addLine(to: CGPoint(x: f.sz * 0.3, y: 2.5)); p.addLine(to: CGPoint(x: f.sz, y: 0))
                s.path = p; s.fillColor = .clear; s.strokeColor = rgba(220, 240, 255, 0.95); s.lineWidth = 1.6; s.lineCap = .round
                s.position = P(f.x, f.y); s.zRotation = -CGFloat(atan2(f.vy, f.vx)); s.xScale = 1; s.alpha = al
            case .drop:   // droplet stretched along its motion
                let s = dropSprites.next(), sp = hypot(f.vx, f.vy), len = f.sz * (1 + sp / 260)
                s.size = CGSize(width: len * 2, height: f.sz * 2); s.color = f.white ? rgba(255, 255, 255, 1) : rgb(Pl.base); s.position = P(f.x, f.y); s.zRotation = -CGFloat(atan2(f.vy, f.vx)); s.alpha = al * (f.white ? 0.95 : 1)
            }
        }
        shardShapes.end(); dropSprites.end()
    }

    // MARK: pause fog, countdown, speed-up streaks
    private func renderPauseFog() {
        let m = model, fogVis = m.resumeT > 0 || m.state == .paused ? 1 : clamp01(m.fogT / 0.8)
        guard m.fog > 0 && fogVis > 0 else { for n in [fogBody, fogLip, fogLipShadow] { n.isHidden = true }; fogFall.isHidden = true; return }
        let t = m.t, fy = min(m.BY - 110, (m.BY - 60) * min(0.88, 0.3 * Double(m.fog) + 0.15))
        let edge: (Double) -> Double = { x in fy + sin((abs(x - self.W / 2) / self.W) * 9 - t * 1.1) * 7 + sin(t * 0.7) * 3 }
        let body = CGMutablePath(); body.move(to: P(-20, -20)); body.addLine(to: P(W + 20, -20))
        var x = W + 20; while x >= -20 { body.addLine(to: P(x, edge(x))); x -= 10 }
        body.closeSubpath()
        let lip = CGMutablePath(); x = -20; while x <= W + 20 { if x == -20 { lip.move(to: P(x, edge(x))) } else { lip.addLine(to: P(x, edge(x))) }; x += 10 }
        for n in [fogBody, fogLip, fogLipShadow] { n.isHidden = false; n.alpha = CGFloat(fogVis) }
        fogBody.path = body; fogLip.path = lip; fogLipShadow.path = lip; fogLipShadow.position = CGPoint(x: 0, y: -4)
        fogFall.isHidden = false; fogFall.alpha = CGFloat(0.92 * fogVis); fogFall.size = CGSize(width: W + 40, height: 130); fogFall.position = P(W / 2, fy - 10); fogFall.yScale = -1   // soft falloff below the lip so blocks emerge gradually
    }
    private func renderCountdown() {
        let m = model
        guard m.state == .play && m.resumeT > 0 else { cdNode.isHidden = true; return }
        cdNode.isHidden = false; cdNode.position = P(W / 2, H * 0.42)
        let frac = m.resumeT - floor(m.resumeT), pop = 1 + 0.22 * max(0, frac - 0.7) / 0.3
        let p = CGMutablePath(); p.addArc(center: .zero, radius: 56, startAngle: .pi / 2, endAngle: .pi / 2 - .pi * 2 * CGFloat(m.resumeT / 3), clockwise: true); cdArc.path = p
        cdNum.set("\(Int(ceil(m.resumeT)))", 64, rgb(0x2b2d42)); cdNum.node.position = CGPoint(x: 0, y: -22); cdNum.node.setScale(CGFloat(pop))
        cdLabel.set("get ready", 18, rgba(43, 45, 66, 0.5), .bold); cdLabel.node.position = CGPoint(x: 0, y: -96)
    }
    private func renderSpeedStreaks() {
        let m = model
        streaks.begin()
        if m.fxA > 0 && m.state == .play {
            for i in 0..<10 {
                let x = Double((i * 53 + 17) % Int(W)), y = (m.t * 1400 + Double(i) * 137).truncatingRemainder(dividingBy: H + 240) - 120, len = 80 + Double(i % 3) * 30
                let s = streaks.next(); s.position = P(x, y); s.size = CGSize(width: 2.5, height: len); s.color = i % 2 == 1 ? rgb(0x2ec4d6) : rgb(0xff6b81); s.alpha = CGFloat(m.fxA * 0.28)
            }
        }
        streaks.end()
    }

    // MARK: weather in front of and behind the game
    private func renderWeatherBack(_ sE: Double) {
        let m = model, a = m.wxA, t = m.t
        rainPool.begin(); hailPool.begin()
        if m.wxKind == .storm && a > 0.01 {   // individual drops: streaks scaled by depth (near = longer, wider, faster)
            let e = a * a * (3 - 2 * a), lit = 1 + m.boltK * 0.8, slq = 0.022
            for d in WeatherBits.rain {
                let sp = 600 + d.z * 950, x = (d.x * (W + 80) + t * sp * slq * d.s).truncatingRemainder(dividingBy: W + 80) - 40, y = (d.y * (H + 80) + t * sp * d.s).truncatingRemainder(dividingBy: H + 80) - 40
                let s = rainPool.next(); s.position = P(x, y); s.size = CGSize(width: 1.2 + d.z * 0.8, height: d.l); s.zRotation = -0.02; s.alpha = CGFloat(min(1, e * (0.14 + d.z * 0.46) * (0.55 + 0.45 * d.v) * lit))
            }
        }
        if m.wxKind == .hail && a > 0.01 {   // ice beads of uneven size and speed, drifting slightly
            for d in WeatherBits.hail {
                let sway = nz(t * 0.8, d.x * 40) * 14, x = (d.x * (W + 40) + t * 40 * d.s).truncatingRemainder(dividingBy: W + 40) - 20 + sway, y = (d.y * (H + 60) + t * 600 * d.s).truncatingRemainder(dividingBy: H + 60) - 30
                let s = hailPool.next(); s.position = P(x, y); s.size = CGSize(width: d.r * 2.6, height: d.r * 2.85); s.alpha = CGFloat(0.8 * a)
            }
        }
        rainPool.end(); hailPool.end()
    }
    private func renderStorm() {
        let m = model
        boltShapes.begin(); glowPool.begin()
        let e = m.wxA * m.wxA * (3 - 2 * m.wxA), ch = m.cloudH
        flashOverlay.isHidden = true
        if m.wxKind == .storm || m.wxKind == .hail, m.wxA > 0.01 {
            // light inside the cloud deck: blooms along a crawler's path as it races through, or one hidden glow
            for gl in m.glows {
                let k = gl.pts != nil ? max(m.flashK(t: gl.t, pre: 0, lead: gl.lead, st: gl.st), gl.t < gl.lead ? 0.25 : 0) : m.flashK(t: gl.t, pre: 0, lead: gl.lead, st: gl.st)
                let kk = k * e; if kk < 0.02 { continue }
                if let pts = gl.pts {
                    let n = gl.t < gl.lead ? Int(Double(pts.count) * gl.t / gl.lead) : pts.count
                    var i = 0; while i < n { let p = pts[i], R = 46 + Double(i * 37 % 30); let s = glowPool.next(); s.position = P(p.x, p.y); s.size = CGSize(width: R * 3.2, height: R * 1.6); s.alpha = CGFloat(min(1, 0.5 * kk)); i += 5 }
                    channel(pts: pts, br: gl.br, t: gl.t, pre: 0, lead: gl.lead, k: k * e, wGlow: 5, target: nil)
                } else { let R = W * 0.42 * gl.r; let s = glowPool.next(); s.position = P(gl.x, gl.y); s.size = CGSize(width: R * 3, height: R * 1.1); s.alpha = CGFloat(min(1, 1.1 * kk)) }
            }
            if let b = m.bolt {
                if b.pre > 0 && b.t < b.pre + b.lead {   // the cloud flickers where the strike is building
                    let q = clamp01(b.t / b.pre), fl = 0.55 + 0.45 * sin(b.t * 47) * sin(b.t * 13 + 1), R = W * (0.22 + 0.12 * q)
                    let s = glowPool.next(); s.position = P(b.pts[0].x, ch * 0.3); s.size = CGSize(width: R * 3, height: R); s.alpha = CGFloat(min(1, (0.12 + 0.55 * q * q) * fl * e))
                }
                let bk = m.boltK
                if bk > 0 { let R = W * 0.6; let s = glowPool.next(); s.position = P(b.pts[0].x, ch * 0.45); s.size = CGSize(width: R * 2.8, height: R * 1.2); s.alpha = CGFloat(min(1, bk * e))
                    flashOverlay.isHidden = false; flashOverlay.alpha = CGFloat(0.28 * bk * e) }
                // the strike, in front of the cloud: leader, return stroke, re-strikes, a glow where it lands
                channel(pts: b.pts, br: b.br, t: b.t, pre: b.pre, lead: b.lead, k: bk, wGlow: 7, target: b.o)
                if bk > 0.02 { let end = b.o.map { Pt(x: m.bxOf($0), y: $0.y - 22) } ?? b.pts[b.pts.count - 1]
                    let s = glowPool.next(); s.texture = tex.blob((200, 215, 255)); s.position = P(end.x, end.y); s.size = CGSize(width: 160, height: 80); s.alpha = CGFloat(min(1, bk)) }
            }
        }
        boltShapes.end(); glowPool.end()
    }
    /// the stepped leader creeps out faintly, then the return stroke lights the whole channel
    private func channel(pts: [Pt], br: [Fork], t bt: Double, pre: Double, lead: Double, k: Double, wGlow: Double, target: Thing?) {
        let tl = bt - pre; if tl < 0 { return }
        let leading = tl < lead
        let p = leading ? (pre > 0 ? floor(tl / lead * 13 + rnd() * 0.6) / 13 : tl / lead) : 1
        let n = max(2, Int(Double(pts.count) * p))
        var main = Array(pts.prefix(n))
        if let o = target, !leading { main[main.count - 1] = Pt(x: model.bxOf(o), y: o.y - 22) }
        let tt = max(0, tl - lead), after = leading ? 0 : 0.22 * exp(-tt * 5)
        let I = leading ? 0.14 + rnd() * 0.14 : max(k, after)
        if I < 0.02 { return }
        func path(_ P2: [Pt]) -> CGPath { let pa = CGMutablePath(); for (i, q) in P2.enumerated() { if i == 0 { pa.move(to: P(q.x, q.y)) } else { pa.addLine(to: P(q.x, q.y)) } }; return pa }
        let mp = path(main)
        for (col, al, w) in [((140.0, 150.0, 255.0), 0.22, wGlow * 2.2), ((185.0, 200.0, 255.0), 0.45, wGlow)] {
            let s = boltShapes.next(); s.path = mp; s.strokeColor = rgba(CGFloat(col.0), CGFloat(col.1), CGFloat(col.2), CGFloat(al * I)); s.lineWidth = CGFloat(w); s.blendMode = .screen
        }
        for f in br where f.i0 <= n {
            let mm = leading ? max(2, Int(Double(f.pts.count) * min(1, Double(n - f.i0) / (Double(pts.count) * 0.25)))) : f.pts.count
            let fp = path(Array(f.pts.prefix(mm)))
            let s1 = boltShapes.next(); s1.path = fp; s1.strokeColor = rgba(180, 195, 255, CGFloat(0.3 * I)); s1.lineWidth = CGFloat(wGlow * 0.45); s1.blendMode = .screen
            let s2 = boltShapes.next(); s2.path = fp; s2.strokeColor = rgba(245, 248, 255, CGFloat(0.55 * I)); s2.lineWidth = 0.9; s2.blendMode = .screen
        }
        let core = boltShapes.next(); core.path = mp; core.strokeColor = rgba(252, 253, 255, CGFloat(0.97 * I)); core.lineWidth = leading ? 1.1 : 2.2; core.blendMode = .alpha
    }

    // MARK: HUD
    private func renderHUD() {
        let m = model
        hud.isHidden = !(m.state == .play || m.state == .paused)
        guard !hud.isHidden else { return }
        let dy = store?.hudDY ?? 0
        hud.position = CGPoint(x: 0, y: -dy)
        if m.score != shownScore { if m.score > shownScore { /* pop */ }; shownScore = m.score }
        let k = 1 + 0.14 * easeOut(m.fx.score)
        scoreNode.position = P(W / 2, 94); scoreNode.setScale(CGFloat(k))
        scoreShadow.set("\(m.score)", 70, rgba(43, 45, 66, 0.08)); scoreText.set("\(m.score)", 70, hudInk(1))
        levelText.set("LEVEL \(m.level + 1)  ·  \(DIFF_NAMES[m.section].uppercased())", 14, hudInk(0.45), .heavy); levelText.node.position = P(W / 2, 124)
        let best = m.bestNow(), nb = m.score > best && best > 0
        bestLabel.set(nb ? "NEW BEST" : "BEST", 11, nb ? rgb(0xff6b81) : rgb(0xe9a23b)); bestLabel.node.position = P(W - 18, 32)
        bestValue.set("\(max(m.score, best))", 22, hudInk(0.7)); bestValue.node.position = P(W - 18, 56)
        if m.combo > 1 {   // the combo pill grows a little warmer as it climbs
            comboNode.isHidden = false
            let ck = 1 + 0.25 * easeOut(m.fx.combo), heat = clamp01(Double(m.combo - 2) / 6)
            comboNode.position = P(W / 2, 156); comboNode.setScale(CGFloat(ck))
            comboGlow.isHidden = heat <= 0; comboGlow.alpha = CGFloat(heat)
            comboText.set("×\(m.combo)", 20, m.combo >= 5 ? rgb(0xf08f1c) : rgb(0xe9a23b))
            let pw = max(64, comboText.node.frame.width + 34); comboPill.size = CGSize(width: pw, height: 32)
        } else { comboNode.isHidden = true }
        barTrack.position = P(W / 2, 25)
        barCrop.position = P(W / 2 - 80, 25); barMask.xScale = CGFloat(max(6, 160 * clamp01(m.levelT / LEVEL_TIME)) / 160)
    }

    // MARK: home screen preview: the same balls on a miniature track, gently idling in sync
    private func renderPreview() {
        let m = model
        guard let r0 = store?.previewRectScene, r0.width > 100 else { previewLayer.isHidden = true; return }
        let r = r0.insetBy(dx: 40, dy: 40)   // a margin all round, so the glow fades out instead of being cut off
        let s = Double(r.width) / W, cy = Double(r.midY), h = Double(r.height), rad = min(15, h * 0.26 / s * s)
        let lines = CGMutablePath()
        for x in m.LX { lines.move(to: CGPoint(x: Double(r.minX) + x * s, y: Double(r.minY) + 6)); lines.addLine(to: CGPoint(x: Double(r.minX) + x * s, y: Double(r.maxY) - 6)) }
        pvLines.path = lines
        pvDivider.size = CGSize(width: 2, height: h); pvDivider.position = CGPoint(x: Double(r.midX), y: cy); pvDivider.color = rgba(43, 45, 66, 1); pvDivider.colorBlendFactor = 1; pvDivider.alpha = 0.1
        let lp = CGMutablePath(); lp.move(to: CGPoint(x: Double(r.minX) + m.bx[0] * s, y: cy)); lp.addLine(to: CGPoint(x: Double(r.minX) + m.bx[1] * s, y: cy))
        pvLink.path = lp.copy(dashingWithPhase: 0, lengths: [1, 7])
        let st = min(0.14, abs(m.bv[0]) / 4500), breathe = 0.2 + 0.12 * (sin(m.t * 1.8) * 0.5 + 0.5)
        for i in 0..<2 {
            pvBalls[i].draw(tex, at: CGPoint(x: Double(r.minX) + m.bx[i] * s, y: cy), r: CGFloat(rad), P: PAL[i], side: i == 1 ? 1 : -1, sx: CGFloat(1 + st), sy: CGFloat(1 - st * 0.7), glow: CGFloat(breathe + min(0.3, abs(m.bv[0]) / 3000)), t: m.t, rimA: 0)
        }
    }
}

/// fixed random layouts for the weather (made once, like the web version)
enum WeatherBits {
    struct Drop { let x, y, z, l, s, v: Double }
    struct Bead { let x, y, r, s: Double }
    static let rain: [Drop] = (0..<90).map { _ in let z = 0.25 + 0.75 * pow(rnd(), 1.3); return Drop(x: rnd(), y: rnd(), z: z, l: 16 + z * 64 + rnd() * 26, s: 0.55 + z * 0.9 + rnd() * 0.15, v: rnd()) }.sorted { $0.z < $1.z }
    static let hail: [Bead] = (0..<90).map { _ in Bead(x: rnd(), y: rnd(), r: 1.8 + rnd() * rnd() * 3.6, s: 0.75 + rnd() * 0.6) }
}
