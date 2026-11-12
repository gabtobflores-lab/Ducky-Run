// Replaces the review screenshot on every Mirror Drop in-app purchase, straight through Apple's App Store Connect API.
// Run by fix-screenshots.sh on the Mac. Packs are never deleted: only a review screenshot that is stuck or failed is
// replaced. Apple's own answer is printed for every pack, and if Apple refuses a size the next one is tried.
import Foundation
import CryptoKit

let env = ProcessInfo.processInfo.environment
let keyID = env["KEY_ID"] ?? "", issuer = env["ISSUER_ID"] ?? "", bundleID = env["BUNDLE"] ?? "com.gabtobflores.mirrordrop"
let shots = (env["SHOTS"] ?? "").split(separator: "|").map(String.init)   // candidate files, best first
let key: P256.Signing.PrivateKey
do { key = try P256.Signing.PrivateKey(pemRepresentation: try String(contentsOfFile: env["P8"] ?? "", encoding: .utf8)) }
catch { print("✗ Couldn't read the API key file: \(error.localizedDescription)"); exit(1) }

func b64url(_ d: Data) -> String { d.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") }
nonisolated(unsafe) var individualKey = issuer.isEmpty // Apple's "Individual" keys sign in without an Issuer ID
func token() throws -> String {
    let now = Int(Date().timeIntervalSince1970) - 30 // a little earlier, in case the Mac's clock runs slightly fast
    let head = try JSONSerialization.data(withJSONObject: ["alg": "ES256", "kid": keyID, "typ": "JWT"])
    let claims: [String: Any] = individualKey ? ["sub": "user", "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"]
                                              : ["iss": issuer, "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"]
    let body = try JSONSerialization.data(withJSONObject: claims)
    let msg = b64url(head) + "." + b64url(body)
    return msg + "." + b64url(try key.signature(for: Data(msg.utf8)).rawRepresentation)
}
nonisolated(unsafe) var triedIndividual = false
struct AppleError: Error, CustomStringConvertible { let description: String }
func call(_ method: String, _ path: String, _ body: Any? = nil) async throws -> [String: Any] {
    var req = URLRequest(url: URL(string: path.hasPrefix("http") ? path : "https://api.appstoreconnect.apple.com" + path)!)
    req.httpMethod = method
    req.setValue("Bearer \(try token())", forHTTPHeaderField: "Authorization")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if let body { req.httpBody = try JSONSerialization.data(withJSONObject: body) }
    let (data, resp) = try await URLSession.shared.data(for: req)
    let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
    if code == 401 && !individualKey && !triedIndividual { triedIndividual = true; individualKey = true; return try await call(method, path, body) } // maybe an Individual key
    let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    if code >= 300 {
        var errs: [String] = []
        for e in json["errors"] as? [[String: Any]] ?? [] {
            errs.append("\(e["code"] ?? "") \(e["detail"] ?? e["title"] ?? "")")
            // Apple's list of what's actually missing ("associated errors"), one per line
            if let assoc = (e["meta"] as? [String: Any])?["associatedErrors"] as? [String: Any] {
                for (_, list) in assoc { for a in list as? [[String: Any]] ?? [] { errs.append("\n      → \(a["detail"] ?? a["title"] ?? a["code"] ?? "")") } }
            }
        }
        throw AppleError(description: "Apple said (\(code)): " + (errs.isEmpty ? String(data: data, encoding: .utf8) ?? "" : errs.joined(separator: "; ")))
    }
    return json
}
func dataOf(_ j: [String: Any]) -> [String: Any]? { j["data"] as? [String: Any] }
func attrs(_ j: [String: Any]?) -> [String: Any] { j?["attributes"] as? [String: Any] ?? [:] }

/// uploads one file as the pack's review screenshot and waits for Apple to finish checking it
func upload(_ file: String, to iap: String) async throws -> (ok: Bool, why: String) {
    let bytes = try Data(contentsOf: URL(fileURLWithPath: file))
    let name = (file as NSString).lastPathComponent
    let res = dataOf(try await call("POST", "/v1/inAppPurchaseAppStoreReviewScreenshots", ["data": [
        "type": "inAppPurchaseAppStoreReviewScreenshots", "attributes": ["fileName": name, "fileSize": bytes.count],
        "relationships": ["inAppPurchaseV2": ["data": ["type": "inAppPurchases", "id": iap]]]]]))!
    let sid = res["id"] as! String
    for op in attrs(res)["uploadOperations"] as? [[String: Any]] ?? [] {
        let off = op["offset"] as? Int ?? 0, len = op["length"] as? Int ?? bytes.count
        var r = URLRequest(url: URL(string: op["url"] as! String)!); r.httpMethod = op["method"] as? String ?? "PUT"
        for h in op["requestHeaders"] as? [[String: String]] ?? [] { r.setValue(h["value"], forHTTPHeaderField: h["name"] ?? "") }
        _ = try await URLSession.shared.upload(for: r, from: bytes.subdata(in: off..<min(off + len, bytes.count)))
    }
    let md5 = Insecure.MD5.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    _ = try await call("PATCH", "/v1/inAppPurchaseAppStoreReviewScreenshots/\(sid)", ["data": [
        "type": "inAppPurchaseAppStoreReviewScreenshots", "id": sid, "attributes": ["uploaded": true, "sourceFileChecksum": md5]]])
    for _ in 0..<30 { // Apple checks the image after the upload; wait for its verdict
        try await Task.sleep(nanoseconds: 2_000_000_000)
        let st = attrs(dataOf(try await call("GET", "/v1/inAppPurchaseAppStoreReviewScreenshots/\(sid)")))["assetDeliveryState"] as? [String: Any] ?? [:]
        let state = st["state"] as? String ?? ""
        if state == "COMPLETE" { return (true, "") }
        if state == "FAILED" {
            let errs = (st["errors"] as? [[String: Any]] ?? []).map { "\($0["code"] ?? "") \($0["description"] ?? "")" }.joined(separator: "; ")
            _ = try? await call("DELETE", "/v1/inAppPurchaseAppStoreReviewScreenshots/\(sid)")
            return (false, errs.isEmpty ? "Apple rejected it without a reason" : errs)
        }
    }
    return (false, "Apple is still processing it after a minute")
}

if env["MODE"] == "bundle" { // used by upload-app.sh: print the Mirror Drop app's bundle ID
    do {
        var apps = (try await call("GET", "/v1/apps?filter[bundleId]=\(bundleID)"))["data"] as? [[String: Any]] ?? []
        if apps.isEmpty { apps = ((try await call("GET", "/v1/apps?limit=200"))["data"] as? [[String: Any]] ?? []).filter { (attrs($0)["name"] as? String ?? "").lowercased().contains("mirror") } }
        if let b = attrs(apps.first)["bundleId"] as? String { print(b); exit(0) }
        FileHandle.standardError.write(Data("No Mirror Drop app found in App Store Connect for this key.\n".utf8)); exit(1)
    } catch { FileHandle.standardError.write(Data("\(error)\n".utf8)); exit(1) }
}
if env["MODE"] == "rights" { // used by rights-app.sh: saves the owner's own Content Rights answer (ANSWER=yes|no)
    do {
        let value = env["ANSWER"] == "yes" ? "USES_THIRD_PARTY_CONTENT" : "DOES_NOT_USE_THIRD_PARTY_CONTENT"
        var apps = (try await call("GET", "/v1/apps?filter[bundleId]=\(bundleID)"))["data"] as? [[String: Any]] ?? []
        if apps.isEmpty { apps = ((try await call("GET", "/v1/apps?limit=200"))["data"] as? [[String: Any]] ?? []).filter { (attrs($0)["name"] as? String ?? "").lowercased().contains("mirror") } }
        guard let appID = apps.first?["id"] as? String else { print("✗ No Mirror Drop app found."); exit(1) }
        _ = try await call("PATCH", "/v1/apps/\(appID)", ["data": ["type": "apps", "id": appID, "attributes": ["contentRightsDeclaration": value]]])
        print("✓ Content Rights saved: \(env["ANSWER"] == "yes" ? "Yes, it contains third-party content" : "No third-party content")")
        exit(0)
    } catch { print("✗ \(error)"); exit(1) }
}

if env["MODE"] == "sign" { // used by upload-app.sh: App Store signing for the app, created with the API key (no device needed)
    let out = env["OUT"] ?? "."
    func save(_ name: String, _ b64: String) throws { try Data(base64Encoded: b64)!.write(to: URL(fileURLWithPath: out + "/" + name)) }
    do {
        // the app's ID, with Game Center switched on
        var bid = ((try await call("GET", "/v1/bundleIds?filter[identifier]=\(bundleID)&limit=20"))["data"] as? [[String: Any]] ?? [])
            .first { (attrs($0)["identifier"] as? String) == bundleID }?["id"] as? String
        if bid == nil {
            bid = dataOf(try await call("POST", "/v1/bundleIds", ["data": ["type": "bundleIds", "attributes": ["identifier": bundleID, "name": "Mirror Drop", "platform": "IOS"]]]))?["id"] as? String
            print("✓ registered the app ID \(bundleID)")
        }
        guard let bundleRes = bid else { print("✗ couldn't find or register the app ID"); exit(1) }
        let caps = (try await call("GET", "/v1/bundleIds/\(bundleRes)/bundleIdCapabilities"))["data"] as? [[String: Any]] ?? []
        if !caps.contains(where: { (attrs($0)["capabilityType"] as? String) == "GAME_CENTER" }) {
            _ = try? await call("POST", "/v1/bundleIdCapabilities", ["data": ["type": "bundleIdCapabilities", "attributes": ["capabilityType": "GAME_CENTER"],
                "relationships": ["bundleId": ["data": ["type": "bundleIds", "id": bundleRes]]]]])
            print("✓ Game Center switched on for the app ID")
        }
        // a distribution certificate made from this Mac's own key (the private key never leaves the Mac)
        var certID = (try? String(contentsOfFile: out + "/cert.id", encoding: .utf8))?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !certID.isEmpty, (try? await call("GET", "/v1/certificates/\(certID)")) == nil { certID = "" }
        if certID.isEmpty {
            let csr = try String(contentsOfFile: out + "/dist.csr", encoding: .utf8)
            let cert = dataOf(try await call("POST", "/v1/certificates", ["data": ["type": "certificates", "attributes": ["certificateType": "DISTRIBUTION", "csrContent": csr]]]))!
            certID = cert["id"] as! String
            try save("dist.cer", attrs(cert)["certificateContent"] as! String)
            try certID.write(toFile: out + "/cert.id", atomically: true, encoding: .utf8)
            print("✓ created an Apple Distribution certificate")
        }
        // a fresh App Store profile for the app with that certificate
        let name = "Mirror Drop App Store \(Int(Date().timeIntervalSince1970))"
        let prof = dataOf(try await call("POST", "/v1/profiles", ["data": ["type": "profiles", "attributes": ["name": name, "profileType": "IOS_APP_STORE"],
            "relationships": ["bundleId": ["data": ["type": "bundleIds", "id": bundleRes]], "certificates": ["data": [["type": "certificates", "id": certID]]]]]]))!
        try save("app.mobileprovision", attrs(prof)["profileContent"] as! String)
        print("PROFILE_NAME=\(name)")
        print("PROFILE_UUID=\(attrs(prof)["uuid"] as? String ?? "")")
        exit(0)
    } catch { print("✗ \(error)"); exit(1) }
}
if env["MODE"] == "fill" { // used by fill-app.sh: everything on the 1.0 page that the API can set
    let siteBase = env["SITE"] ?? ""
    let privacyURL = siteBase + "/privacy.html", supportURL = siteBase + "/index.html"
    let desc = """
Two balls. One tap.

Mirror Drop is a calm-looking, fast-playing arcade game. Every tap moves both balls at once, mirrored across the screen. At the edge, they turn around. Thread them through the falling blocks, grab gems to build your combo, and every ten seconds the world speeds up.

SIXTEEN LIVING SKIES
The weather changes while you play, and every event looks and plays differently. Fly over a sea of clouds as golden hour fades to blue. Watch the moon slide across the sun until the diamond ring flashes at totality. Drift past Mt Fuji under falling cherry blossom, dodge lightning that charges the blocks, slide on the ice under a ring of light around the sun, and play beneath the northern lights, meteor showers and a violet dusk full of fireflies. The rarest events take weeks to find. And watch the skies for an alien invasion.

YOUR PACE
• Six difficulties, from Chill to Impossible
• Normal races to 1,000, Infinite never ends, and Zen is a calm run you can't lose
• A new Daily Challenge every day, with its own leaderboard, a calendar and streaks
• Two or three columns per side
• Game Center leaderboards for every difficulty
• Share your best with a beautiful score card

FAIR TO PLAY
Easy and Normal are free forever. Unlock more with a one-time pack, with no ads. Catch gems to earn Mirror Shards and spend them on continues. Supporters get the Golden Run: beat your best and the balls turn to liquid gold. Mirror Drop VIP, an optional subscription, adds free weekly continues, advanced tips and a weekly preview of a rare event.

PLAYS ANYWHERE
No Wi-Fi needed, no account, no tracking. Smooth on every iPhone, respects Reduce Motion, and pauses itself the moment you leave.

One tap to learn. One more run, every time.
"""
    func step(_ label: String, _ f: () async throws -> Void) async { do { try await f(); print("✓ \(label)") } catch { print("✗ \(label): \(error)") } }
    do {
        var apps = (try await call("GET", "/v1/apps?filter[bundleId]=\(bundleID)"))["data"] as? [[String: Any]] ?? []
        if apps.isEmpty { apps = ((try await call("GET", "/v1/apps?limit=200"))["data"] as? [[String: Any]] ?? []).filter { (attrs($0)["name"] as? String ?? "").lowercased().contains("mirror") } }
        guard let app = apps.first, let appID = app["id"] as? String else { print("✗ No Mirror Drop app found."); exit(1) }
        let versions = (try await call("GET", "/v1/apps/\(appID)/appStoreVersions?filter[platform]=IOS&limit=20"))["data"] as? [[String: Any]] ?? []
        guard let ver = versions.first(where: { (attrs($0)["appStoreState"] as? String ?? "") == "PREPARE_FOR_SUBMISSION" }) ?? versions.first, let verID = ver["id"] as? String else { print("✗ No version 1.0 found."); exit(1) }
        let infos = (try await call("GET", "/v1/apps/\(appID)/appInfos"))["data"] as? [[String: Any]] ?? []
        let info = infos.first(where: { ["PREPARE_FOR_SUBMISSION", "WAITING_FOR_REVIEW"].contains(attrs($0)["appStoreState"] as? String ?? attrs($0)["state"] as? String ?? "") }) ?? infos.first
        guard let infoID = info?["id"] as? String else { print("✗ No app information found."); exit(1) }

        await step("category: Games → Arcade") {
            _ = try await call("PATCH", "/v1/appInfos/\(infoID)", ["data": ["type": "appInfos", "id": infoID, "relationships": [
                "primaryCategory": ["data": ["type": "appCategories", "id": "GAMES"]], "primarySubcategoryOne": ["data": ["type": "appCategories", "id": "GAMES_ARCADE"]],
                "secondaryCategory": ["data": ["type": "appCategories", "id": "GAMES"]], "secondarySubcategoryOne": ["data": ["type": "appCategories", "id": "GAMES_CASUAL"]]]]])
        }
        await step("privacy policy URL and subtitle") {
            let locs = (try await call("GET", "/v1/appInfos/\(infoID)/appInfoLocalizations"))["data"] as? [[String: Any]] ?? []
            guard let loc = locs.first(where: { (attrs($0)["locale"] as? String ?? "").hasPrefix("en") }) ?? locs.first, let lid = loc["id"] as? String else { throw AppleError(description: "no app info language") }
            _ = try await call("PATCH", "/v1/appInfoLocalizations/\(lid)", ["data": ["type": "appInfoLocalizations", "id": lid, "attributes": ["privacyPolicyUrl": privacyURL, "subtitle": "Two balls. One tap. Wild skies"]]])
        }
        var verLocID = ""
        await step("description, keywords, support and marketing URLs, promotional text") {
            let locs = (try await call("GET", "/v1/appStoreVersions/\(verID)/appStoreVersionLocalizations"))["data"] as? [[String: Any]] ?? []
            guard let loc = locs.first(where: { (attrs($0)["locale"] as? String ?? "").hasPrefix("en") }) ?? locs.first, let lid = loc["id"] as? String else { throw AppleError(description: "no version language") }
            verLocID = lid
            _ = try await call("PATCH", "/v1/appStoreVersionLocalizations/\(lid)", ["data": ["type": "appStoreVersionLocalizations", "id": lid, "attributes": [
                "description": desc, "keywords": "offline,arcade,reflex,dodge,one tap,casual,weather,aurora,storm,mirror,endless,daily,zen,balls",
                "supportUrl": supportURL, "marketingUrl": supportURL,
                "promotionalText": "Two balls, one tap, sixteen living skies: an eclipse, Mt Fuji in blossom, golden hour over the clouds, the northern lights. No ads, no tracking, plays fully offline."]]])
        }
        await step("copyright") {
            _ = try await call("PATCH", "/v1/appStoreVersions/\(verID)", ["data": ["type": "appStoreVersions", "id": verID, "attributes": ["copyright": "2026 " + (env["OWNER"] ?? "")]]])
        }
        await step("App Review contact and notes") {
            let names = (env["OWNER"] ?? "").split(separator: " ", maxSplits: 1).map(String.init)
            let a: [String: Any] = ["contactFirstName": names.first ?? "", "contactLastName": names.count > 1 ? names[1] : (names.first ?? ""),
                "contactPhone": env["PHONE"] ?? "", "contactEmail": env["EMAIL"] ?? "", "demoAccountRequired": false,
                "notes": "Mirror Drop is free; Easy and Normal are always playable. One-time packs unlock more difficulties, modes and weather (Plus, Pro, Max, Supporter, and upgrades that cost the difference). To see the packs, tap a locked difficulty on the slider, the Daily Challenge button, or the profile picture, then Unlock. Restore Purchases is on the same screen. The game needs no internet and no account."]
            if let d = dataOf((try? await call("GET", "/v1/appStoreVersions/\(verID)/appStoreReviewDetail")) ?? [:]), let did = d["id"] as? String {
                _ = try await call("PATCH", "/v1/appStoreReviewDetails/\(did)", ["data": ["type": "appStoreReviewDetails", "id": did, "attributes": a]])
            } else {
                _ = try await call("POST", "/v1/appStoreReviewDetails", ["data": ["type": "appStoreReviewDetails", "attributes": a,
                    "relationships": ["appStoreVersion": ["data": ["type": "appStoreVersions", "id": verID]]]]])
            }
        }
        await step("age rating: none of the content questions apply (4+)") {
            var d = dataOf((try? await call("GET", "/v1/appInfos/\(infoID)/ageRatingDeclaration")) ?? [:])
            if d == nil { d = dataOf(try await call("GET", "/v1/appStoreVersions/\(verID)/ageRatingDeclaration")) }
            guard let aid = d?["id"] as? String else { throw AppleError(description: "no age rating found") }
            let keys = ["alcoholTobaccoOrDrugUseOrReferences", "sexualContentOrNudity", "profanityOrCrudeHumor", "advertising", "gamblingSimulated", "contests",
                        "violenceCartoonOrFantasy", "messagingAndChat", "gambling", "sexualContentGraphicAndNudity", "healthOrWellnessTopics", "gunsOrOtherWeapons",
                        "violenceRealisticProlongedGraphicOrSadistic", "horrorOrFearThemes", "matureOrSuggestiveThemes", "socialMedia", "medicalOrTreatmentInformation",
                        "userGeneratedContent", "lootBox", "ageAssurance", "parentalControls", "unrestrictedWebAccess", "violenceRealistic"]
            var bad: [String] = []
            for k in keys { // each is either a level ("NONE") or a yes/no question (false), depending on the question
                let body: (Any) -> [String: Any] = { v in ["data": ["type": "ageRatingDeclarations", "id": aid, "attributes": [k: v]]] }
                if (try? await call("PATCH", "/v1/ageRatingDeclarations/\(aid)", body("NONE"))) == nil, (try? await call("PATCH", "/v1/ageRatingDeclarations/\(aid)", body(false))) == nil { bad.append(k) }
            }
            if !bad.isEmpty { throw AppleError(description: "couldn't answer: " + bad.joined(separator: ", ")) }
        }
        await step("\(shots.count) App Store screenshots (iPhone 6.9\")") {
            guard !verLocID.isEmpty else { throw AppleError(description: "no version language") }
            let sets = (try await call("GET", "/v1/appStoreVersionLocalizations/\(verLocID)/appScreenshotSets"))["data"] as? [[String: Any]] ?? []
            var setID = sets.first(where: { (attrs($0)["screenshotDisplayType"] as? String) == "APP_IPHONE_67" })?["id"] as? String
            if let sid = setID {
                let have = (try await call("GET", "/v1/appScreenshotSets/\(sid)/appScreenshots"))["data"] as? [[String: Any]] ?? []
                let mine = try shots.map { f in Insecure.MD5.hash(data: try Data(contentsOf: URL(fileURLWithPath: f))).map { String(format: "%02x", $0) }.joined() }
                if have.map({ attrs($0)["sourceFileChecksum"] as? String ?? "" }) == mine { print("   already up to date"); return } // exactly these, in this order
                for h in have { _ = try? await call("DELETE", "/v1/appScreenshots/\(h["id"] as! String)") }                                 // anything else is replaced
            } else {
                setID = dataOf(try await call("POST", "/v1/appScreenshotSets", ["data": ["type": "appScreenshotSets", "attributes": ["screenshotDisplayType": "APP_IPHONE_67"],
                    "relationships": ["appStoreVersionLocalization": ["data": ["type": "appStoreVersionLocalizations", "id": verLocID]]]]]))?["id"] as? String
            }
            guard let sid = setID else { throw AppleError(description: "couldn't make a screenshot set") }
            for file in shots {
                let bytes = try Data(contentsOf: URL(fileURLWithPath: file))
                let res = dataOf(try await call("POST", "/v1/appScreenshots", ["data": ["type": "appScreenshots",
                    "attributes": ["fileName": (file as NSString).lastPathComponent, "fileSize": bytes.count],
                    "relationships": ["appScreenshotSet": ["data": ["type": "appScreenshotSets", "id": sid]]]]]))!
                for op in attrs(res)["uploadOperations"] as? [[String: Any]] ?? [] {
                    let off = op["offset"] as? Int ?? 0, len = op["length"] as? Int ?? bytes.count
                    var r = URLRequest(url: URL(string: op["url"] as! String)!); r.httpMethod = op["method"] as? String ?? "PUT"
                    for h in op["requestHeaders"] as? [[String: String]] ?? [] { r.setValue(h["value"], forHTTPHeaderField: h["name"] ?? "") }
                    _ = try await URLSession.shared.upload(for: r, from: bytes.subdata(in: off..<min(off + len, bytes.count)))
                }
                let md5 = Insecure.MD5.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
                _ = try await call("PATCH", "/v1/appScreenshots/\(res["id"] as! String)", ["data": ["type": "appScreenshots", "id": res["id"] as! String,
                    "attributes": ["uploaded": true, "sourceFileChecksum": md5]]])
                print("   uploaded \((file as NSString).lastPathComponent)")
            }
        }
        await step("Game Center for this version") {
            var gcd = dataOf((try? await call("GET", "/v1/apps/\(appID)/gameCenterDetail")) ?? [:])?["id"] as? String
            if gcd == nil {
                gcd = dataOf(try await call("POST", "/v1/gameCenterDetails", ["data": ["type": "gameCenterDetails",
                    "relationships": ["app": ["data": ["type": "apps", "id": appID]]]]]))?["id"] as? String
            }
            do { _ = try await call("POST", "/v1/gameCenterAppVersions", ["data": ["type": "gameCenterAppVersions",
                    "relationships": ["appStoreVersion": ["data": ["type": "appStoreVersions", "id": verID]]]]])
            } catch { if !"\(error)".contains("409") { throw error } }
            guard let detail = gcd else { return }
            let boards: [(String, String)] = [("mirrordrop.chill", "Chill"), ("mirrordrop.easy", "Easy"), ("mirrordrop.normal", "Normal"), ("mirrordrop.hard", "Hard"),
                ("mirrordrop.insane", "Insane"), ("mirrordrop.impossible", "Impossible"), ("mirrordrop.infinite.chill", "Chill · Infinite"),
                ("mirrordrop.infinite.easy", "Easy · Infinite"), ("mirrordrop.infinite.normal", "Normal · Infinite"), ("mirrordrop.infinite.hard", "Hard · Infinite"),
                ("mirrordrop.infinite.insane", "Insane · Infinite"), ("mirrordrop.infinite.impossible", "Impossible · Infinite"), ("mirrordrop.daily", "Daily Challenge")]
            let existing = Set(((try? await call("GET", "/v1/gameCenterDetails/\(detail)/gameCenterLeaderboards?limit=200"))?["data"] as? [[String: Any]] ?? []).compactMap { attrs($0)["vendorIdentifier"] as? String })
            for (vid, name) in boards where !existing.contains(vid) {
                do {
                    let lb = dataOf(try await call("POST", "/v1/gameCenterLeaderboards", ["data": ["type": "gameCenterLeaderboards",
                        "attributes": ["referenceName": name, "vendorIdentifier": vid, "defaultFormatter": "INTEGER", "submissionType": "BEST_SCORE", "scoreSortType": "DESC",
                                       "scoreRangeStart": "0", "scoreRangeEnd": "1000000"],
                        "relationships": ["gameCenterDetail": ["data": ["type": "gameCenterDetails", "id": detail]]]]]))!
                    _ = try? await call("POST", "/v1/gameCenterLeaderboardLocalizations", ["data": ["type": "gameCenterLeaderboardLocalizations",
                        "attributes": ["locale": "en-US", "name": name], "relationships": ["gameCenterLeaderboard": ["data": ["type": "gameCenterLeaderboards", "id": lb["id"] as! String]]]]])
                    print("   leaderboard \(name)")
                } catch { print("   (leaderboard \(name) not added: \(error))") }
            }
        }
        print("\nLeft for you on the website (Apple has no API for these two):")
        print("  1. App Privacy → Get Started → \"No, we do not collect data from this app\" → Save → Publish")
        print("  2. App Information → Content Rights → answer the question about third-party content")
        exit(0)
    } catch { print("✗ \(error)"); exit(1) }
}
if env["MODE"] == "submit" { // used by submit-app.sh: build on 1.0, packs into the review, version submitted
    do {
        var apps = (try await call("GET", "/v1/apps?filter[bundleId]=\(bundleID)"))["data"] as? [[String: Any]] ?? []
        if apps.isEmpty { apps = ((try await call("GET", "/v1/apps?limit=200"))["data"] as? [[String: Any]] ?? []).filter { (attrs($0)["name"] as? String ?? "").lowercased().contains("mirror") } }
        guard let app = apps.first, let appID = app["id"] as? String else { print("✗ No Mirror Drop app found."); exit(1) }
        print("App: \(attrs(app)["name"] ?? "")")
        // the version waiting to be submitted
        let versions = (try await call("GET", "/v1/apps/\(appID)/appStoreVersions?filter[platform]=IOS&limit=20"))["data"] as? [[String: Any]] ?? []
        let editable = ["PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED", "INVALID_BINARY"]
        guard let ver = versions.first(where: { editable.contains(attrs($0)["appStoreState"] as? String ?? attrs($0)["appVersionState"] as? String ?? "") }) ?? versions.first,
              let verID = ver["id"] as? String else { print("✗ No app version found. Add version 1.0 in App Store Connect first."); exit(1) }
        print("Version \(attrs(ver)["versionString"] ?? "") (\(attrs(ver)["appStoreState"] ?? attrs(ver)["appVersionState"] ?? ""))")
        // newest processed build onto the version
        // always the newest upload: if Apple is still processing it, wait for it rather than submit an older build
        var builds: [[String: Any]] = []
        for i in 0..<80 {
            builds = (try await call("GET", "/v1/builds?filter[app]=\(appID)&sort=-uploadedDate&limit=1"))["data"] as? [[String: Any]] ?? []
            let state = attrs(builds.first)["processingState"] as? String ?? ""
            if state != "PROCESSING" { break }
            if i == 0 { print("Apple is still processing build \(attrs(builds.first)["version"] ?? "") (usually 5 to 30 minutes). Waiting for it…") }
            try await Task.sleep(nanoseconds: 30_000_000_000)
        }
        guard let build = builds.first, let buildID = build["id"] as? String, (attrs(build)["processingState"] as? String) == "VALID" else {
            print("✗ The newest build isn't ready (\(attrs(builds.first)["processingState"] ?? "no build")). Run this again in a few minutes."); exit(1) }
        _ = try await call("PATCH", "/v1/appStoreVersions/\(verID)/relationships/build", ["data": ["type": "builds", "id": buildID]])
        print("✓ build \(attrs(build)["version"] ?? "") attached")
        // every pack that is ready goes into the review together with the version
        let iaps = (try await call("GET", "/v1/apps/\(appID)/inAppPurchasesV2?limit=200"))["data"] as? [[String: Any]] ?? []
        // 1. the review submission (reuse an open draft), with version 1.0 in it: Apple only takes first packs alongside a version
        let drafts = (try await call("GET", "/v1/reviewSubmissions?filter[app]=\(appID)&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW"))["data"] as? [[String: Any]] ?? []
        var subID = drafts.first?["id"] as? String
        if subID == nil {
            subID = dataOf(try await call("POST", "/v1/reviewSubmissions", ["data": ["type": "reviewSubmissions", "attributes": ["platform": "IOS"],
                "relationships": ["app": ["data": ["type": "apps", "id": appID]]]]]))?["id"] as? String
        }
        guard let sub = subID else { print("✗ Couldn't start a review submission."); exit(1) }
        do { _ = try await call("POST", "/v1/reviewSubmissionItems", ["data": ["type": "reviewSubmissionItems", "relationships": [
                "reviewSubmission": ["data": ["type": "reviewSubmissions", "id": sub]], "appStoreVersion": ["data": ["type": "appStoreVersions", "id": verID]]]]])
             print("✓ version 1.0 added to the review")
        } catch {
            if !"\(error)".contains("already") {
                print("\n✗ Version 1.0 isn't ready to submit yet. What's missing, from Apple:\n\(error)")
                print("\nFill those in on the 1.0 page in App Store Connect, then run this again. Nothing was submitted."); exit(1)
            }
        }
        // 2. every pack that's ready goes in with it
        var notReady: [String] = []
        for iap in iaps {
            let pid = attrs(iap)["productId"] as? String ?? "", state = attrs(iap)["state"] as? String ?? ""
            if state == "READY_TO_SUBMIT" {
                do { _ = try await call("POST", "/v1/inAppPurchaseSubmissions", ["data": ["type": "inAppPurchaseSubmissions",
                        "relationships": ["inAppPurchaseV2": ["data": ["type": "inAppPurchases", "id": iap["id"] as! String]]]]])
                     print("✓ \(pid) added to the review")
                } catch { print("✗ \(pid): \(error)"); notReady.append(pid) }
            } else if ["WAITING_FOR_REVIEW", "IN_REVIEW", "APPROVED"].contains(state) {
                print("✓ \(pid) already in review (\(state))")
            } else { print("✗ \(pid) is \(state): fix it in App Store Connect first"); notReady.append(pid) }
        }
        if !notReady.isEmpty && env["FORCE"] != "1" {
            print("\nNot submitting yet: \(notReady.count) pack(s) aren't ready (above). Fix them, then run this again.")
            print("To submit the app without them anyway, run it with FORCE=1."); exit(1)
        }
        // 3. send it
        _ = try await call("PATCH", "/v1/reviewSubmissions/\(sub)", ["data": ["type": "reviewSubmissions", "id": sub, "attributes": ["submitted": true]]])
        print("\n✅ Submitted to App Review. Apple usually replies within 1–2 days (watch your email and App Store Connect).")
        exit(0)
    } catch {
        print("\n✗ Apple didn't accept the submission:\n\(error)")
        print("\nThat usually names a field that's still empty on the 1.0 page. Fill it in, then run this again."); exit(1)
    }
}
print("Connecting to App Store Connect…")
do {
    var apps = (try await call("GET", "/v1/apps?filter[bundleId]=\(bundleID)"))["data"] as? [[String: Any]] ?? []
    if apps.isEmpty { // a different bundle ID: take the app called Mirror Drop
        apps = ((try await call("GET", "/v1/apps?limit=200"))["data"] as? [[String: Any]] ?? []).filter { (attrs($0)["name"] as? String ?? "").lowercased().contains("mirror") }
    }
    guard let app = apps.first, let appID = app["id"] as? String else { print("✗ No Mirror Drop app found in App Store Connect for this key."); exit(1) }
    print("App: \(attrs(app)["name"] ?? "") (\(attrs(app)["bundleId"] ?? ""))\n")
    let iaps = (try await call("GET", "/v1/apps/\(appID)/inAppPurchasesV2?limit=200"))["data"] as? [[String: Any]] ?? []
    if iaps.isEmpty { print("No in-app purchases found yet.") }
    var fixed = 0
    for iap in iaps {
        let id = iap["id"] as! String, pid = attrs(iap)["productId"] as? String ?? id
        print("• \(pid)")
        let have = dataOf((try? await call("GET", "/v2/inAppPurchases/\(id)/appStoreReviewScreenshot")) ?? [:])
        if let have, let sid = have["id"] as? String {
            let state = (attrs(have)["assetDeliveryState"] as? [String: Any])?["state"] as? String ?? "unknown"
            if state == "COMPLETE" { print("   ✓ already has a good review screenshot"); fixed += 1; continue }
            _ = try? await call("DELETE", "/v1/inAppPurchaseAppStoreReviewScreenshots/\(sid)")
            print("   removed the stuck screenshot (it was \(state))")
        }
        var done = false
        for file in shots {
            let size = ((file as NSString).lastPathComponent as NSString).deletingPathExtension.components(separatedBy: "-").last ?? ""
            do {
                let r = try await upload(file, to: id)
                if r.ok { print("   ✓ review screenshot saved (\(size))"); done = true; fixed += 1; break }
                print("   ✗ \(size) refused: \(r.why)")
            } catch { print("   ✗ \(size) refused: \(error)") }
        }
        if !done { print("   ✗ no size was accepted for this pack (reasons above)") }
    }
    print("\n\(fixed) of \(iaps.count) packs have their review screenshot.")
} catch {
    print("✗ \(error)")
    print("If this mentions authentication: check the Issuer ID, and that the key's access is Admin or App Manager.")
    exit(1)
}
