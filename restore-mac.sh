#!/bin/bash
# Puts back the last Mirror Drop version that was confirmed to open on the iPhone. Paste into Terminal:
#   curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/restore-mac.sh | bash
set -uo pipefail
GOOD="https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/c657baeb3431db704ef6e95973df23e603b06b16/app-update"
STAMP="$(date +%Y%m%d-%H%M%S)"
dirs_of() {
  { mdfind -name "$1" 2>/dev/null; find "$HOME" -maxdepth 8 -name "$1" -not -path "*/Library/Developer/*" -not -path "*/Library/Caches/*" 2>/dev/null; } \
    | grep -v -e DerivedData -e "/.Trash/" -e " backup " -e "/Library/Developer/" -e "/Library/Caches/" \
    | while IFS= read -r f; do dirname "$f"; done | sort -u
}
get() { curl -fsSL "$1" -o "$2.new" && mv "$2.new" "$2" || { echo "  ⚠️ download failed: $1"; rm -f "$2.new"; }; }
restored=0
echo "Looking for your Mirror Drop project..."
while IFS= read -r d; do
  [ -f "$d/index.html" ] || continue
  echo "Restoring: $d"
  bk="$d/../Mirror Drop backup $STAMP"; mkdir -p "$bk"; cp "$d/MirrorDropApp.swift" "$d/index.html" "$bk/" 2>/dev/null
  get "$GOOD/MirrorDropApp.swift" "$d/MirrorDropApp.swift"
  get "$GOOD/index.html" "$d/index.html"
  [ -f "$d/aurora.mp4" ] && mv "$d/aurora.mp4" "$bk/"
  rm -rf "$d/Assets.xcassets/LaunchBalls.imageset" "$d/Assets.xcassets/LaunchCream.colorset"
  [ -f "$d/../Info.plist" ] && /usr/libexec/PlistBuddy -c "Delete :UILaunchScreen" "$d/../Info.plist" >/dev/null 2>&1
  restored=1
done < <(dirs_of MirrorDropApp.swift)
if [ "$restored" = 1 ]; then echo; echo "✅ Restored. In Xcode: Product > Clean Build Folder (⇧⌘K), then press ▶."
else echo "Couldn't find the MirrorDrop folder."; fi
