# Publishing Mirror Drop

Everything you need is in the **`release/`** folder. It is the finished game as a web app: it installs to the iPhone home screen with its own icon, opens full screen like a native app, and keeps working offline once it has been opened.

**No internet needed.** The game never goes online: every image, effect and line of code is inside `index.html`. Once someone has opened your link a single time (or added it to their home screen), it opens and plays with no connection at all, even in aeroplane mode. The App Store version from Option 2 is offline from the start.

| File | What it is |
|---|---|
| `index.html` | The game |
| `manifest.webmanifest` | App name, icon and colours used when someone installs it |
| `sw.js` | Offline support |
| `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` | Home-screen icons |
| `app-store-icon-1024.png` | The 1024×1024 icon App Store Connect asks for |

## Option 1: put it on the web (5 minutes, free)

1. Download the `release` folder from this repository.
2. Go to **app.netlify.com/drop** and drag the `release` folder onto the page.
3. Netlify gives you a link such as `https://mirror-drop-123.netlify.app`. You can rename it in Netlify's site settings.
4. On an iPhone, open the link in Safari, tap **Share → Add to Home Screen**. Mirror Drop now sits on the home screen with its icon and opens full screen.

Cloudflare Pages, Vercel and GitHub Pages work the same way: upload the contents of `release/`. The site must be served over `https://` for offline support to switch on; all of these do that automatically.

## Option 2: the App Store ($0.99)

The iOS project is already set up in `ios/`: iPhone only, portrait only, full screen, your icon and launch screen, and the encryption question answered. You need a Mac with Xcode, Node.js (nodejs.org), and an Apple Developer Program membership ($99 a year).

1. **One-time setup in App Store Connect** (appstoreconnect.apple.com): under *Business*, accept the **Paid Apps agreement** and add your bank and tax details. Apple won't sell a $0.99 app until this is done.
2. **Pick your app ID.** Open `capacitor.config.json` and change `com.yourname.mirrordrop` to something unique to you: replace `yourname` with your own name or studio name.
3. **Open the project.** In Terminal, in this repository's folder:
   ```
   npm install
   npm run ios
   ```
   Xcode opens with the app.
4. **Sign it.** In Xcode, click *App* in the left sidebar → *Signing & Capabilities* → choose your Team, and set *Bundle Identifier* to the same ID as step 2.
5. **Try it on your iPhone.** Plug it in, pick it at the top of Xcode, press ▶. Turn on airplane mode and play: it works fully offline.
6. **Upload.** Choose *Any iOS Device* at the top, then *Product → Archive* → *Distribute App* → *App Store Connect*.
7. **Create the listing.** In App Store Connect, make a new app with the same bundle ID, then copy everything from [`appstore/APP_STORE.md`](appstore/APP_STORE.md): name, subtitle, description, keywords, price ($0.99), category, age rating and privacy answers. Upload the eight images from `appstore/screenshots/`.
8. **Game Center.** In Xcode, *Signing & Capabilities* should already list Game Center (the project includes it). In App Store Connect, switch on Game Center for the app and create the 12 leaderboards listed in [`appstore/APP_STORE.md`](appstore/APP_STORE.md), then attach them to the version you submit. To test before release, sign in to a Game Center sandbox account on your iPhone (Settings → Game Center).
9. **Privacy and support links.** Apple needs both. Put your email into `release/privacy.html`, upload the `release` folder (Option 1), and use `https://your-site/privacy.html` for both.
10. **Submit for review.** Reviews usually take one to two days.

## Option 3: the App Store with plain Swift code (no npm, works on iPad)

Apple needs a real app, not an HTML page. [`swift-app/MirrorDropApp.swift`](swift-app/MirrorDropApp.swift) is that app in one Swift file. It shows the game full screen and provides saving and Game Center itself, so you only need two files: that Swift file and `release/index.html`.

