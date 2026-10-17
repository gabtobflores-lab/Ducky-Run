#!/bin/bash
# Mirror Drop updater for the Mac. Paste into Terminal:
#   curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/update-mac.sh | bash
# It finds your Xcode project's MirrorDrop folder(s), keeps a backup, and downloads the newest game files.
set -uo pipefail
BASE="https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game"
# GitHub caches files on the branch for a few minutes, so files come from the newest commit itself: never a stale copy
SHA=$(curl -fsSL -H "Accept: application/vnd.github.sha" "https://api.github.com/repos/gabtobflores-lab/ducky-run/commits/claude/ducky-run-game" 2>/dev/null)
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] && BASE="https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/$SHA"
STAMP="$(date +%Y%m%d-%H%M%S)"

# folders holding the given file: Spotlight, then a search of the home folder (iCloud Desktop/Documents included)
dirs_of() {
  { mdfind -name "$1" 2>/dev/null; find "$HOME" -maxdepth 8 -name "$1" -not -path "*/Library/Developer/*" -not -path "*/Library/Caches/*" 2>/dev/null; } \
    | grep -v -e DerivedData -e "/.Trash/" -e " backup " -e "/Library/Developer/" -e "/Library/Caches/" \
    | while IFS= read -r f; do dirname "$f"; done | sort -u
}
get() { curl -fsSL "$BASE/$1" -o "$2.new" && mv "$2.new" "$2" || { echo "  ⚠️ download failed: $1"; rm -f "$2.new"; }; }

