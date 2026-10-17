#!/usr/bin/env bash
# Refreshes app-update/: the exact files the Mac updater (update-mac.sh) copies into the Xcode project's MirrorDrop folder.
#   index.html          the game with the aurora video as its own file (aurora.mp4): about 300 KB, so the app opens fast
#   aurora.mp4          that video
#   index-inline.html   the game with the video built in, for projects that don't pick up new files by themselves
# Run tools/build-release.sh first so release/index.html is current.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p app-update
cp swift-app/MirrorDropApp.swift app-update/MirrorDropApp.swift
python3 - release/index.html app-update <<'PY'
import base64, re, sys
s = open(sys.argv[1]).read(); out = sys.argv[2]
# iPhones always play the aurora video, so the app leaves out the 16-frame backup aurora
for name in ('AURSRC', 'FLOWSRC'):
    s, n = re.subn(name + r" = 'data:[^']*'", name + " = ''", s)
    assert n == 1, name
# the app needs neither the web install manifest, the offline helper nor the home-screen icons (iOS uses the app's own icon)
s = s.replace('<link rel="manifest" href="manifest.webmanifest">\n', '', 1)
s = re.sub(r'<link rel="(apple-touch-icon|icon)"[^>]*>\n?', '', s)
s = re.sub(r"<script>if \('serviceWorker' in navigator[^\n]*</script>\n", '', s)
open(out + '/index-inline.html', 'w').write(s)
m = re.search(r"(const AURVID = \{ type: '[^']*', )data: '([A-Za-z0-9+/=]+)'", s)
assert m, 'AURVID'
open(out + '/aurora.mp4', 'wb').write(base64.b64decode(m.group(2)))
s = s[:m.start()] + m.group(1) + "src: 'aurora.mp4', data: ''" + s[m.end():]
open(out + '/index.html', 'w').write(s)
PY
(cd native/MirrorDrop && ls *.swift) > app-update/native-files.txt
ls -la app-update
