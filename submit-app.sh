#!/bin/bash
# Puts the newest build on version 1.0, adds every ready pack to the review and submits Mirror Drop to App Review. Paste into Terminal:
#   curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/submit-app.sh | bash
set -uo pipefail
BASE="https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game"
SHA=$(curl -fsSL -H "Accept: application/vnd.github.sha" "https://api.github.com/repos/gabtobflores-lab/ducky-run/commits/claude/ducky-run-game" 2>/dev/null)
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] && BASE="https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/$SHA"
CFG="$HOME/.mirrordrop"; mkdir -p "$CFG"
P8=$(ls -t "$HOME"/Downloads/AuthKey_*.p8 "$HOME"/Desktop/AuthKey_*.p8 2>/dev/null | head -1)
[ -n "$P8" ] || { echo "I can't find your API key file (AuthKey_….p8) in Downloads."; exit 1; }
KEY_ID=$(basename "$P8" .p8); KEY_ID=${KEY_ID#AuthKey_}
ISSUER=$(cat "$CFG/issuer" 2>/dev/null)
until [[ "$ISSUER" =~ ^[0-9a-fA-F-]{36}$ ]]; do echo "Paste the Issuer ID (App Store Connect → Users and Access → Integrations), then press Return:"; read -r ISSUER < /dev/tty; ISSUER=$(echo "$ISSUER" | tr -d '[:space:]'); done
echo "$ISSUER" > "$CFG/issuer"
BUNDLE=com.claudineaguilera.mirrordrop
W=$(mktemp -d); curl -fsSL "$BASE/tools/fix_iap_screenshots.swift" -o "$W/asc.swift" || { echo "Download failed."; exit 1; }
MODE=submit FORCE="${FORCE:-0}" BUNDLE="$BUNDLE" KEY_ID="$KEY_ID" ISSUER_ID="$ISSUER" P8="$P8" SHOTS="" swift "$W/asc.swift" 2>/dev/null