synced() { grep -q FileSystemSynchronized "$1"/../*.xcodeproj/project.pbxproj 2>/dev/null; }  # Xcode 16 projects pick up new files by themselves

update_web() {  # $1 = the MirrorDrop folder with index.html + MirrorDropApp.swift
  echo "Updating: $1"
  local bk="$1/../Mirror Drop backup $STAMP"
  mkdir -p "$bk"; cp "$1/MirrorDropApp.swift" "$1/index.html" "$bk/" 2>/dev/null; cp "$1/aurora.mp4" "$bk/" 2>/dev/null
  get app-update/MirrorDropApp.swift "$1/MirrorDropApp.swift"
  if synced "$1"; then
    # the small, fast-opening game file plus the aurora video beside it
    get app-update/index.html "$1/index.html"
    get app-update/aurora.mp4 "$1/aurora.mp4"
    echo "  fast-launch version installed"
  else
    get app-update/index-inline.html "$1/index.html"
    echo "  all-in-one version installed (this project doesn't pick up new files, so the video stays inside the game file)"
  fi
  # iOS's launch screen looks exactly like the game's loading screen, so opening the app flows straight into it
  local plist="$1/../Info.plist"
  if [ -d "$1/Assets.xcassets" ] && [ -f "$plist" ] && [ -x /usr/libexec/PlistBuddy ]; then
    mkdir -p "$1/Assets.xcassets/LaunchCream.colorset"
    cat > "$1/Assets.xcassets/LaunchCream.colorset/Contents.json" <<'JSON'
{ "colors" : [ { "color" : { "color-space" : "srgb", "components" : { "alpha" : "1.000", "red" : "0xF6", "green" : "0xF1", "blue" : "0xEA" } }, "idiom" : "universal" } ],
  "info" : { "author" : "xcode", "version" : 1 } }
JSON
    /usr/libexec/PlistBuddy -c "Delete :UILaunchScreen" "$plist" >/dev/null 2>&1
    # and the loading screen's two balls in the middle, so the game is visibly starting from the very first moment
    mkdir -p "$1/Assets.xcassets/LaunchBalls.imageset"
    for f in Contents.json balls@2x.png balls@3x.png; do get "app-update/LaunchBalls.imageset/$f" "$1/Assets.xcassets/LaunchBalls.imageset/$f"; done
    /usr/libexec/PlistBuddy -c "Add :UILaunchScreen dict" -c "Add :UILaunchScreen:UIColorName string LaunchCream" -c "Add :UILaunchScreen:UIImageName string LaunchBalls" "$plist" >/dev/null 2>&1
  fi
  # Supporter's gold app icon: the icon set, plus the project setting that lets iOS switch to it
  if [ -d "$1/Assets.xcassets" ]; then
    mkdir -p "$1/Assets.xcassets/AppIcon-Gold.appiconset"
    for f in Contents.json icon-1024.png; do get "app-update/AppIcon-Gold.appiconset/$f" "$1/Assets.xcassets/AppIcon-Gold.appiconset/$f"; done
    local pbx; pbx=$(ls "$1"/../*.xcodeproj/project.pbxproj 2>/dev/null | head -1)
    if [ -f "$pbx" ] && ! grep -q ALTERNATE_APPICON_NAMES "$pbx"; then
      cp "$pbx" "$bk/project.pbxproj"
      perl -pi -e 's/^(\s*)ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;/$1ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;\n$1ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = "AppIcon-Gold";/' "$pbx"
    fi
  fi
  updated=1
}

# A project made from Xcode's Storyboard template has its own AppDelegate marked @main, so pasting the game's app file
# into it gives "'main' attribute can only apply to one type". This turns such a project into a normal Mirror Drop project:
# the template's start-up is switched off, the pasted copy is emptied, and the game's files go into the app folder.
fix_template() {  # $1 = the Swift file with a pasted copy of the game's app code
  local f="$1" root d app pbx plist
  d=$(dirname "$f"); root=""
  for c in "$d" "$(dirname "$d")" "$(dirname "$(dirname "$d")")"; do ls "$c"/*.xcodeproj >/dev/null 2>&1 && { root="$c"; break; }; done
  [ -n "$root" ] || return
  if [ -n "$(find "$root" -name GameScene.swift -not -path "* backup *" 2>/dev/null | head -1)" ]; then
    cp "$f" "$root/Mirror Drop backup $STAMP-$(basename "$f")" 2>/dev/null
    printf '// Not used: the native Mirror Drop starts from App.swift.\n' > "$f"; return; fi
  app=$(find "$root" -name AppDelegate.swift -not -path "*DerivedData*" -not -path "* backup *" 2>/dev/null | head -1)
  [ -n "$app" ] || return
  app=$(dirname "$app")
  if ! grep -q FileSystemSynchronized "$root"/*.xcodeproj/project.pbxproj 2>/dev/null; then
    echo "  ⚠️ $root was made from Xcode's Storyboard template and doesn't pick up new files by itself."
    echo "     In Xcode, delete AppDelegate.swift and SceneDelegate.swift (Move to Trash), then run this again."; return; fi
  echo "Fixing the project setup: $root"
  local bk="$root/Mirror Drop backup $STAMP"; mkdir -p "$bk"
  cp "$app/AppDelegate.swift" "$f" "$bk/" 2>/dev/null
  # the template's start-up file stays in the project but no longer starts the app
  perl -pi -e 'next if /^\s*\/\//; s/(?<!\w)\@(main|UIApplicationMain)\b/\/* \@$1 (Mirror Drop starts from MirrorDropApp.swift) *\//g' "$app/AppDelegate.swift"
  # the pasted copy stays in the project (Xcode lists it) but is emptied; the real file goes in the app folder
  [ "$(basename "$f")" != MirrorDropApp.swift ] && printf '// Mirror Drop now lives in MirrorDropApp.swift, in the app folder.\n' > "$f"
  # no storyboard or scene delegate at launch: the game's own SwiftUI app opens the window
  for plist in "$app/Info.plist" "$root/Info.plist"; do
    [ -f "$plist" ] && { cp "$plist" "$bk/" 2>/dev/null; /usr/libexec/PlistBuddy -c "Delete :UIApplicationSceneManifest:UISceneConfigurations" -c "Delete :UIMainStoryboardFile" "$plist" >/dev/null 2>&1; }
  done
  pbx=$(ls "$root"/*.xcodeproj/project.pbxproj 2>/dev/null | head -1)
  if [ -f "$pbx" ]; then cp "$pbx" "$bk/project.pbxproj"; perl -ni -e 'print unless /INFOPLIST_KEY_UIMainStoryboardFile|INFOPLIST_KEY_UISceneDelegateClassName/' "$pbx"; fi
  [ -f "$app/index.html" ] || : > "$app/index.html"   # update_web fills it in
  [ -f "$app/MirrorDropApp.swift" ] || : > "$app/MirrorDropApp.swift"
}
if pgrep -x Xcode >/dev/null 2>&1; then
  echo "Closing Xcode first, so it can't save its old copies over the fixed files..."
  osascript -e 'tell application "Xcode" to quit' >/dev/null 2>&1; sleep 3
  reopen_xcode=1
fi
for f in Desktop Documents Downloads; do
  [ -e "$HOME/$f" ] && ! ls "$HOME/$f" >/dev/null 2>&1 && echo "  ⚠️ Terminal isn't allowed to look in your $f folder. Allow it in System Settings → Privacy & Security → Files and Folders → Terminal, then run this again."
done
while IFS= read -r f; do
  [ "$(basename "$f")" = MirrorDropApp.swift ] && continue
  fix_template "$f"
done < <(find "$HOME/Desktop" "$HOME/Documents" "$HOME/Downloads" -maxdepth 4 -name "*.swift" -not -path "*/DerivedData/*" -not -path "* backup *" 2>/dev/null \
          | while IFS= read -r f; do grep -lE 'struct MirrorDropApp *: *App' "$f" 2>/dev/null; done)

updated=0
echo "Looking for your Mirror Drop project (this can take a minute)..."
while IFS= read -r d; do [ -f "$d/GameScene.swift" ] && continue; [ -f "$d/index.html" ] && update_web "$d"; done < <(dirs_of MirrorDropApp.swift)
while IFS= read -r d; do
  [ -f "$d/Weather.swift" ] || continue
  echo "Updating native: $d"
  nb="$d/../Mirror Native backup $STAMP"; mkdir -p "$nb"; cp "$d"/*.swift "$nb/"
  # only one file may start the app: App.swift. The web version's files and the Xcode template's start-up are moved aside.
  for w in "$d"/*.swift; do
    [ "$(basename "$w")" = App.swift ] && continue
    if grep -qE 'struct MirrorDropApp *: *App' "$w" 2>/dev/null; then
      if grep -q FileSystemSynchronized "$d"/../*.xcodeproj/project.pbxproj 2>/dev/null; then mv "$w" "$nb/"; else printf '// Not used: the native Mirror Drop starts from App.swift.\n' > "$w"; fi
    fi
  done
  grep -q FileSystemSynchronized "$d"/../*.xcodeproj/project.pbxproj 2>/dev/null && [ -f "$d/index.html" ] && mv "$d/index.html" "$nb/"
  # files from Xcode's Game, App and Storyboard templates: not part of Mirror Drop, and they clash with it, so they're emptied
  for t in AppDelegate.swift SceneDelegate.swift ViewController.swift GameViewController.swift ContentView.swift; do
    [ -f "$d/$t" ] && ! grep -q "^// Not used" "$d/$t" && printf '// Not used: the native Mirror Drop starts from App.swift.\n' > "$d/$t"
  done
  # and the template's storyboard start-up is switched off, so the game's own window is the one you see
  for pl in "$d/Info.plist" "$d/../Info.plist"; do
    [ -f "$pl" ] && /usr/libexec/PlistBuddy -c "Delete :UIMainStoryboardFile" -c "Delete :UIApplicationSceneManifest:UISceneConfigurations" "$pl" >/dev/null 2>&1
  done
  for pbx in "$d"/../*.xcodeproj/project.pbxproj; do [ -f "$pbx" ] && perl -ni -e 'print unless /INFOPLIST_KEY_UIMainStoryboardFile/' "$pbx"; done
  for f in $(curl -fsSL "$BASE/app-update/native-files.txt"); do get "native/MirrorDrop/$f" "$d/$f"; done
  updated=1
done < <(dirs_of GameScene.swift)

if [ "$updated" = 0 ]; then
  echo
  echo "I couldn't find it by myself."
  echo "Open Finder, drag your project's MirrorDrop folder (the one with index.html inside) into this window, then press Return:"
  read -r d < /dev/tty
  d="${d%"${d##*[![:space:]]}"}"; d="${d%/}"; d="${d//\\ / }"; d="${d#\'}"; d="${d%\'}"
  if [ -f "$d/index.html" ]; then update_web "$d"
  else echo "That folder has no index.html inside, so nothing was changed."; exit 1; fi
fi
echo
if [ "${reopen_xcode:-0}" = 1 ]; then
  echo "✅ Updated. Reopening Xcode: press ⇧⌘K (Clean Build Folder), then ▶."
  open -a Xcode >/dev/null 2>&1
else echo "✅ Updated. In Xcode press ⇧⌘K (Clean Build Folder), then ▶ (if it asks, choose 'Use Version on Disk')."; fi
