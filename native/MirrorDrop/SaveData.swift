// Saved progress: bests, this phone's top-ten runs per setting, the profile and the menu settings.
// Stored in the app's own storage (UserDefaults), in the same format as the web version, so nothing is lost:
// the first launch picks up what the earlier version of the app saved (it mirrored everything under "CapacitorStorage.").

import Foundation

struct RunEntry: Equatable { var s: Int; var d: Double }   // score, date (ms since 1970)

final class SaveData {
    private let ud = UserDefaults.standard
    private static let keys = ["mirrorBests", "mirrorProfile", "mirrorBoard", "mirrorPer", "mirrorMode", "mirrorSlider", "mirrorPending"]

    // profile
    var name = "Player", color = 0, sym = 0, photo = "", useGc = true, runs = 0, bestCombo = 0, oid = ""
    var bests: [String: Int] = [:]
    var board: [String: [RunEntry]] = [:]
    var pending: [(id: String, score: Int)] = []
    var per = 3, mode = "normal", slider = 50.0

    init() { migrate(); load() }

    private func str(_ k: String) -> String? { ud.string(forKey: k) }

    /// first launch of the native app: bring over what the web version of the app had saved
    private func migrate() {
        guard ud.object(forKey: "native.migrated") == nil else { return }
        for k in Self.keys where ud.object(forKey: k) == nil { if let v = ud.string(forKey: "CapacitorStorage." + k) { ud.set(v, forKey: k) } }
        ud.set(true, forKey: "native.migrated")
    }

    private func json(_ k: String) -> Any? { guard let s = str(k), let d = s.data(using: .utf8) else { return nil }; return try? JSONSerialization.jsonObject(with: d) }

    func load() {
        if let p = json("mirrorProfile") as? [String: Any] {
            name = String((p["name"] as? String ?? "Player").prefix(16)); color = ((p["c"] as? Int) ?? 0) % 8; sym = ((p["sym"] as? Int) ?? 0) % 12
            let ph = p["photo"] as? String ?? ""; photo = ph.hasPrefix("data:image/") ? ph : ""
            useGc = (p["useGc"] as? Bool) ?? true; runs = (p["runs"] as? Int) ?? 0; bestCombo = (p["combo"] as? Int) ?? 0; oid = p["oid"] as? String ?? ""
            if let b = p["bests"] as? [String: Any] { bests = b.compactMapValues { ($0 as? NSNumber)?.intValue } }
        }
        if bests.isEmpty, let b = json("mirrorBests") as? [String: Any] { bests = b.compactMapValues { ($0 as? NSNumber)?.intValue } }
        if let b = json("mirrorBoard") as? [String: Any] {
            for (k, v) in b { guard let arr = v as? [[String: Any]] else { continue }
                board[k] = arr.compactMap { e in guard let s = (e["s"] as? NSNumber)?.intValue, s > 0 else { return nil }; return RunEntry(s: s, d: (e["d"] as? NSNumber)?.doubleValue ?? Date().timeIntervalSince1970 * 1000) } }
        }
        if let arr = json("mirrorPending") as? [[String: Any]] { pending = arr.compactMap { e in guard let id = e["leaderboardId"] as? String, let s = (e["score"] as? NSNumber)?.intValue else { return nil }; return (id, s) } }
        per = str("mirrorPer") == "2" ? 2 : 3
        mode = str("mirrorMode") == "infinite" ? "infinite" : "normal"
        if let s = str("mirrorSlider"), let v = Double(s), v >= 0, v <= 120 { slider = v }
    }

    private func put(_ k: String, _ obj: Any) {
        guard let d = try? JSONSerialization.data(withJSONObject: obj), let s = String(data: d, encoding: .utf8) else { return }
        ud.set(s, forKey: k)
    }
    func saveProfile() {
        put("mirrorProfile", ["name": name, "c": color, "sym": sym, "photo": photo, "useGc": useGc, "bests": bests, "runs": runs, "combo": bestCombo, "oid": oid] as [String: Any])
        put("mirrorBests", bests)
    }
    func saveBoard() { put("mirrorBoard", board.mapValues { $0.map { ["s": $0.s, "d": $0.d] } }) }
    func savePending() { put("mirrorPending", pending.map { ["leaderboardId": $0.id, "score": $0.score] }) }
    func saveSettings() { ud.set(String(per), forKey: "mirrorPer"); ud.set(mode, forKey: "mirrorMode"); ud.set(String(slider), forKey: "mirrorSlider") }

    func best(_ key: String) -> Int { bests[key] ?? 0 }

    /// a finished run: bests, the top ten for this setting, and Game Center (sent now or later). Returns its rank on this phone (0 if unranked).
    @discardableResult
    func recordRun(score: Int, key: String, newBest: Bool, maxCombo: Int, leaderboardId: String) -> Int {
        runs += 1; bestCombo = max(bestCombo, maxCombo)
        if newBest { bests[key] = score }
        saveProfile()
        guard score > 0 else { return 0 }
        var L = board[key] ?? []; let e = RunEntry(s: score, d: Date().timeIntervalSince1970 * 1000)
        L.append(e); L.sort { $0.s != $1.s ? $0.s > $1.s : $0.d < $1.d }; if L.count > 10 { L.removeLast(L.count - 10) }
        board[key] = L; saveBoard()
        pending.append((leaderboardId, score)); if pending.count > 50 { pending.removeFirst(pending.count - 50) }; savePending()
        return (L.firstIndex(of: e) ?? -1) + 1
    }
    /// if the app is closed mid-run, a new best is already safe
    func bankBest(score: Int, key: String) { if score > best(key) { bests[key] = score; saveProfile() } }
}

/// nicknames stay friendly: letters, numbers and a few marks, nothing rude even when spelled with numbers
func nameProblem(_ n: String) -> String {
    if n.count < 2 { return "At least 2 characters." }
    let ok = n.unicodeScalars.allSatisfy { CharacterSet.letters.contains($0) || CharacterSet.decimalDigits.contains($0) || " ._-".unicodeScalars.contains($0) }
    if !ok { return "Letters, numbers, spaces, . _ and - only." }
    let map: [Character: Character] = ["0": "o", "@": "a", "4": "a", "1": "i", "!": "i", "|": "i", "3": "e", "5": "s", "$": "s", "7": "t"]
    let flat = String(n.lowercased().map { map[$0] ?? $0 }.filter { ("a"..."z").contains($0) })
    let bad = ["fuck", "shit", "bitch", "cunt", "dick", "cock", "pussy", "asshole", "bastard", "slut", "whore", "nigg", "fag", "retard", "rape", "nazi", "hitler", "porn", "penis", "vagina", "boob", "jizz", "wank", "twat", "kike", "spic", "chink", "dildo", "anus", "tits", "piss", "damn", "hell"]
    return bad.contains { flat.contains($0) } ? "Please choose a different name." : ""
}
