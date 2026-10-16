#!/usr/bin/env bash
# Refreshes app-update/: the exact files the Mac updater copies into the Xcode project's MirrorDrop folder.
# Run tools/build-release.sh first so release/index.html is current.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p app-update
cp swift-app/MirrorDropApp.swift app-update/MirrorDropApp.swift
python3 - release/index.html app-update/index.html <<'PY'
import re, sys
s = open(sys.argv[1]).read()
for name in ('AURSRC', 'FLOWSRC'):
    s, n = re.subn(name + r" = 'data:[^']*'", name + " = ''", s)
    assert n == 1, name
open(sys.argv[2], 'w').write(s)
PY
(cd native/MirrorDrop && ls *.swift) > app-update/native-files.txt
echo "app-update/ refreshed"
