#!/bin/bash
# Puts the native Swift version on your Desktop and opens it in Xcode. Paste into Terminal:
#   curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/install-native.sh | bash
set -euo pipefail
DEST="$HOME/Desktop/Mirror Drop Native"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
echo "Downloading the native version..."
curl -fsSL "https://codeload.github.com/gabtobflores-lab/ducky-run/zip/refs/heads/claude/ducky-run-game" -o "$tmp/repo.zip"
unzip -q "$tmp/repo.zip" "*/native/*" -d "$tmp"
if [ -e "$DEST" ]; then mv "$DEST" "$DEST backup $(date +%Y%m%d-%H%M%S)"; fi
mv "$tmp"/*/native "$DEST"
echo "✅ Saved to your Desktop: Mirror Drop Native"
open "$DEST/MirrorDrop.xcodeproj"
