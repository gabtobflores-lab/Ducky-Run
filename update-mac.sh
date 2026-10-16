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

update_web() {  # $1 = the MirrorDrop folder with index.html + MirrorDropApp.swift
  echo "Updating: $1"
  mkdir -p "$1/../Mirror Drop backup $STAMP"; cp "$1/MirrorDropApp.swift" "$1/index.html" "$1/../Mirror Drop backup $STAMP/" 2>/dev/null
  get app-update/MirrorDropApp.swift "$1/MirrorDropApp.swift"
  get app-update/index.html "$1/index.html"
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
