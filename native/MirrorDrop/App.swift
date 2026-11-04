// Mirror Drop, native: SwiftUI app with the game in SpriteKit at 120 fps.

import SwiftUI
import Combine

@main
struct MirrorDropApp: App {
    @StateObject private var store = GameStore()
    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(GameCenter.shared)
                .statusBarHidden(true)
                .persistentSystemOverlays(.hidden)
                .preferredColorScheme(.light)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var store: GameStore
    @Environment(\.scenePhase) private var phase

    var body: some View {
        GeometryReader { geo in
            ZStack {
                StageView(store: store).ignoresSafeArea()
                Overlays(safeTop: geo.safeAreaInsets.top)
            }
            .onAppear { store.layout(size: fullSize(geo), safeTop: geo.safeAreaInsets.top) }
            .onChange(of: geo.size) { _, _ in store.layout(size: fullSize(geo), safeTop: geo.safeAreaInsets.top) }
        }
        .background(Theme.cream.ignoresSafeArea())
        .onChange(of: phase) { _, p in if p == .background { store.wentToBackground() } else if p == .active { store.cameBack() } }
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true; Synth.shared.start(); DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { GameCenter.shared.signIn() } }
        .sheet(isPresented: $store.profileOpen) { ProfileSheet().environmentObject(store).environmentObject(GameCenter.shared) }
    }
    private func fullSize(_ geo: GeometryProxy) -> CGSize {
        CGSize(width: geo.size.width + geo.safeAreaInsets.leading + geo.safeAreaInsets.trailing, height: geo.size.height + geo.safeAreaInsets.top + geo.safeAreaInsets.bottom)
    }
}

/// everything SwiftUI draws over the game
struct Overlays: View {
    @EnvironmentObject var store: GameStore
    let safeTop: CGFloat
    var body: some View {
        ZStack {
            if store.screen == .menu { MenuScreen().transition(.opacity.combined(with: .scale(scale: 0.98))) }
            if store.screen == .paused { PauseScreen().transition(.opacity) }
            if store.screen == .over { OverScreen().transition(.opacity.combined(with: .scale(scale: 0.98))) }
            if store.showPause && store.screen == .play {
                VStack { HStack { PauseButton(); Spacer() }; Spacer() }.padding(.leading, 16).padding(.top, 6).transition(.opacity)
            }
            if let n = store.note { VStack { WeatherToast(kind: n.kind).padding(.top, 54); Spacer() }.transition(.move(edge: .top).combined(with: .opacity)).id(n.id) }
            if let b = store.banner { GeometryReader { g in SpeedBanner(text: b.text, level: b.level).id(b.id).position(x: g.size.width / 2, y: store.pt(y: 240) - safeTop) }.allowsHitTesting(false) }
        }
        .animation(.spring(response: 0.38, dampingFraction: 0.86), value: store.screen)
        .animation(.easeInOut(duration: 0.2), value: store.showPause)
    }
}
