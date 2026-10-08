# Publishing Mirror Drop

Everything you need is in the **`release/`** folder. It is the finished game as a web app: it installs to the iPhone home screen with its own icon, opens full screen like a native app, and keeps working offline once it has been opened.

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

## Option 2: the App Store

Apple only accepts native apps, so the web app is wrapped in a thin native shell. You need a Mac with Xcode and an Apple Developer Program membership ($99 a year).

1. Install Node.js, then in an empty folder run:
   ```
   npm init -y
   npm install @capacitor/core @capacitor/cli @capacitor/ios
   npx cap init "Mirror Drop" com.yourname.mirrordrop --web-dir release
   ```
2. Copy the `release` folder into that folder, then run:
   ```
   npx cap add ios
   npx cap open ios
   ```
3. In Xcode: set your team under *Signing & Capabilities*, set *Device Orientation* to Portrait only, and drop `app-store-icon-1024.png` into *Assets → AppIcon*.
4. Choose *Product → Archive*, then *Distribute App* to upload it to App Store Connect.
5. In App Store Connect, add screenshots (play each event in the iOS Simulator and press ⌘S), a description and an age rating, then submit for review.

## After you change the game

The game's source is `mirror.html`. After editing it, run

```
bash tools/build-release.sh
```

to rebuild `release/`, then upload the folder again (for the App Store, also run `npx cap copy ios` and archive a new build). Every build gets a new version number, so players get the update the next time they open the game.
