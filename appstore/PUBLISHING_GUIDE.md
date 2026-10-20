# Mirror Drop: everything you need to publish

Work through this top to bottom in App Store Connect (appstore.apple.com → Apps → Mirror Drop). Anything marked **you** is a click only you can do; everything else is already built and waiting.

---

## 0. Before you submit: one thing to change

**The aurora uses Apple's own iOS wallpaper animation.** App Review guideline 5.2 (Intellectual Property) says apps can't use Apple's images, wallpapers or artwork, so this is a likely rejection. Ask Claude to replace it with an original aurora (same look and colours, drawn by the game itself) before you press Submit. The aurora screenshot will then be re-captured the same way the others were.

---

## 1. Money: agreements, tax and banking (you, ~15 min, once)

Purchases do **not** work anywhere, not even in TestFlight, until this is done.

1. App Store Connect → **Business** (top bar).
2. **Agreements**: accept the **Paid Apps Agreement**. Only the Account Holder can accept it. If the developer account is in a parent's name, they need to do this.
3. **Tax Forms**: fill in the **U.S. tax form** (W-9 for a US person). If you are outside the US, Apple shows the right form for your country.
4. **Bank Accounts**: add the bank account Apple pays into (account holder's name must match the developer account).
5. Wait until the agreement's status is **Active** (usually minutes, sometimes a day).

Apple pays monthly, within about 45 days of the end of each of its fiscal months, once your earnings pass the payment threshold for your bank's country (around $150 in the US). Apple keeps **15%** if you join the **App Store Small Business Program** (free; apply at developer.apple.com/app-store/small-business-program). Otherwise it keeps 30%. Apply before you launch.

## 2. Connect GitHub to App Store Connect (you, ~10 min, once)

This lets the cloud build upload to TestFlight and create the packs for you.

1. App Store Connect → **Users and Access → Integrations → App Store Connect API → Team Keys → +**. Name `GitHub`, access **Admin**, Generate, **Download** the `.p8` file (only possible once).
2. Note the **Key ID** (next to the key) and the **Issuer ID** (above the list).
3. developer.apple.com/account → **Membership details** → **Team ID** (10 characters).
4. github.com/gabtobflores-lab/Ducky-Run/settings/secrets/actions → **New repository secret**, four times:

| Name | Value |
|---|---|
| `APPLE_TEAM_ID` | Team ID |
| `ASC_KEY_ID` | Key ID |
| `ASC_ISSUER_ID` | Issuer ID |
| `ASC_KEY_P8` | the whole `.p8` file opened in TextEdit, BEGIN and END lines included |

If your app's bundle ID is not `com.gabtobflores.mirrordrop`, add a fifth secret `BUNDLE_ID` with the right one.

Then tell Claude: it runs **In-app purchase setup** (creates all 10 packs) and **TestFlight** (uploads the app).

## 3. Website: privacy policy and marketing page (you, 1 click)

github.com/gabtobflores-lab/Ducky-Run/settings/pages → **Deploy from a branch** → branch `gh-pages`, folder `/ (root)` → **Save**. After a minute:

- **Marketing URL:** https://gabtobflores-lab.github.io/Ducky-Run/
- **Support URL:** https://gabtobflores-lab.github.io/Ducky-Run/
- **Privacy Policy URL:** https://gabtobflores-lab.github.io/Ducky-Run/privacy.html

## 4. App Information (App Store Connect → your app → App Information)

| Field | Value |
|---|---|
| Name (30 max) | **Mirror Drop+** (or the name you reserved) |
| Subtitle (30 max) | **Two balls. One tap.** |
| Bundle ID | com.gabtobflores.mirrordrop |
| Primary category | Games → **Arcade** |
| Secondary category | Games → **Casual** |
| Content Rights | "Does your app contain, show, or access third-party content?" **No** (after the aurora is replaced) |
| Age Rating | answer **None / No** to every question → **4+**. "In-App Purchases": Yes (it's listed automatically). |

## 5. Pricing and Availability

- **Price:** **Free** (USD 0.00). The money comes from the packs.
- **Availability:** all countries and regions.

## 6. App Privacy

- **Privacy Policy URL:** https://gabtobflores-lab.github.io/Ducky-Run/privacy.html
- **Data collection:** choose **"No, we do not collect data from this app."** Result: **Data Not Collected**.
  (Scores and profile stay on the phone; Game Center and payments are handled by Apple, which doesn't count as you collecting data.)

## 7. In-app purchases (the packs)

Created automatically once step 2 is done. For reference, all are **Non-Consumable** and Family Sharing is on:

| Product ID | Price | Shown as |
|---|---|---|
| mirrordrop.plus | $0.99 | Plus: Chill and Zen |
| mirrordrop.pro | $1.79 | Pro: Hard, storms and hail |
| mirrordrop.max | $1.99 | Max: every mode, every event, the Daily Challenge |
| mirrordrop.supporter | $4.99 | Supporter: everything + the Golden Run, gold icon, cards, ring and badge |
| mirrordrop.upgrade.pro.from.plus | $0.79 | Plus → Pro |
| mirrordrop.upgrade.max.from.plus | $0.99 | Plus → Max |
| mirrordrop.upgrade.max.from.pro | $0.29 | Pro → Max |
| mirrordrop.upgrade.supporter.from.plus | $3.99 | Plus → Supporter |
| mirrordrop.upgrade.supporter.from.pro | $3.29 | Pro → Supporter |
| mirrordrop.upgrade.supporter.from.max | $2.99 | Max → Supporter |

Each gets its name, description, US price (Apple sets the other countries), every country, and the review screenshot. Each should then show **Ready to Submit**.
**Important:** the very first packs must be submitted **with** the first app version. On the version page, in **In-App Purchases and Subscriptions**, click **+** and add all 10.

## 8. Game Center

App Store Connect → your app → **Services → Game Center** → turn on, then create these **13 Classic leaderboards**: *Score format* Integer, *Submission* Best Score, *Sort* High to Low, *Range* 0 to 1,000,000, plus an English display name. IDs must match exactly:

| Leaderboard ID | Display name |
|---|---|
| mirrordrop.chill | Chill |
| mirrordrop.easy | Easy |
| mirrordrop.normal | Normal |
| mirrordrop.hard | Hard |
| mirrordrop.insane | Insane |
| mirrordrop.impossible | Impossible |
| mirrordrop.infinite.chill | Chill · Infinite |
| mirrordrop.infinite.easy | Easy · Infinite |
| mirrordrop.infinite.normal | Normal · Infinite |
| mirrordrop.infinite.hard | Hard · Infinite |
| mirrordrop.infinite.insane | Insane · Infinite |
| mirrordrop.infinite.impossible | Impossible · Infinite |
| mirrordrop.daily | Daily Challenge |

Then on the version page, under **Game Center**, add all 13.

## 9. Version page (iOS App → 1.0 Prepare for Submission)

**Screenshots:** upload the 8 images in `appstore/screenshots-2026/` in order to the **6.9" iPhone** slot (1320 × 2868). Apple scales them for every smaller iPhone.

1. Chill to Impossible (menu)
2. Play under the northern lights
3. Feel the wind
4. Keep your nerve
5. No Wi-Fi? No problem.
6. Make a wish
7. Ride out the storm
8. Two balls. One tap.

**Promotional text (170 max, change any time without review):**
> Two balls, one tap, eight living skies. Dodge falling blocks through storms, fog and the northern lights. No ads, no tracking, plays fully offline.

**Description (4000 max):**
> **Two balls. One tap.**
>
> Mirror Drop is a calm-looking, fast-playing arcade game. Every tap moves both balls at once, mirrored across the screen. At the edge, they turn around. Thread them through the falling blocks, grab gems to build your combo, and every ten seconds the world speeds up.
>
> **A sky that's alive**
> The weather changes while you play, and each event looks and feels different: shimmering northern lights, storms with lightning that charges the blocks, meteor showers under a real moon, rolling fog, hail, wind gusts that push you off course, heat haze and blinding sun.
>
> **Your pace**
> • Six difficulties, from Chill to Impossible
> • Normal races to 1,000, Infinite never ends, and Zen is a calm run you can't lose
> • A Daily Challenge: one run a day, the same for everyone, with its own leaderboard
> • Two or three columns per side
> • Game Center leaderboards for every difficulty
> • Share your best with a beautiful score card
>
> **Free to play, fair to pay**
> Easy and Normal are free forever. Unlock more with a one-time pack: no subscription, no ads, nothing to grind. Supporters get the Golden Run: beat your best and the balls turn to liquid gold.
>
> **Plays anywhere**
> No Wi-Fi needed, no account, no tracking. Smooth on every iPhone, respects Reduce Motion, and pauses itself the moment you leave.
>
> One tap to learn. One more run, every time.

**Keywords (100 max):**
```
offline,arcade,reflex,dodge,one tap,casual,weather,aurora,storm,mirror,endless,daily,zen,balls
```

**Support URL / Marketing URL:** see step 3.
**Version:** 1.0  **Copyright:** `2026 ` + the account holder's name.

**App Review Information:**
- Sign-in required: **No**.
- Contact: the account holder's name, phone and email.
- Notes:
> Mirror Drop is free; Easy and Normal are always playable. One-time packs unlock more difficulties, modes and weather (Plus, Pro, Max, Supporter, and upgrades that cost the difference). To see the packs, tap a locked difficulty on the slider, the Daily Challenge button, or the profile picture → Unlock. Restore Purchases is on the same screen. The game needs no internet and no account.

**Build:** pick the newest build that the TestFlight workflow uploaded.
**Release:** "Manually release this version" is safest for the first launch.

## 10. TestFlight (to try it on your iPhone before release)

1. After the TestFlight workflow uploads a build, wait 10–30 min for **Processing** to finish (App Store Connect → TestFlight).
2. **Internal Testing → +** → create a group (e.g. "Me") → add yourself (your Apple ID must be a user in Users and Access).
3. On your iPhone, open the **TestFlight** app: Mirror Drop appears with **Install**. No code needed.
4. Purchases in TestFlight are free test purchases. They don't charge you.

For other people (family, friends): **External Testing** → add a group → testers by email or a public link. The first external build needs a short Beta App Review, and these fields:

- **Beta App Description:**
> Mirror Drop is a calm, one-tap arcade game. Guide two mirrored balls through falling blocks: every tap moves both, and at the edge they turn around. Six difficulties, weather events like fog, storms and hail, Infinite and Zen modes, a Daily Challenge and Game Center leaderboards. No ads, no subscription, works offline.
- **Feedback Email:** gabtobflores@gmail.com
- **Marketing URL / Privacy Policy URL:** see step 3.
- **What to Test:**
> Play a few runs on different difficulties and modes. Try the packs (TestFlight purchases are free), Restore Purchases, the Daily Challenge, Game Center sign-in and sharing a score. Tell us about anything that feels slow, confusing or unpolished.

## 11. Submit

Version page → **Add for Review** → **Submit to App Review**. Reviews usually take a day or two. If Apple asks a question, it appears in **App Review → Messages**; reply there.

## 12. Testing purchases in Xcode's simulator (any time)

Run the update line, press ▶. The project's scheme uses the local test store (`Products.storekit`), so every pack can be bought for free in the simulator. Xcode → **Debug → StoreKit → Manage Transactions** lets you delete purchases to test again.
