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
rm -f "$out"; (cd "$tmp" && zip -qr -X - "Mirror Drop") > "$out"
echo "Built $out ($(du -h "$out" | cut -f1))"
