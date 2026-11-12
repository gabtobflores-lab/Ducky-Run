#!/bin/bash
# Installs the newest Mirror Drop, clears Xcode's saved builds and the simulated iPhones, then opens the right project.
# Quit Xcode first (⌘Q), then paste into Terminal:
#   curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/fresh-mac.sh | bash
set -uo pipefail
BASE="https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game"
osascript -e 'quit app "Xcode"' -e 'quit app "Simulator"' >/dev/null 2>&1; sleep 2
echo "1/4  Installing the newest game files..."
curl -fsSL "$BASE/update-mac.sh" | bash | grep -v "^$"
echo
echo "2/4  Clearing Xcode's saved builds..."
rm -rf ~/Library/Developer/Xcode/DerivedData/MirrorDrop-* 2>/dev/null
echo "3/4  Resetting the simulated iPhones..."
xcrun simctl shutdown all >/dev/null 2>&1; xcrun simctl erase all >/dev/null 2>&1
echo "4/4  Opening the project..."
proj=""
while IFS= read -r f; do
  d=$(dirname "$f"); [ -f "$d/index.html" ] || continue
  p=$(ls -d "$d"/../*.xcodeproj 2>/dev/null | head -1); [ -n "$p" ] || continue
  v=$(grep -o 'appBuild = "[^"]*"' "$f" | cut -d'"' -f2)
  echo "   project: $(cd "$(dirname "$p")" && pwd)/$(basename "$p")  (version $v)"
  [ -z "$proj" ] && proj="$p"
done < <({ mdfind -name MirrorDropApp.swift 2>/dev/null; find "$HOME" -maxdepth 8 -name MirrorDropApp.swift -not -path "*/Library/*" 2>/dev/null; } | grep -v -e " backup " -e "/.Trash/" -e DerivedData | sort -u)
if [ -n "$proj" ]; then open "$proj"; echo; echo "✅ Done. In Xcode, pick your iPhone (or a simulated one) at the top and press ▶."
  echo "   For the first few seconds the game shows 'build $v' at the bottom: that's the newest version."
else echo "Couldn't find the project."; fi
