#!/bin/bash
# Puts the newest Mirror Drop iPhone app on your Desktop and opens Sideloadly to install it. Paste into Terminal:
#   curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/phone-mac.sh | bash
set -uo pipefail
OUT="$HOME/Desktop/MirrorDrop.ipa"
echo "Downloading the newest Mirror Drop for iPhone..."
if curl -fL --progress-bar "https://github.com/gabtobflores-lab/ducky-run/releases/download/phone/MirrorDrop.ipa" -o "$OUT.new"; then
  mv "$OUT.new" "$OUT"; echo "  ✅ Saved to your Desktop: MirrorDrop.ipa"
else rm -f "$OUT.new"; echo "  ⚠️ The download didn't work. Check your internet connection and try again."; exit 1; fi
if [ -d /Applications/Sideloadly.app ]; then
  open -a Sideloadly "$OUT" 2>/dev/null || open -a Sideloadly
  echo "Sideloadly is open: plug in your iPhone, type your Apple ID email, press Start."
else
  echo "Sideloadly isn't installed yet. Opening its download page: install it, then run this line again."
  open "https://sideloadly.io/#download"
fi
