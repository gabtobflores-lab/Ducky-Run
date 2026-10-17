#!/bin/bash
# Mirror Drop updater for the Mac. Paste into Terminal:
#   curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/update-mac.sh | bash
# It finds your Xcode project's MirrorDrop folder(s), keeps a backup, and downloads the newest game files.
set -uo pipefail
BASE="https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game"
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

updated=0
echo "Looking for your Mirror Drop project (this can take a minute)..."
while IFS= read -r d; do [ -f "$d/index.html" ] && update_web "$d"; done < <(dirs_of MirrorDropApp.swift)
while IFS= read -r d; do
  [ -f "$d/Weather.swift" ] || continue
  echo "Updating native: $d"
  mkdir -p "$d/../Mirror Native backup $STAMP"; cp "$d"/*.swift "$d/../Mirror Native backup $STAMP/"
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
echo "✅ Updated. In Xcode press ▶ (if it asks, choose 'Use Version on Disk')."
