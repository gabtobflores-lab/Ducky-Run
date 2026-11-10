# Mirror Drop VIP: connecting the subscription

The game and the app are ready for VIP. Until the subscription exists in App Store Connect,
the VIP screen shows the planned price ($3.99 / month) and the button can't complete a purchase.

## 1. Create it in App Store Connect

1. Your app → **Subscriptions** → create a subscription group named **Mirror Drop VIP**.
2. Add one auto-renewable subscription:
   - Product ID: `mirrordrop.vip.monthly` (must match `Store.vipIds` in `swift-app/MirrorDropApp.swift` and `VIP_ID` in `mirror.html`)
   - Reference name: VIP Monthly
   - Duration: 1 month
   - Price: your choice. The game shows the App Store's own price as soon as the product is live
     (the $3.99 in `VIP_PRICE` in `mirror.html` is only shown before that).
   - Display name: Mirror Drop VIP
   - Description: Free weekly continues, advanced tips and rare event previews.
3. Add the review screenshot (the VIP screen) and submit it with the next app version.

`appstore/products.json` and the IAP setup workflow only handle the one-time packs, so VIP is created by hand.

## 2. What the app does

- VIP counts only while the App Store reports it active (verified, not revoked, not expired).
  The status is checked at launch, whenever the game comes back to the foreground, and when a
  renewal, cancellation or refund arrives.
- Plus, Pro, Max and Supporter are separate one-time purchases and are never affected by VIP.
- Restore Purchases restores both the packs and VIP.
- Manage Subscription opens Apple's own subscription sheet.
- Terms of Use links to Apple's standard EULA; the Privacy Policy links to `site/privacy.html`.

## 3. Testing in Xcode

`xcode/MirrorDrop/Products.storekit` includes VIP Monthly, so purchases, renewals and expiry
can be tested in the simulator with the StoreKit configuration selected in the scheme.

## Economy (tune in `ECON` in mirror.html)

- 5 Mirror Shards per gem caught (x3 in golden hour, x2 among fireflies), none in Zen.
- Best combo bonus: (best combo - 1) x 10 shards when it reaches x3.
- Daily Challenge: +50 the first time you finish each day's run; every 7-day streak gives a free continue.
- Continues: 1 for 1,500 · 2 for 3,000 · 5 for 6,000 · 10 for 10,000 · 20 for 18,000.
- Up to 2 continues per round (3 with VIP). VIP adds 2 free continues every week (topped up, never stacked).
- No continues in the Daily; continued runs aren't sent to Game Center.

# Paid continues (consumables)

The Continues screen sells continues for money next to the Mirror Shards price. Create these in
App Store Connect as **Consumable** in-app purchases (Family Sharing off):

| Product ID | Price | Gives |
|---|---|---|
| mirrordrop.continues.1 | $0.29 | 1 continue |
| mirrordrop.continues.2 | $0.49 | 2 continues |
| mirrordrop.continues.5 | $0.99 | 5 continues |
| mirrordrop.continues.10 | $1.79 | 10 continues |
| mirrordrop.continues.20 | $2.99 | 20 continues |

The game shows the App Store's own price once a product is live. Each purchase is credited exactly
once (by transaction ID) and held by the app until the game confirms it saved the continues, so a
crash or restart can't lose or duplicate them. They are not in `appstore/products.json`, because that
file's workflow creates non-consumables. They're in `xcode/MirrorDrop/Products.storekit` for simulator testing.
