// The menu, pause and result screens, the weather toast, the speed-up banner and the pause button.
// Same design as the web version: a calm cream field, pink and cyan, rounded type, soft white cards.

import SwiftUI
import Combine
import UIKit

enum Theme {
    static let cream = Color(red: 0xf6 / 255, green: 0xf1 / 255, blue: 0xea / 255)
    static let ink = Color(red: 0x2b / 255, green: 0x2d / 255, blue: 0x42 / 255)
    static let pink = Color(red: 1, green: 0x6b / 255, blue: 0x81 / 255)
    static let cyan = Color(red: 0x2e / 255, green: 0xc4 / 255, blue: 0xd6 / 255)
    static let gold = Color(red: 0xe9 / 255, green: 0xa2 / 255, blue: 0x3b / 255)
    static let sect: [Color] = ([0x2ec4d6, 0x3fb4dc, 0x6a9fdf, 0xa58ad9, 0xe07aa8, 0xff6b81] as [Int]).map(hex)
    static func hex(_ v: Int) -> Color {
        let r: Double = Double((v >> 16) & 255) / 255, g: Double = Double((v >> 8) & 255) / 255, b: Double = Double(v & 255) / 255
        return Color(red: r, green: g, blue: b)
    }
    static func font(_ size: CGFloat, _ w: Font.Weight = .heavy) -> Font { .system(size: size, weight: w, design: .rounded) }
}

/// a soft white card, as in the web version
struct Card<Content: View>: View {
    let content: Content
    init(@ViewBuilder _ c: () -> Content) { content = c() }
    var body: some View {
        content.padding(.horizontal, 16).padding(.vertical, 14).frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(.white.opacity(0.82)).shadow(color: .black.opacity(0.06), radius: 14, y: 5))
    }
}

struct Label2: View {   // small spaced capitals
    let text: String
    var color: Color = Theme.ink.opacity(0.55)
    var body: some View { Text(text).font(Theme.font(11, .heavy)).tracking(2).foregroundStyle(color) }
}

