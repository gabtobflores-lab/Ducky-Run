#!/usr/bin/env bash
# Builds "Mirror Drop Native.zip": the native Swift / SpriteKit version of the game as a ready-to-open Xcode project.
set -euo pipefail
cd "$(dirname "$0")/.."
out="${1:-Mirror Drop Native.zip}"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/Mirror Drop Native"
cp -R native/. "$tmp/Mirror Drop Native/"
rm -f "$out"; (cd "$tmp" && zip -qr -X - "Mirror Drop Native") > "$out"
echo "Built $out ($(du -h "$out" | cut -f1))"
