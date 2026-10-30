#!/bin/bash
# Fixes the review screenshot on every Mirror Drop in-app purchase, directly with Apple. Paste into Terminal:
#   curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/fix-screenshots.sh | bash
# Needs your App Store Connect API key file (AuthKey_XXXX.p8) in Downloads. Packs are never deleted.
set -uo pipefail
BASE="https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game"
SHA=$(curl -fsSL -H "Accept: application/vnd.github.sha" "https://api.github.com/repos/gabtobflores-lab/ducky-run/commits/claude/ducky-run-game" 2>/dev/null)
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] && BASE="https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/$SHA"
P8=$(ls -t "$HOME"/Downloads/AuthKey_*.p8 "$HOME"/Desktop/AuthKey_*.p8 2>/dev/null | head -1)
if [ -z "$P8" ]; then
  echo "I can't find your API key file (AuthKey_….p8) in Downloads."
  echo "In App Store Connect: Users and Access → Integrations → App Store Connect API → Team Keys → +"
  echo "(name: Mirror Drop, access: Admin) → Generate → Download. Then run this line again."
  open "https://appstoreconnect.apple.com/access/integrations/api" 2>/dev/null; exit 1
fi
KEY_ID=$(basename "$P8" .p8); KEY_ID=${KEY_ID#AuthKey_}
echo "Using key $KEY_ID ($P8)"
echo "Paste the Issuer ID (shown above the keys list in App Store Connect → Integrations), then press Return:"
read -r ISSUER_ID < /dev/tty
ISSUER_ID=$(echo "$ISSUER_ID" | tr -d '[:space:]')
W=$(mktemp -d)
curl -fsSL "$BASE/tools/fix_iap_screenshots.swift" -o "$W/fix.swift" || { echo "Download failed. Check your internet and try again."; exit 1; }
SHOTS=""
for s in 1206x2622 1179x2556 1290x2796 1242x2688 640x920; do
  curl -fsSL "$BASE/appstore/review/shot-$s.png" -o "$W/shot-$s.png" && SHOTS="$SHOTS${SHOTS:+|}$W/shot-$s.png"
done
echo
KEY_ID="$KEY_ID" ISSUER_ID="$ISSUER_ID" P8="$P8" SHOTS="$SHOTS" swift "$W/fix.swift"