struct BigButton: View {
    let title: String
    var alt = false
    let action: () -> Void
    var body: some View {
        Button(action: { Haptics.shared.play(.selection); action() }) {
            Text(title).font(Theme.font(alt ? 15 : 19, .black)).tracking(alt ? 2.5 : 4)
                .foregroundStyle(alt ? Theme.ink : .white)
                .frame(maxWidth: .infinity).frame(height: alt ? 50 : 58)
                .background(Capsule().fill(alt ? AnyShapeStyle(.white.opacity(0.92)) : AnyShapeStyle(LinearGradient(colors: [Color(red: 1, green: 0.52, blue: 0.6), Color(red: 1, green: 0.36, blue: 0.47)], startPoint: .top, endPoint: .bottom))))
                .shadow(color: alt ? .black.opacity(0.06) : Theme.pink.opacity(0.35), radius: alt ? 10 : 14, y: alt ? 3 : 6)
        }
        .buttonStyle(PressStyle())
    }
}
struct PressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.scaleEffect(configuration.isPressed ? 0.96 : 1).animation(.spring(response: 0.25, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

struct Logo: View {
    let top: String?, bottom: String
    var topColor = Theme.pink, bottomColor = Theme.cyan
    var body: some View {
        VStack(spacing: -6) {
            if let top { Text(top).foregroundStyle(topColor) }
            Text(bottom).foregroundStyle(bottomColor)
        }
        .font(Theme.font(52, .black)).tracking(3)
        .shadow(color: .black.opacity(0.08), radius: 0, y: 3)
    }
}

// MARK: - difficulty slider: six sections; whichever section the thumb sits in decides the difficulty
struct DifficultySlider: View {
    @Binding var value: Double   // 0...120
    @State private var dragging = false
    var body: some View {
        GeometryReader { g in
            let w = g.size.width, inset: CGFloat = 11, track = w - inset * 2, f = CGFloat(value / 120), sect = min(5, Int(value / 20))
            ZStack(alignment: .leading) {
                HStack(spacing: 3) { ForEach(0..<6, id: \.self) { _ in Capsule().fill(Color.black.opacity(0.07)) } }.frame(height: 6).padding(.horizontal, inset)
                HStack(spacing: 3) { ForEach(0..<6, id: \.self) { i in Capsule().fill(LinearGradient(colors: [Theme.sect[i], Theme.sect[min(5, i + 1)]], startPoint: .leading, endPoint: .trailing)) } }
                    .frame(height: 6).padding(.horizontal, inset).mask(alignment: .leading) { Rectangle().frame(width: inset + track * f) }
                Circle().fill(.white).frame(width: dragging ? 26 : 22, height: dragging ? 26 : 22)
                    .overlay(Circle().stroke(Theme.sect[sect], lineWidth: 2.5))
                    .shadow(color: .black.opacity(0.15), radius: 4, y: 2)
                    .offset(x: inset + track * f - (dragging ? 13 : 11))
                    .animation(.spring(response: 0.25, dampingFraction: 0.7), value: dragging)
            }
            .frame(height: 30)
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onChanged { v in
                dragging = true
                let nv = max(0, min(120, Double((v.location.x - inset) / track) * 120))
                let before = min(5, Int(value / 20)); value = nv
                if min(5, Int(nv / 20)) != before { Haptics.shared.play(.selection) }
            }.onEnded { _ in dragging = false })
        }
        .frame(height: 30)
        .accessibilityElement().accessibilityLabel("Difficulty").accessibilityValue(DIFF_NAMES[min(5, Int(value / 20))])
        .accessibilityAdjustableAction { d in value = max(0, min(120, value + (d == .increment ? 20 : -20))) }
    }
}

struct DifficultyCard: View {
    @EnvironmentObject var store: GameStore
    var body: some View {
        Card {
            VStack(spacing: 8) {
                HStack { Label2(text: "DIFFICULTY"); Spacer(); Text(DIFF_NAMES[store.model.section]).font(Theme.font(17, .heavy)).foregroundStyle(Theme.sect[store.model.section]).contentTransition(.interpolate) }
                DifficultySlider(value: $store.sliderV)
                HStack { Text("Chill"); Spacer(); Text("Impossible") }.font(Theme.font(11, .bold)).foregroundStyle(Theme.ink.opacity(0.45))
            }
        }
    }
}

/// a segmented choice with a sliding pill
struct Segmented<T: Hashable>: View {
    let options: [(T, String)]
    @Binding var selection: T
    var small = false
    @Namespace private var ns
    var body: some View {
        HStack(spacing: 0) {
            ForEach(options.indices, id: \.self) { i in
                let opt = options[i]
                Button { Haptics.shared.play(.selection); withAnimation(.spring(response: 0.32, dampingFraction: 0.8)) { selection = opt.0 } } label: {
                    Text(opt.1).font(Theme.font(small ? 13 : 15, .heavy)).foregroundStyle(selection == opt.0 ? .white : Theme.ink.opacity(0.6))
                        .frame(maxWidth: .infinity).frame(height: small ? 30 : 42)
                        .background { if selection == opt.0 { RoundedRectangle(cornerRadius: small ? 10 : 13, style: .continuous).fill(Theme.cyan).shadow(color: Theme.cyan.opacity(0.35), radius: 6, y: 3).matchedGeometryEffect(id: "pill", in: ns) } }
                }.buttonStyle(.plain)
            }
        }
        .padding(3).background(RoundedRectangle(cornerRadius: small ? 12 : 15, style: .continuous).fill(Color.black.opacity(0.05)))
    }
}

struct ColumnsCard: View {
    @EnvironmentObject var store: GameStore
    var body: some View {
        Card {
            VStack(spacing: 10) {
                HStack { Label2(text: "COLUMNS"); Spacer(); Text("\(store.per * 2) columns").font(Theme.font(17, .heavy)).foregroundStyle(Theme.ink.opacity(0.75)) }
                Segmented(options: [(2, "2 per side"), (3, "3 per side")], selection: Binding(get: { store.per }, set: { store.setPer($0) }))
                HStack { Label2(text: "MODE"); Spacer(); Segmented(options: [(GameMode.normal, "Normal"), (GameMode.infinite, "Infinite")], selection: $store.mode, small: true).frame(width: 176) }
            }
        }
    }
}

struct Avatar: View {
    @EnvironmentObject var store: GameStore
    @EnvironmentObject var gc: GameCenter
    var size: CGFloat = 40
    var body: some View {
        let _ = store.profileVersion
        Group {
            if let img = photoImage() { Image(uiImage: img).resizable().scaledToFill() }
            else {
                ZStack { Circle().fill(color(store.save.color)); Text(symbol()).font(Theme.font(size * 0.45, .black)).foregroundStyle(.white) }
            }
        }
        .frame(width: size, height: size).clipShape(Circle())
    }
    private func photoImage() -> UIImage? {
        if !store.save.photo.isEmpty, let i = store.save.photo.firstIndex(of: ","), let d = Data(base64Encoded: String(store.save.photo[store.save.photo.index(after: i)...])) { return UIImage(data: d) }
        if store.save.useGc, let p = gc.photo { return p }
        return nil
    }
    private func symbol() -> String { let s = AVSYM[store.save.sym % AVSYM.count]; return s.isEmpty ? String(store.shownName.trimmingCharacters(in: .whitespaces).prefix(1)).uppercased() : s }
}
let PCOL: [UInt32] = [0x2ec4d6, 0xff6b81, 0xe9a23b, 0x8b6cf0, 0x3b82f6, 0x22b07d, 0xf08f1c, 0x64748b]
let AVSYM = ["", "★", "⚡", "☾", "❄", "☀", "◆", "♥", "✿", "☁", "♪", "✦"]
func color(_ i: Int) -> Color { let h = PCOL[i % PCOL.count]; return Color(red: Double((h >> 16) & 255) / 255, green: Double((h >> 8) & 255) / 255, blue: Double(h & 255) / 255) }

struct BestCard: View {
    @EnvironmentObject var store: GameStore
    var celebrate = false
    var body: some View {
        let _ = store.profileVersion
        Card {
            VStack(spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 10) { Label2(text: "BEST", color: Theme.gold); Text(store.bestText).font(Theme.font(24, .black)).foregroundStyle(Theme.ink).contentTransition(.numericText()) }
                Text(store.settingText).font(Theme.font(12, .bold)).foregroundStyle(Theme.ink.opacity(0.5))
            }
        }
        .scaleEffect(celebrate ? 1.03 : 1).shadow(color: celebrate ? Theme.gold.opacity(0.35) : .clear, radius: 16)
    }
}

