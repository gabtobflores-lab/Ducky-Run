#!/usr/bin/env python3
"""Creates Mirror Drop's in-app purchases in App Store Connect from appstore/products.json.

For each pack: the non-consumable itself, its English name and description, its US price (other countries follow
Apple's automatic equalisation), availability in every country, and the review screenshot. Anything that already
exists is left as it is, so this can be run any number of times.

Needs ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (the .p8 text) and BUNDLE_ID in the environment.
"""
import hashlib, json, os, sys, time, urllib.error, urllib.request
import jwt  # PyJWT

API = "https://api.appstoreconnect.apple.com"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY_ID, ISSUER, P8 = os.environ["ASC_KEY_ID"], os.environ["ASC_ISSUER_ID"], os.environ["ASC_KEY_P8"]
BUNDLE = os.environ.get("BUNDLE_ID") or "com.gabtobflores.mirrordrop"
REVIEW_NOTE = ("Packs unlock difficulties, modes and weather events. Open the game, tap a locked difficulty or the "
               "Daily Challenge, or tap the profile picture, then Unlock everything. Upgrades are offered to owners of "
               "a smaller pack and cost the difference.")
problems = []


def token():
    now = int(time.time())
    return jwt.encode({"iss": ISSUER, "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"}, P8,
                      algorithm="ES256", headers={"kid": KEY_ID, "typ": "JWT"})


def call(method, path, body=None):
    url = path if path.startswith("http") else API + path
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": "Bearer " + token(), "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise RuntimeError(f"{method} {path} -> {e.code}: {detail[:600]}")


def every(path):
    out, nxt = [], path
    while nxt:
        page = call("GET", nxt)
        out += page.get("data", [])
        nxt = page.get("links", {}).get("next")
    return out


def step(label, fn):
    try:
        fn()
    except Exception as e:  # keep going with the other packs, report at the end
        problems.append(f"{label}: {e}")
        print(f"   ✗ {label}: {e}")


def main():
    products = json.load(open(os.path.join(ROOT, "appstore", "products.json")))
    shot = open(os.path.join(ROOT, "appstore", "iap-review.png"), "rb").read()
    apps = call("GET", f"/v1/apps?filter[bundleId]={BUNDLE}")["data"]
    if not apps:
        sys.exit(f"No app with bundle ID {BUNDLE} in App Store Connect. Create the app there first (My Apps → +).")
    app = apps[0]["id"]
    print(f"App: {apps[0]['attributes']['name']} ({BUNDLE})")
    existing = {i["attributes"]["productId"]: i for i in every(f"/v1/apps/{app}/inAppPurchasesV2?limit=200")}
    territories = [{"type": "territories", "id": t["id"]} for t in every("/v1/territories?limit=200")]

    for p in products:
        pid = p["id"]
        print(f"\n{pid}  ({p['name']}, ${p['price']})")
        iap = existing.get(pid)
        if iap:
            print("   ✓ already exists")
        else:
            try:
                iap = call("POST", "/v2/inAppPurchases", {"data": {"type": "inAppPurchases", "attributes": {
                    "name": p["ref"], "productId": pid, "inAppPurchaseType": "NON_CONSUMABLE", "reviewNote": REVIEW_NOTE,
                    "familySharable": True}, "relationships": {"app": {"data": {"type": "apps", "id": app}}}}})["data"]
                print("   ✓ created")
            except Exception as e:
                problems.append(f"{pid} create: {e}"); print(f"   ✗ create: {e}"); continue
        iid = iap["id"]
        ref = {"data": {"type": "inAppPurchases", "id": iid}}

        def localization():
            have = every(f"/v2/inAppPurchases/{iid}/inAppPurchaseLocalizations")
            if any(l["attributes"].get("locale") == "en-US" for l in have):
                print("   ✓ English name and description already set"); return
            call("POST", "/v1/inAppPurchaseLocalizations", {"data": {"type": "inAppPurchaseLocalizations", "attributes": {
                "locale": "en-US", "name": p["name"], "description": p["desc"]}, "relationships": {"inAppPurchaseV2": ref}}})
            print("   ✓ English name and description")

        def price():
            try:
                sched = call("GET", f"/v2/inAppPurchases/{iid}/iapPriceSchedule?include=manualPrices")
                if sched.get("included"):
                    print("   ✓ price already set"); return
            except RuntimeError:
                pass
            points = every(f"/v2/inAppPurchases/{iid}/pricePoints?filter[territory]=USA&limit=200")
            match = [pp for pp in points if pp["attributes"].get("customerPrice") == p["price"]]
            if not match:
                raise RuntimeError(f"no US price point of ${p['price']}")
            call("POST", "/v1/inAppPurchasePriceSchedules", {
                "data": {"type": "inAppPurchasePriceSchedules", "relationships": {
                    "inAppPurchase": ref, "baseTerritory": {"data": {"type": "territories", "id": "USA"}},
                    "manualPrices": {"data": [{"type": "inAppPurchasePrices", "id": "${p0}"}]}}},
                "included": [{"type": "inAppPurchasePrices", "id": "${p0}", "attributes": {"startDate": None},
                              "relationships": {"inAppPurchaseV2": ref, "inAppPurchasePricePoint": {
                                  "data": {"type": "inAppPurchasePricePoints", "id": match[0]["id"]}}}}]})
            print(f"   ✓ price ${p['price']} (other countries follow Apple's equalisation)")

        def availability():
            try:
                call("GET", f"/v2/inAppPurchases/{iid}/inAppPurchaseAvailability")
                print("   ✓ already available"); return
            except RuntimeError:
                pass
            call("POST", "/v1/inAppPurchaseAvailabilities", {"data": {"type": "inAppPurchaseAvailabilities",
                "attributes": {"availableInNewTerritories": True},
                "relationships": {"inAppPurchase": ref, "availableTerritories": {"data": territories}}}})
            print(f"   ✓ available in {len(territories)} countries and regions")

        def screenshot():
            try:
                have = call("GET", f"/v2/inAppPurchases/{iid}/appStoreReviewScreenshot")
                if have.get("data"):
                    print("   ✓ review screenshot already there"); return
            except RuntimeError:
                pass
            res = call("POST", "/v1/inAppPurchaseAppStoreReviewScreenshots", {"data": {
                "type": "inAppPurchaseAppStoreReviewScreenshots",
                "attributes": {"fileName": "mirror-drop-packs.png", "fileSize": len(shot)},
                "relationships": {"inAppPurchaseV2": ref}}})["data"]
            for op in res["attributes"]["uploadOperations"]:
                part = shot[op["offset"]:op["offset"] + op["length"]]
                req = urllib.request.Request(op["url"], data=part, method=op["method"],
                                             headers={h["name"]: h["value"] for h in op.get("requestHeaders", [])})
                urllib.request.urlopen(req).read()
            call("PATCH", f"/v1/inAppPurchaseAppStoreReviewScreenshots/{res['id']}", {"data": {
                "type": "inAppPurchaseAppStoreReviewScreenshots", "id": res["id"],
                "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(shot).hexdigest()}}})
            print("   ✓ review screenshot")

        step(f"{pid} localization", localization)
        step(f"{pid} price", price)
        step(f"{pid} availability", availability)
        step(f"{pid} screenshot", screenshot)

    print()
    if problems:
        print(f"{len(problems)} step(s) need attention:"); [print(" - " + x) for x in problems]; sys.exit(1)
    print("All packs are set up in App Store Connect.")


if __name__ == "__main__":
    main()
