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
8. **Privacy and support links.** Apple needs both. Put your email into `release/privacy.html`, upload the `release` folder (Option 1), and use `https://your-site/privacy.html` for both.
9. **Submit for review.** Reviews usually take one to two days.

## After you change the game

The game's source is `mirror.html`. After editing it, run

```
bash tools/build-release.sh
```

to rebuild `release/`, then upload the folder again. For the App Store, run `npm run ios`, raise the *Build* number in Xcode (*App → General*), and archive again. Every build gets a new version number, so players get the update the next time they open the game.