// MARK: - menu
struct MenuScreen: View {
    @EnvironmentObject var store: GameStore
    var body: some View {
        VStack(spacing: 14) {
            Spacer(minLength: 20)
            Logo(top: "MIRROR", bottom: "DROP")
            Text("two balls. one tap.").font(Theme.font(15, .bold)).tracking(1).foregroundStyle(Theme.ink.opacity(0.45)).padding(.top, -6)
            // the ball preview is drawn by the game underneath, right here
            Color.clear.frame(height: 110).background(GeometryReader { g in Color.clear.onAppear { store.previewRect = g.frame(in: .global) }.onChange(of: g.frame(in: .global)) { _, f in store.previewRect = f } })
            DifficultyCard()
            ColumnsCard()
            BigButton(title: "PLAY") { store.play() }.padding(.top, 2)
            ZStack(alignment: .trailing) {
                Button { store.profileTab = 1; store.profileOpen = true } label: { BestCard() }.buttonStyle(PressStyle())
                Button { store.profileTab = 0; store.profileOpen = true } label: {
                    Avatar(size: 40).overlay(alignment: .bottomTrailing) { Image(systemName: "trophy.fill").font(.system(size: 9, weight: .bold)).foregroundStyle(Theme.gold).padding(3).background(Circle().fill(.white)).offset(x: 4, y: 4) }
                }.buttonStyle(PressStyle()).padding(.trailing, 16).accessibilityLabel("Profile and leaderboard")
            }
            Text("tap to move the balls one step.\nat the edge they turn around.").font(Theme.font(13, .medium)).multilineTextAlignment(.center).foregroundStyle(Theme.ink.opacity(0.45))
            Spacer(minLength: 10)
        }
        .padding(.horizontal, 24).frame(maxWidth: 420)
    }
}

// MARK: - pause
struct PauseScreen: View {
    @EnvironmentObject var store: GameStore
    var body: some View {
        ZStack {
            Theme.cream.opacity(0.78).ignoresSafeArea()
            VStack(spacing: 18) {
                Logo(top: nil, bottom: "PAUSED")
                Text(store.model.pauseNote).font(Theme.font(14, .semibold)).multilineTextAlignment(.center).foregroundStyle(Theme.ink.opacity(0.55)).padding(.horizontal, 20)
                BigButton(title: "RESUME") { store.resume() }
                BigButton(title: "RETURN TO MENU", alt: true) { store.menu() }
            }.padding(.horizontal, 28).frame(maxWidth: 420)
        }
    }
}

