// Profile and leaderboard, as a native iOS sheet.

import SwiftUI
import Combine
import PhotosUI
import UIKit

struct ProfileSheet: View {
    @EnvironmentObject var store: GameStore
    @EnvironmentObject var gc: GameCenter
    @Environment(\.dismiss) private var dismiss
    @State private var editingName = false
    @State private var draft = ""
    @State private var nameErr = ""
    @State private var editPic = false
    @State private var lbSect: Int? = nil
    @State private var photoItem: PhotosPickerItem? = nil

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    Picker("", selection: $store.profileTab) { Text("Profile").tag(0); Text("Leaderboard").tag(1) }.pickerStyle(.segmented)
                    if store.profileTab == 0 { profile } else { leaderboard }
                }.padding(20)
            }
            .background(Theme.cream.ignoresSafeArea())
            .navigationTitle(store.profileTab == 0 ? "Profile" : "Leaderboard").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { commitName(); dismiss() }.fontWeight(.bold).tint(Theme.cyan) } }
        }
        .presentationDetents([.medium, .large])
        .presentationCornerRadius(28)
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task { @MainActor in
                if let data = try? await item.loadTransferable(type: Data.self), let img = UIImage(data: data) { setPhoto(img) }
                photoItem = nil
            }
        }
    }

    // MARK: profile
    private var profile: some View {
        let _ = store.profileVersion
        return VStack(spacing: 14) {
            Button { withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { editPic.toggle() } } label: {
                Avatar(size: 84).overlay(alignment: .bottomTrailing) { Image(systemName: "pencil").font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.ink.opacity(0.7)).padding(6).background(Circle().fill(.white).shadow(radius: 2)).offset(x: 2, y: 2) }
            }.buttonStyle(PressStyle()).accessibilityLabel("Change profile picture")
            if gc.signedIn {
                Text(gc.alias).font(Theme.font(22, .black)).foregroundStyle(Theme.ink)
                Label("Game Center · signed in", systemImage: "checkmark.seal.fill").font(Theme.font(12, .bold)).foregroundStyle(Color.green)
            } else if editingName {
                HStack {
                    TextField("Nickname", text: $draft).font(Theme.font(18, .bold)).textInputAutocapitalization(.words).autocorrectionDisabled().submitLabel(.done).onSubmit { commitName() }
                        .padding(.horizontal, 14).frame(height: 44).background(RoundedRectangle(cornerRadius: 12).fill(.white))
                        .onChange(of: draft) { _, v in if v.count > 16 { draft = String(v.prefix(16)) } }
                    Button("Save") { commitName() }.font(Theme.font(15, .heavy)).buttonStyle(.borderedProminent).tint(Theme.cyan)
                }
                if !nameErr.isEmpty { Text(nameErr).font(Theme.font(12, .semibold)).foregroundStyle(Theme.pink) }
            } else {
                Button { draft = store.save.name; nameErr = ""; editingName = true } label: {
                    HStack(spacing: 6) { Text(store.save.name).font(Theme.font(22, .black)).foregroundStyle(Theme.ink); Image(systemName: "pencil").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.ink.opacity(0.4)) }
                }.buttonStyle(.plain)
            }
            if !gc.signedIn {
                Button { gc.signIn() } label: { Label("Sign in with Game Center", systemImage: "gamecontroller.fill").font(Theme.font(15, .heavy)).frame(maxWidth: .infinity).frame(height: 44) }
                    .buttonStyle(.borderedProminent).tint(Theme.ink)
            }
            if editPic { picker }
            HStack(spacing: 0) {
                stat(store.bestText, "Best · \(DIFF_NAMES[store.model.section])")
                Divider().frame(height: 34)
                stat("\(store.save.runs)", "Runs")
                Divider().frame(height: 34)
                stat(store.save.bestCombo > 1 ? "×\(store.save.bestCombo)" : "–", "Best combo")
            }.padding(.vertical, 12).background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(0.85)))
            Text(gc.signedIn ? "Scores also go to Game Center, even after playing offline." : "Saved on this iPhone. No internet needed.").font(Theme.font(12, .medium)).foregroundStyle(Theme.ink.opacity(0.45)).multilineTextAlignment(.center)
        }
    }
    private func stat(_ v: String, _ label: String) -> some View {
        VStack(spacing: 2) { Text(v).font(Theme.font(20, .black)).foregroundStyle(Theme.ink); Text(label).font(Theme.font(11, .bold)).foregroundStyle(Theme.ink.opacity(0.45)) }.frame(maxWidth: .infinity)
    }
    private var picker: some View {
        VStack(spacing: 12) {
            HStack(spacing: 10) {
                ForEach(0..<PCOL.count, id: \.self) { i in
                    Button { store.save.color = i; store.save.photo = ""; store.save.useGc = false; store.profileChanged() } label: {
                        Circle().fill(color(i)).frame(width: 30, height: 30).overlay(Circle().stroke(.white, lineWidth: usingSymbol && store.save.color == i ? 3 : 0)).shadow(color: .black.opacity(0.1), radius: 2)
                    }.buttonStyle(PressStyle())
                }
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6), spacing: 10) {
                ForEach(0..<AVSYM.count, id: \.self) { i in
                    Button { store.save.sym = i; store.save.photo = ""; store.save.useGc = false; store.profileChanged() } label: {
                        Text(AVSYM[i].isEmpty ? String(store.shownName.prefix(1)).uppercased() : AVSYM[i]).font(Theme.font(17, .black)).foregroundStyle(.white)
                            .frame(width: 40, height: 40).background(Circle().fill(color(store.save.color))).overlay(Circle().stroke(Theme.ink.opacity(0.6), lineWidth: usingSymbol && store.save.sym == i ? 2.5 : 0))
                    }.buttonStyle(PressStyle())
                }
            }
            HStack {
                PhotosPicker(selection: $photoItem, matching: .images) { Label("Choose photo", systemImage: "photo").font(Theme.font(14, .heavy)) }.buttonStyle(.bordered).tint(Theme.ink)
                if gc.signedIn && gc.photo != nil { Button { store.save.photo = ""; store.save.useGc = true; store.profileChanged() } label: { Label("Game Center picture", systemImage: "person.crop.circle").font(Theme.font(14, .heavy)) }.buttonStyle(.bordered).tint(Theme.ink) }
            }
        }
        .padding(14).background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(0.85)))
        .transition(.opacity.combined(with: .move(edge: .top)))
    }
    private var usingSymbol: Bool { store.save.photo.isEmpty && !(store.save.useGc && gc.photo != nil) }

    private func commitName() {
        guard editingName else { return }
        let v = draft.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "  ", with: " ")
        let bad = nameProblem(v)
        if !bad.isEmpty { nameErr = bad; return }
        store.save.name = String(v.prefix(16)); nameErr = ""; editingName = false; store.profileChanged()
    }
    /// a small square crop from the middle, kept on the phone
    private func setPhoto(_ img: UIImage) {
        let z: CGFloat = 192, m = min(img.size.width, img.size.height)
        let fmt = UIGraphicsImageRendererFormat(); fmt.scale = 1
        let out = UIGraphicsImageRenderer(size: CGSize(width: z, height: z), format: fmt).image { _ in
            img.draw(in: CGRect(x: -(img.size.width - m) / 2 * z / m, y: -(img.size.height - m) / 2 * z / m, width: img.size.width * z / m, height: img.size.height * z / m))
        }
        if let d = out.jpegData(compressionQuality: 0.85) { store.save.photo = "data:image/jpeg;base64," + d.base64EncodedString(); store.save.useGc = false; store.profileChanged() }
    }

    // MARK: leaderboard
    private var leaderboard: some View {
        let _ = store.profileVersion
        let sc = lbSect ?? store.model.section, key = "\(store.per)_\(sc)" + (store.mode == .infinite ? "_inf" : "")
        let runs = store.save.board[key] ?? []
        return VStack(spacing: 12) {
            HStack {
                Button { lbSect = max(0, sc - 1) } label: { Image(systemName: "chevron.left").font(.system(size: 17, weight: .bold)).frame(width: 40, height: 40) }.disabled(sc == 0)
                Spacer()
                VStack(spacing: 1) { Text(DIFF_NAMES[sc]).font(Theme.font(20, .black)).foregroundStyle(Theme.sect[sc]); Text(store.mode == .infinite ? "Infinite mode" : "Normal mode").font(Theme.font(12, .bold)).foregroundStyle(Theme.ink.opacity(0.45)) }
                Spacer()
                Button { lbSect = min(5, sc + 1) } label: { Image(systemName: "chevron.right").font(.system(size: 17, weight: .bold)).frame(width: 40, height: 40) }.disabled(sc == 5)
            }.tint(Theme.ink)
            Button { if gc.signedIn { gc.showLeaderboard(leaderboardId(section: sc, infinite: store.mode == .infinite)) } else { gc.signIn() } } label: {
                HStack(spacing: 12) {
                    Image(systemName: "globe.americas.fill").font(.system(size: 22)).foregroundStyle(Theme.cyan).frame(width: 36)
                    VStack(alignment: .leading, spacing: 1) { Text("World leaderboard").font(Theme.font(15, .heavy)).foregroundStyle(Theme.ink); Text(gc.signedIn ? "Game Center · everyone on \(DIFF_NAMES[sc])" : "Sign in with Game Center to compete").font(Theme.font(12, .semibold)).foregroundStyle(Theme.ink.opacity(0.5)) }
                    Spacer(); Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.ink.opacity(0.3))
                }.padding(14).background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.9)))
            }.buttonStyle(PressStyle())
            HStack { Label2(text: "YOUR BEST RUNS · \(store.per * 2) COLUMNS"); Spacer() }.padding(.top, 4)
            if runs.isEmpty {
                Text("No runs on \(DIFF_NAMES[sc]) yet.\nEvery finished run is ranked here.").font(Theme.font(14, .semibold)).multilineTextAlignment(.center).foregroundStyle(Theme.ink.opacity(0.45)).padding(.vertical, 24)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(runs.enumerated()), id: \.offset) { i, e in
                        HStack {
                            Text("\(i + 1)").font(Theme.font(14, .black)).foregroundStyle(i == 0 ? .white : Theme.ink.opacity(0.6)).frame(width: 28, height: 28).background(Circle().fill(i == 0 ? Theme.gold : Color.black.opacity(0.05)))
                            Text(Date(timeIntervalSince1970: e.d / 1000).formatted(date: .abbreviated, time: .omitted)).font(Theme.font(14, .semibold)).foregroundStyle(Theme.ink.opacity(0.7))
                            Spacer()
                            Text("\(e.s)").font(Theme.font(18, .black)).foregroundStyle(Theme.ink)
                        }.padding(.horizontal, 14).padding(.vertical, 10)
                        if i < runs.count - 1 { Divider().padding(.leading, 56) }
                    }
                }.background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.9)))
            }
        }
    }
}
