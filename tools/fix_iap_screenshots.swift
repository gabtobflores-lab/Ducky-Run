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
        let builds = (try await call("GET", "/v1/builds?filter[app]=\(appID)&filter[processingState]=VALID&sort=-uploadedDate&limit=1"))["data"] as? [[String: Any]] ?? []
        guard let build = builds.first, let buildID = build["id"] as? String else { print("✗ No processed build yet. Wait a few minutes and run this again."); exit(1) }
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