// MARK: - result
struct OverScreen: View {
    @EnvironmentObject var store: GameStore
    @State private var shown = 0
    @State private var celebrate = false
    var body: some View {
        ZStack {
            Theme.cream.opacity(0.72).ignoresSafeArea()
            VStack(spacing: 14) {
                Spacer(minLength: 20)
                if store.over.newBest {
                    Text("NEW BEST").font(Theme.font(12, .black)).tracking(2).foregroundStyle(.white).padding(.horizontal, 14).padding(.vertical, 6)
                        .background(Capsule().fill(LinearGradient(colors: [Color(red: 1, green: 0.78, blue: 0.4), Theme.gold], startPoint: .top, endPoint: .bottom))).shadow(color: Theme.gold.opacity(0.4), radius: 8, y: 3)
                        .scaleEffect(celebrate ? 1 : 0.6).opacity(celebrate ? 1 : 0)
                }
                Logo(top: nil, bottom: store.over.won ? "COMPLETE" : "CRASH", bottomColor: store.over.won ? Theme.cyan : Theme.pink)
                Text("\(shown)").font(Theme.font(84, .black)).foregroundStyle(Theme.ink).monospacedDigit().contentTransition(.numericText(value: Double(shown))).padding(.top, -10)
                if store.over.maxCombo > 1 { Text("best combo ×\(store.over.maxCombo)").font(Theme.font(14, .bold)).foregroundStyle(Theme.gold) }
                BestCard(celebrate: celebrate)
                DifficultyCard()
                BigButton(title: "TRY AGAIN") { store.play() }
                BigButton(title: "RETURN TO MENU", alt: true) { store.menu() }
                Spacer(minLength: 10)
            }.padding(.horizontal, 24).frame(maxWidth: 420)
        }
        .onAppear {
            shown = 0
            let target = store.over.score, steps = 27
            for i in 1...steps { DispatchQueue.main.asyncAfter(deadline: .now() + 0.45 * Double(i) / Double(steps)) { let p = Double(i) / Double(steps), e = 1 - pow(1 - p, 3); shown = Int((Double(target) * e).rounded()) } }   // a quick count-up of the final score
            if store.over.newBest { withAnimation(.spring(response: 0.5, dampingFraction: 0.55).delay(0.35)) { celebrate = true } }
        }
    }
}

// MARK: - small pieces over the game
struct PauseButton: View {
    @EnvironmentObject var store: GameStore
    var body: some View {
        Button { Haptics.shared.play(.selection); store.pause() } label: {
            Image(systemName: "pause.fill").font(.system(size: 17, weight: .bold)).foregroundStyle(store.model.uiNight > 0.5 ? .white : Theme.ink)
                .frame(width: 46, height: 46).background(.ultraThinMaterial, in: Circle()).overlay(Circle().stroke(.white.opacity(0.5), lineWidth: 0.5))
                .shadow(color: .black.opacity(0.08), radius: 8, y: 3)
        }.buttonStyle(PressStyle()).accessibilityLabel("Pause")
    }
}

struct WeatherToast: View {   // the notice before an event, as a liquid-glass pill with an SF Symbol
    let kind: WxKind
    var body: some View {
        let info = wxInfo(kind)
        HStack(spacing: 12) {
            Image(systemName: Self.icon(kind)).symbolRenderingMode(.multicolor).font(.system(size: 22, weight: .semibold)).frame(width: 34)
            VStack(alignment: .leading, spacing: 1) { Text(info.title).font(Theme.font(15, .heavy)); Text(info.sub).font(Theme.font(12, .semibold)).opacity(0.6) }
                .foregroundStyle(Theme.ink)
        }
        .padding(.horizontal, 18).padding(.vertical, 12)
        .background(.regularMaterial, in: Capsule()).overlay(Capsule().stroke(.white.opacity(0.6), lineWidth: 0.5))
        .shadow(color: .black.opacity(0.12), radius: 16, y: 6)
    }
    static func icon(_ k: WxKind) -> String {
        switch k { case .fog: return "cloud.fog.fill"; case .storm: return "cloud.bolt.rain.fill"; case .hail: return "cloud.hail.fill"; case .wind: return "wind"
        case .heat: return "thermometer.sun.fill"; case .sun: return "sun.max.fill"; case .aurora: return "sparkles"; case .meteor: return "moon.stars.fill" }
    }
}

struct SpeedBanner: View {   // the speed-up banner as a real liquid-glass card over the scene
    let text: String, level: Int
    @State private var on = false
    var body: some View {
        VStack(spacing: 2) {
            Text(text).font(Theme.font(22, .black)).tracking(2).foregroundStyle(LinearGradient(colors: [Theme.pink, Theme.cyan], startPoint: .leading, endPoint: .trailing))
            Text("LEVEL \(level + 1)").font(Theme.font(11, .heavy)).tracking(2).foregroundStyle(Theme.ink.opacity(0.55))
        }
        .padding(.horizontal, 26).padding(.vertical, 12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(.white.opacity(0.6), lineWidth: 0.5))
        .shadow(color: .black.opacity(0.1), radius: 14, y: 5)
        .scaleEffect(on ? 1 : 0.94).opacity(on ? 1 : 0).offset(y: on ? 0 : -18)
        .onAppear {
            withAnimation(.spring(response: 0.22, dampingFraction: 0.8)) { on = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) { withAnimation(.easeIn(duration: 0.3)) { on = false } }
        }
    }
}