**Easiest: the ready-made Xcode project (Mac).** Run `bash tools/build-xcode-zip.sh` (or use the zip you were sent). It makes `Mirror Drop Xcode.zip` with the project, the game, the icon and every iPhone setting already inside.
1. Unzip it and double-click `MirrorDrop.xcodeproj`.
2. Click *MirrorDrop* at the top of the left sidebar → *Signing & Capabilities* → choose your **Team**, and change the Bundle Identifier from `com.yourname.mirrordrop` to your own.
3. Plug in your iPhone, pick it at the top, and press ▶. To publish, use *Product → Archive* as in Option 2, step 6.

**Swift Playgrounds (iPad or Mac):**
1. Make a new **App** project.
2. Open `MyApp.swift`, select everything, and paste in the whole of `MirrorDropApp.swift`. Delete `ContentView.swift`.
3. Add the game: use the **+** button in the sidebar to insert a file, and pick `index.html` from the `release` folder. Keep the name `index.html`.
4. In **App Settings**: set the name, the icon (`release/app-store-icon-1024.png`), portrait orientation, and your bundle ID. Add **Game Center** under Capabilities if it is offered. If it is not, the game still works; only the world leaderboards stay off.
5. Press ▶ to try it, then use **Upload to App Store Connect** in App Settings.

**Xcode (Mac):**
If your project was made with the **Storyboard** interface (it has `AppDelegate.swift`, `SceneDelegate.swift` and `ViewController.swift`), use [`swift-app/ViewController.swift`](swift-app/ViewController.swift) instead: replace everything in `ViewController.swift` with it, do not add `MirrorDropApp.swift`, then do step 3 onwards. For a **SwiftUI** project:

1. *File → New → Project → iOS → App*, interface **SwiftUI**.
2. Replace everything in the `…App.swift` file with `MirrorDropApp.swift`, and delete `ContentView.swift`.
3. Drag `release/index.html` into the project, ticking *Copy items if needed* and your app target. To check it is in the app: click the project → your target → *Build Phases* → *Copy Bundle Resources*, and `index.html` must be listed there (about 10 MB). That file is the whole game; the Swift file only opens it.
4. *Signing & Capabilities → + Capability → Game Center*. Under *General*, set iPhone only and Portrait only.
5. Archive and upload as in Option 2, step 6.

Then create the listing and leaderboards in App Store Connect as in Option 2, steps 7 to 10.

## After you change the game

The game's source is `mirror.html`. After editing it, run

```
bash tools/build-release.sh
```

to rebuild `release/`, then upload the folder again. For the App Store, run `npm run ios`, raise the *Build* number in Xcode (*App → General*), and archive again. Every build gets a new version number, so players get the update the next time they open the game.

## Pricing plan (agreed, to build once the Apple Developer account exists)

Free download, four one-time purchases on one screen (mockup: appstore/paywall-mockup.png). Max is highlighted "Best value" and pre-selected.

| Tier | Price | Role | Unlocks |
|---|---|---|---|
| Free | $0 | hook | Easy and Normal, all weather, Game Center, Share score, one free Hard run per day, Daily Challenge leaderboard visible (locked) |
| Plus | $0.99 | real but looks small | Chill and Zen mode |
| Pro | $1.79 | decoy | Chill, Zen, Hard and Infinite |
| Max | $1.99 | main pick | Everything: Chill, Zen, Hard, Insane, Impossible, Infinite, Daily Challenge |
| Supporter | $4.99 | for fans | All of Max, plus golden balls once a run passes your old best, a gold profile ring and a Supporter badge |

Supporter's golden run: the moment the score passes the old best, both balls turn gold with a soft shimmer and glow, their trail turns gold, a warm chime and a success haptic play, and the score turns gold until the run ends. The share picture shows gold balls and the badge.
Upgrades cost only the difference (for example Pro → Max $0.20, Max → Supporter $3.00).
The offer appears only when tapping a locked difficulty, after the free daily Hard run, and once after a new best on Normal.
No fake timers or fake "was" prices. No ads; the game stays fully offline. Locked difficulties stay visible on the slider with a lock.
