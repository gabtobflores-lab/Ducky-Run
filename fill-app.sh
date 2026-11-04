#!/bin/bash
# Fills in everything on Mirror Drop's 1.0 page that Apple's API can set (text, URLs, category, age rating, screenshots,
# review contact, copyright, Game Center). Paste into Terminal:
#   curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/fill-app.sh | bash
set -uo pipefail
SHA=$(curl -fsSL -H "Accept: application/vnd.github.sha" "https://api.github.com/repos/gabtobflores-lab/ducky-run/commits/claude/ducky-run-game" 2>/dev/null)
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "Couldn't reach GitHub. Check your internet and try again."; exit 1; }
BASE="https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/$SHA"
SITE="https://rawcdn.githack.com/gabtobflores-lab/ducky-run/$SHA/site"   # privacy policy and support page, fixed at this version
CFG="$HOME/.mirrordrop"; mkdir -p "$CFG"
P8=$(ls -t "$HOME"/Downloads/AuthKey_*.p8 "$HOME"/Desktop/AuthKey_*.p8 2>/dev/null | head -1)
[ -n "$P8" ] || { echo "I can't find your API key file (AuthKey_….p8) in Downloads."; exit 1; }
KEY_ID=$(basename "$P8" .p8); KEY_ID=${KEY_ID#AuthKey_}
ISSUER=$(cat "$CFG/issuer" 2>/dev/null)
until [[ "$ISSUER" =~ ^[0-9a-fA-F-]{36}$ ]]; do echo "Paste the Issuer ID, then press Return:"; read -r ISSUER < /dev/tty; ISSUER=$(echo "$ISSUER" | tr -d '[:space:]'); done
echo "$ISSUER" > "$CFG/issuer"
ask() { local v=""; [ -s "$CFG/$1" ] && v=$(cat "$CFG/$1"); while [ -z "$v" ]; do echo "$2" > /dev/tty; read -r v < /dev/tty; done; echo "$v" > "$CFG/$1"; echo "$v"; }
OWNER=$(ask owner "Full name of the account holder (shown to App Review and in the copyright), then press Return:")
PHONE=$(ask phone "Phone number App Review can call, with country code (e.g. +1 555 123 4567), then press Return:")
EMAIL=$(ask email "Email App Review can write to, then press Return:")
W=$(mktemp -d)
curl -fsSL "$BASE/tools/fix_iap_screenshots.swift" -o "$W/asc.swift" || { echo "Download failed."; exit 1; }
SHOTS=""
for n in 01-menu 02-aurora 03-wind 04-fog 05-offline 06-meteor 07-storm 08-sun; do
  curl -fsSL "$BASE/appstore/screenshots-2026/$n.png" -o "$W/$n.png" && SHOTS="$SHOTS${SHOTS:+|}$W/$n.png"
done
echo "Filling in Mirror Drop's 1.0 page…"
MODE=fill SITE="$SITE" OWNER="$OWNER" PHONE="$PHONE" EMAIL="$EMAIL" BUNDLE=com.claudineaguilera.mirrordrop \
  KEY_ID="$KEY_ID" ISSUER_ID="$ISSUER" P8="$P8" SHOTS="$SHOTS" swift "$W/asc.swift"
