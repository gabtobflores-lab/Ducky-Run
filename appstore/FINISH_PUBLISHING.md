# Finish publishing Mirror Drop: Terminal commands

Run these on your Mac, one at a time, in Terminal. Each downloads the newest version of the
script from this branch and asks for anything it needs (the first time only).

Before you start, have your App Store Connect API key file (`AuthKey_XXXX.p8`) in **Downloads**
(App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys → +).

## 1. Put the newest game into your Xcode project

```
curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/update-mac.sh | bash
```

Tester versions on your own iPhone (they never touch the real game's purchases):

```
curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/update-mac.sh | MD_VARIANT=all bash
curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/update-mac.sh | MD_VARIANT=free bash
```

`all` owns every pack and VIP, has 99,999 Mirror Shards, and adds a Tester panel in the profile
that starts a run with any event. `free` is the free version with everything locked.
Run the first command again (without MD_VARIANT) to go back to the real game before uploading.

## 2. Create the in-app purchases

The one-time packs are created by the repository's IAP workflow from `appstore/products.json`.
**VIP** (`mirrordrop.vip.monthly`) is created by hand: follow `appstore/VIP_SETUP.md`.

## 3. Upload the build

```
curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/upload-app.sh | bash
```

## 4. Fill in the App Store page (text, links, age rating, the 10 new screenshots)

```
curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/fill-app.sh | bash
```

## 5. Answer the Content Rights question

```
curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/rights-app.sh | bash
```

## 6. Submit for review

```
curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/submit-app.sh | bash
```

## Things only you can do in App Store Connect

- Accept the **Paid Apps agreement** and add bank and tax details (Business section).
- **App Privacy**: answer "Data Not Collected".
- **Game Center**: turn it on and attach the leaderboards (listed in `appstore/APP_STORE.md`),
  including `mirrordrop.daily`.
- Add VIP (step 2) to the version before submitting, or submit without it and add it in an update.
