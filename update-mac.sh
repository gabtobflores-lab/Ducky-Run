#!/bin/bash
# Mirror Drop updater for the Mac. Paste into Terminal:
#   curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/update-mac.sh | bash
# It finds your Xcode project's MirrorDrop folder(s), keeps a backup, and downloads the newest game files.
set -euo pipefail
BASE="https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game"
STAMP="$(date +%Y%m%d-%H%M%S)"
find_dirs() {  # folders that contain the given file, Spotlight first, then a plain search
  { mdfind -name "$1" 2>/dev/null; find "$HOME/Desktop" "$HOME/Documents" "$HOME/Downloads" "$HOME/Developer" -name "$1" -not -path "*/.Trash/*" -not -path "*/DerivedData/*" -not -path "*/Mirror Drop backup*" 2>/dev/null; } \
    | grep -v -e DerivedData -e "/.Trash/" -e "backup" -e "/Library/" | xargs -I{} dirname "{}" | sort -u
}
get() { curl -fsSL "$BASE/$1" -o "$2.new" && mv "$2.new" "$2"; }
updated=0
while IFS= read -r d; do
  [ -f "$d/index.html" ] || continue
  echo "Updating $d"
  mkdir -p "$d/../Mirror Drop backup $STAMP"; cp "$d/MirrorDropApp.swift" "$d/index.html" "$d/../Mirror Drop backup $STAMP/"
  get app-update/MirrorDropApp.swift "$d/MirrorDropApp.swift"
  get app-update/index.html "$d/index.html"
  updated=1
done < <(find_dirs MirrorDropApp.swift)
while IFS= read -r d; do
  echo "Updating native $d"
  mkdir -p "$d/../Mirror Native backup $STAMP"; cp "$d"/*.swift "$d/../Mirror Native backup $STAMP/"
  curl -fsSL "$BASE/app-update/native-files.txt" | while IFS= read -r f; do [ -n "$f" ] && get "native/MirrorDrop/$f" "$d/$f"; done
  updated=1
done < <(find_dirs GameScene.swift)
if [ "$updated" = 1 ]; then echo; echo "Done. In Xcode press ▶ (if it asks, choose 'Use Version on Disk')."
else echo "Couldn't find the MirrorDrop folder. Put the project on your Desktop or in Documents and run this again."; fi
