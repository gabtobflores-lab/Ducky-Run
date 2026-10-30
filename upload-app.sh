#!/bin/bash
# Archives Mirror Drop and uploads it to App Store Connect (and TestFlight) with your Mac's Xcode. Paste into Terminal:
#   curl -fsSL https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game/upload-app.sh | bash
# Uses your App Store Connect API key (AuthKey_XXXX.p8 in Downloads). Nothing on your iPhone is needed.
set -uo pipefail
BASE="https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/claude/ducky-run-game"
SHA=$(curl -fsSL -H "Accept: application/vnd.github.sha" "https://api.github.com/repos/gabtobflores-lab/ducky-run/commits/claude/ducky-run-game" 2>/dev/null)
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] && BASE="https://raw.githubusercontent.com/gabtobflores-lab/ducky-run/$SHA"
CFG="$HOME/.mirrordrop"; mkdir -p "$CFG"
ask() { # $1 file, $2 question, $3 pattern the answer must match: asks once (on screen), then remembers it
  local v=""; [ -s "$CFG/$1" ] && v=$(cat "$CFG/$1")
  until [[ "$v" =~ $3 ]]; do
    echo "$2" > /dev/tty; read -r v < /dev/tty; v=$(echo "$v" | tr -d '[:space:]')
    [[ "$v" =~ $3 ]] || echo "That doesn't look right, try again." > /dev/tty
  done
  echo "$v" > "$CFG/$1"; echo "$v"; }

P8=$(ls -t "$HOME"/Downloads/AuthKey_*.p8 "$HOME"/Desktop/AuthKey_*.p8 2>/dev/null | head -1)
[ -n "$P8" ] || { echo "I can't find your API key file (AuthKey_….p8) in Downloads. Download it from App Store Connect → Users and Access → Integrations → App Store Connect API, then run this again."; exit 1; }
KEY_ID=$(basename "$P8" .p8); KEY_ID=${KEY_ID#AuthKey_}
ISSUER=$(ask issuer "Paste the Issuer ID (App Store Connect → Users and Access → Integrations → App Store Connect API, shown above the Team Keys list; a long code with dashes), then press Return:" '^[0-9a-fA-F-]{36}$')

# the Mirror Drop project (the one with index.html and MirrorDropApp.swift, not the native test one)
PROJ=""
while IFS= read -r f; do d=$(dirname "$f"); [ -f "$d/index.html" ] && [ ! -f "$d/GameScene.swift" ] || continue
  PROJ=$(ls -d "$d"/../*.xcodeproj 2>/dev/null | head -1); [ -n "$PROJ" ] && break
done < <({ mdfind -name MirrorDropApp.swift 2>/dev/null; find "$HOME/Downloads" "$HOME/Desktop" "$HOME/Documents" -maxdepth 4 -name MirrorDropApp.swift 2>/dev/null; } | grep -v -e DerivedData -e " backup ")
[ -n "$PROJ" ] || { echo "I couldn't find your Mirror Drop Xcode project."; exit 1; }
PROJ=$(cd "$(dirname "$PROJ")" && pwd)/$(basename "$PROJ")
echo "Project: $PROJ"
TEAM=$(grep -m1 -o 'DEVELOPMENT_TEAM = [A-Z0-9]\{10\}' "$PROJ/project.pbxproj" | awk '{print $3}')
[ -n "$TEAM" ] || TEAM=$(ask team "Paste your Team ID (developer.apple.com/account → Membership details, 10 letters and numbers), then press Return:" '^[A-Z0-9]{10}$')
SCHEME=$(perl -0ne 'if (/\w{24} \/\* ([^*]+?) \*\/ = \{\s*isa = PBXNativeTarget;/) { print "$1" }' "$PROJ/project.pbxproj")

# the bundle ID must match the app in App Store Connect: ask Apple for it
W=$(mktemp -d)
curl -fsSL "$BASE/tools/fix_iap_screenshots.swift" -o "$W/asc.swift" || { echo "Download failed. Check your internet and try again."; exit 1; }
echo "Asking App Store Connect for the app's bundle ID…"
BUNDLE=$(MODE=bundle KEY_ID="$KEY_ID" ISSUER_ID="$ISSUER" P8="$P8" SHOTS="" swift "$W/asc.swift") || { rm -f "$CFG/issuer"; echo; echo "Apple didn't accept the key. Run this line again and paste the Issuer ID carefully."; echo "Also check that the newest AuthKey file in Downloads is the key you just made (the old one can be deleted)."; exit 1; }
BUILD=$(date +%Y%m%d%H%M)
echo "App: $BUNDLE · team $TEAM · version 1.0 ($BUILD)"
AUTH=(-allowProvisioningUpdates -authenticationKeyPath "$P8" -authenticationKeyID "$KEY_ID" -authenticationKeyIssuerID "$ISSUER")

# xcodebuild needs the full Xcode app; if Terminal points at the Command Line Tools, use the Xcode app directly (no settings changed)
if ! xcodebuild -version >/dev/null 2>&1; then
  XC=$( { mdfind "kMDItemCFBundleIdentifier == 'com.apple.dt.Xcode'" 2>/dev/null; ls -d /Applications/Xcode*.app 2>/dev/null; } | grep -v "^$" | head -1)
  [ -n "$XC" ] || { echo "✗ I can't find the Xcode app. Is it in Applications?"; exit 1; }
  export DEVELOPER_DIR="$XC/Contents/Developer"
fi
echo "Using $(xcodebuild -version 2>/dev/null | head -1)"
echo; echo "Archiving (a few minutes)…"
ARCH="$HOME/Desktop/MirrorDrop-$BUILD.xcarchive"
xcodebuild -project "$PROJ" -scheme "$SCHEME" -configuration Release -destination 'generic/platform=iOS' -archivePath "$ARCH" archive \
  DEVELOPMENT_TEAM="$TEAM" PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE" MARKETING_VERSION=1.0 CURRENT_PROJECT_VERSION="$BUILD" \
  CODE_SIGN_STYLE=Automatic INFOPLIST_KEY_ITSAppUsesNonExemptEncryption=NO "${AUTH[@]}" > "$W/archive.log" 2>&1
if [ ! -d "$ARCH" ]; then echo "✗ Archive failed. The important lines:"; grep -E "error:|failed" "$W/archive.log" | sort -u | head -20; exit 1; fi
echo "✓ Archived"

cat > "$W/export.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>$TEAM</string>
  <key>signingStyle</key><string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
PLIST
echo "Uploading to App Store Connect…"
xcodebuild -exportArchive -archivePath "$ARCH" -exportOptionsPlist "$W/export.plist" -exportPath "$W/out" "${AUTH[@]}" > "$W/upload.log" 2>&1
if grep -q "EXPORT SUCCEEDED\|Upload succeeded\|Uploaded" "$W/upload.log"; then
  echo "✅ Uploaded. Apple processes it in about 10–30 minutes; then pick it under Build on the 1.0 version page, and in TestFlight."
else echo "✗ Upload failed. The important lines:"; grep -E "error|Error|failed" "$W/upload.log" | sort -u | head -20; exit 1; fi
