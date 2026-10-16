#!/usr/bin/env bash
# Builds "Mirror Drop Xcode.zip": a ready-to-open Xcode project with the game already inside.
# Run tools/build-release.sh first so release/index.html is current.
set -euo pipefail
cd "$(dirname "$0")/.."
out="${1:-Mirror Drop Xcode.zip}"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/Mirror Drop"
cp -R xcode/. "$tmp/Mirror Drop/"
cp swift-app/MirrorDropApp.swift "$tmp/Mirror Drop/MirrorDrop/MirrorDropApp.swift"
cp release/index.html "$tmp/Mirror Drop/MirrorDrop/index.html"
# iPhones always play the aurora video (Low Power Mode is unlocked by the first tap), so the app leaves out
# the 16-frame backup aurora: about 4 MB less for the phone to read at launch
python3 - "$tmp/Mirror Drop/MirrorDrop/index.html" <<'PY'
import re, sys
p = sys.argv[1]; s = open(p).read()
for name in ('AURSRC', 'FLOWSRC'):
    s, n = re.subn(name + r" = 'data:[^']*'", name + " = ''", s)
    assert n == 1, name
open(p, 'w').write(s)
PY
rm -f "$out"; (cd "$tmp" && zip -qr -X - "Mirror Drop") > "$out"
echo "Built $out ($(du -h "$out" | cut -f1))"
