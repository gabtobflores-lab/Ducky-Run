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
        let errs = (json["errors"] as? [[String: Any]] ?? []).map { "\($0["code"] ?? "") \($0["detail"] ?? $0["title"] ?? "")" }
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
