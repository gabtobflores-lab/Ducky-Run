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
  PROJ=$(ls -d "$d"/../*.xcodeproj 2>/dev/null | head -1); [ -n "$PROJ" ] && { APPDIR="$d"; break; }
done < <({ mdfind -name MirrorDropApp.swift 2>/dev/null; find "$HOME/Downloads" "$HOME/Desktop" "$HOME/Documents" -maxdepth 4 -name MirrorDropApp.swift 2>/dev/null; } | grep -v -e DerivedData -e " backup ")
[ -n "$PROJ" ] || { echo "I couldn't find your Mirror Drop Xcode project."; exit 1; }
PROJ=$(cd "$(dirname "$PROJ")" && pwd)/$(basename "$PROJ")
echo "Project: $PROJ"
SCHEME=$(perl -0ne 'if (/\w{24} \/\* ([^*]+?) \*\/ = \{\s*isa = PBXNativeTarget;/) { print "$1" }' "$PROJ/project.pbxproj")

# the bundle ID must match the app in App Store Connect: ask Apple for it
W=$(mktemp -d)
curl -fsSL "$BASE/tools/fix_iap_screenshots.swift" -o "$W/asc.swift" || { echo "Download failed. Check your internet and try again."; exit 1; }
echo "Asking App Store Connect for the app's bundle ID…"
BUNDLE=$(MODE=bundle KEY_ID="$KEY_ID" ISSUER_ID="$ISSUER" P8="$P8" SHOTS="" swift "$W/asc.swift") || { rm -f "$CFG/issuer"; echo; echo "Apple didn't accept the key. Run this line again and paste the Issuer ID carefully."; echo "Also check that the newest AuthKey file in Downloads is the key you just made (the old one can be deleted)."; exit 1; }
BUILD=$(date +%Y%m%d%H%M)
AUTH=(-authenticationKeyPath "$P8" -authenticationKeyID "$KEY_ID" -authenticationKeyIssuerID "$ISSUER")

# App Store signing: a distribution certificate (its private key is made here and stays on this Mac) and an App Store profile
SIGN="$CFG/signing"; mkdir -p "$SIGN"
if [ ! -s "$SIGN/dist.key" ]; then
  openssl genrsa -out "$SIGN/dist.key" 2048 2>/dev/null
  openssl req -new -key "$SIGN/dist.key" -out "$SIGN/dist.csr" -subj "/CN=Mirror Drop Distribution/C=US" 2>/dev/null
fi
echo "Setting up App Store signing with Apple…"
SOUT=$(MODE=sign OUT="$SIGN" BUNDLE="$BUNDLE" KEY_ID="$KEY_ID" ISSUER_ID="$ISSUER" P8="$P8" SHOTS="" swift "$W/asc.swift" 2>/dev/null)
echo "$SOUT" | grep -v "^PROFILE_"
PROFILE_NAME=$(echo "$SOUT" | sed -n 's/^PROFILE_NAME=//p'); PROFILE_UUID=$(echo "$SOUT" | sed -n 's/^PROFILE_UUID=//p')
[ -n "$PROFILE_NAME" ] && [ -s "$SIGN/app.mobileprovision" ] || { echo "✗ Signing setup failed (see above)."; exit 1; }
TEAM=$(security cms -D -i "$SIGN/app.mobileprovision" 2>/dev/null | plutil -extract TeamIdentifier.0 raw -o - - 2>/dev/null)
[[ "$TEAM" =~ ^[A-Z0-9]{10}$ ]] || { echo "✗ Couldn't read the team from Apple's profile."; exit 1; }
# the certificate into the login keychain, plus Apple's intermediate certificate so the chain is complete
if [ -s "$SIGN/dist.cer" ] && { [ ! -f "$SIGN/imported" ] || [ "$SIGN/dist.cer" -nt "$SIGN/imported" ]; }; then
  openssl x509 -inform DER -in "$SIGN/dist.cer" -out "$SIGN/dist.pem" 2>/dev/null
  openssl pkcs12 -export -inkey "$SIGN/dist.key" -in "$SIGN/dist.pem" -out "$SIGN/dist.p12" -passout pass:mirrordrop 2>/dev/null \
    || openssl pkcs12 -legacy -export -inkey "$SIGN/dist.key" -in "$SIGN/dist.pem" -out "$SIGN/dist.p12" -passout pass:mirrordrop
  curl -fsSL https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer -o "$SIGN/wwdr.cer" && security import "$SIGN/wwdr.cer" -k "$HOME/Library/Keychains/login.keychain-db" >/dev/null 2>&1
  security import "$SIGN/dist.p12" -k "$HOME/Library/Keychains/login.keychain-db" -P mirrordrop -T /usr/bin/codesign -T /usr/bin/productbuild >/dev/null && touch "$SIGN/imported"
  echo "✓ certificate added to your keychain (if a box asks to allow codesign, click Always Allow)"
fi
for pdir in "$HOME/Library/MobileDevice/Provisioning Profiles" "$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"; do
  mkdir -p "$pdir"; cp "$SIGN/app.mobileprovision" "$pdir/$PROFILE_UUID.mobileprovision"
done
echo "App: $BUNDLE · team $TEAM · version 1.0 ($BUILD)"

# the newest game into the project before building, with our own pre-rendered aurora video (replaces any older aurora.mp4)
curl -fsSL "$BASE/app-update/index.html" -o "$W/index.html" && [ "$(wc -c < "$W/index.html")" -gt 100000 ] && cp "$W/index.html" "$APPDIR/index.html" || { echo "✗ Couldn't download the game. Check your internet and try again."; exit 1; }
curl -fsSL "$BASE/app-update/MirrorDropApp.swift" -o "$W/MirrorDropApp.swift" && [ -s "$W/MirrorDropApp.swift" ] && cp "$W/MirrorDropApp.swift" "$APPDIR/MirrorDropApp.swift"
# our own pre-rendered videos, when they exist; otherwise any older copy is removed and the game draws that event live
for vid in aurora blackhole; do
  if curl -fsSL "$BASE/app-update/$vid.mp4" -o "$W/$vid.mp4" 2>/dev/null && [ "$(wc -c < "$W/$vid.mp4")" -gt 100000 ]; then cp "$W/$vid.mp4" "$APPDIR/$vid.mp4"; echo "✓ our own $vid video copied into the project"
  else rm -f "$APPDIR/$vid.mp4"; echo "· no $vid video yet: the game draws it live"; fi
done
echo "✓ newest game copied into the project"

# xcodebuild needs the full Xcode app; if Terminal points at the Command Line Tools, use the Xcode app directly (no settings changed)
if ! xcodebuild -version >/dev/null 2>&1; then
  XC=$( { mdfind "kMDItemCFBundleIdentifier == 'com.apple.dt.Xcode'" 2>/dev/null; ls -d /Applications/Xcode*.app 2>/dev/null; } | grep -v "^$" | head -1)
  [ -n "$XC" ] || { echo "✗ I can't find the Xcode app. Is it in Applications?"; exit 1; }
  export DEVELOPER_DIR="$XC/Contents/Developer"
fi
echo "Using $(xcodebuild -version 2>/dev/null | head -1)"
# 120 Hz on ProMotion iPhones: without this key iOS caps the game at 60 frames a second
for PL in "$APPDIR/Info.plist" "$APPDIR"/*/Info.plist; do [ -f "$PL" ] && /usr/libexec/PlistBuddy -c "Delete :CADisableMinimumFrameDurationOnPhone" -c "Add :CADisableMinimumFrameDurationOnPhone bool true" "$PL" >/dev/null 2>&1 && echo "✓ 120 Hz enabled"; done
echo; echo "Archiving (a few minutes)…"
ARCH="$HOME/Desktop/MirrorDrop-$BUILD.xcarchive"
xcodebuild -project "$PROJ" -scheme "$SCHEME" -configuration Release -destination 'generic/platform=iOS' -archivePath "$ARCH" archive \
  DEVELOPMENT_TEAM="$TEAM" PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE" MARKETING_VERSION=1.0 CURRENT_PROJECT_VERSION="$BUILD" \
  CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="Apple Distribution" PROVISIONING_PROFILE_SPECIFIER="$PROFILE_NAME" \
  INFOPLIST_KEY_ITSAppUsesNonExemptEncryption=NO INFOPLIST_KEY_CADisableMinimumFrameDurationOnPhone=YES > "$W/archive.log" 2>&1
if [ ! -d "$ARCH" ]; then echo "✗ Archive failed. The important lines:"; grep -E "error:|failed" "$W/archive.log" | sort -u | head -20; exit 1; fi
echo "✓ Archived"

cat > "$W/export.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>$TEAM</string>
  <key>signingStyle</key><string>manual</string>
  <key>signingCertificate</key><string>Apple Distribution</string>
  <key>provisioningProfiles</key><dict><key>$BUNDLE</key><string>$PROFILE_NAME</string></dict>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
PLIST
echo "Uploading to App Store Connect…"
xcodebuild -exportArchive -archivePath "$ARCH" -exportOptionsPlist "$W/export.plist" -exportPath "$W/out" -allowProvisioningUpdates "${AUTH[@]}" > "$W/upload.log" 2>&1
if grep -q "EXPORT SUCCEEDED\|Upload succeeded\|Uploaded" "$W/upload.log"; then
  echo "✅ Uploaded. Apple processes it in about 10–30 minutes; then pick it under Build on the 1.0 version page, and in TestFlight."
else echo "✗ Upload failed. The important lines:"; grep -E "error|Error|failed" "$W/upload.log" | sort -u | head -20; exit 1; fi
