#!/usr/bin/env bash
# Refreshes app-update/: the exact files the Mac updater (update-mac.sh) copies into the Xcode project's MirrorDrop folder.
#   index.html          the game, about 400 KB (the aurora is drawn by the GPU, so there is no video to carry)
#   index-inline.html   the same file, kept for older updaters that ask for it
# Run tools/build-release.sh first so release/index.html is current.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p app-update
ver=$(git rev-parse --short HEAD 2>/dev/null || date +%s)
# both halves carry the version, so the start-up check shows whether the iPhone really runs the newest build
sed "s/static let appBuild = \"dev\"/static let appBuild = \"$ver\"/" swift-app/MirrorDropApp.swift > app-update/MirrorDropApp.swift
export VER="$ver"
python3 - release/index.html app-update <<'PY'
import base64, re, sys
s = open(sys.argv[1]).read(); out = sys.argv[2]
import os
s = s.replace('<title>Mirror Drop</title>', '<title>Mirror Drop</title>\n<meta name="build" content="' + os.environ.get('VER', 'dev') + '">', 1)
# the app needs neither the web install manifest, the offline helper nor the home-screen icons (iOS uses the app's own icon)
s = s.replace('<link rel="manifest" href="manifest.webmanifest">\n', '', 1)
s = re.sub(r'<link rel="(apple-touch-icon|icon)"[^>]*>\n?', '', s)
s = re.sub(r"<script>if \('serviceWorker' in navigator[^\n]*</script>\n", '', s)
open(out + '/index-inline.html', 'w').write(s)
if os.path.exists(out + '/aurora.mp4'): os.remove(out + '/aurora.mp4')
open(out + '/index.html', 'w').write(s)
PY
(cd native/MirrorDrop && ls *.swift) > app-update/native-files.txt
ls -la app-update
