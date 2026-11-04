#!/bin/bash
# Saves your answer to App Store Connect's Content Rights question. Paste into Terminal:
#   curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/rights-app.sh | bash
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
echo
echo "Apple asks: Does your app contain, show, or access third-party content?"
echo "(Content you didn't make yourself, e.g. images, video or music owned by someone else.)"
A=""; until [[ "$A" =~ ^(yes|no)$ ]]; do echo "Type yes or no, then press Return:"; read -r A < /dev/tty; A=$(echo "$A" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]'); done
if [ "$A" = yes ]; then
  R=""; until [[ "$R" =~ ^(yes|no)$ ]]; do echo "Apple then asks: Do you have all necessary rights to that third-party content? Type yes or no:"; read -r R < /dev/tty; R=$(echo "$R" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]'); done
  [ "$R" = yes ] || { echo "Apple won't accept the app without the rights to that content, so nothing was saved."; exit 1; }
fi
MODE=rights ANSWER="$A" BUNDLE="$BUNDLE" KEY_ID="$KEY_ID" ISSUER_ID="$ISSUER" P8="$P8" SHOTS="" swift "$W/asc.swift"
