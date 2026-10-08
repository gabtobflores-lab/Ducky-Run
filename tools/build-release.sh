#!/usr/bin/env bash
# Builds release/ from mirror.html: a ready-to-upload web app (installable, works offline).
# Usage: bash tools/build-release.sh
set -euo pipefail
cd "$(dirname "$0")/.."
out=release
ver=$(git rev-parse --short HEAD 2>/dev/null || date +%s)
mkdir -p "$out"

# the game, with the install manifest and the offline helper switched on
python3 - "$out/index.html" <<'PY'
import sys
s = open('mirror.html').read()
s = s.replace('<title>Mirror Drop</title>', '<title>Mirror Drop</title>\n<link rel="manifest" href="manifest.webmanifest">', 1)
s = s.replace('</body>', "<script>if ('serviceWorker' in navigator && (location.protocol === 'https:' || (location.protocol === 'http:' && location.hostname === 'localhost'))) navigator.serviceWorker.register('sw.js').catch(() => {});</script>\n</body>", 1)
open(sys.argv[1], 'w').write(s)
PY

cat > "$out/manifest.webmanifest" <<'JSON'
{
  "name": "Mirror Drop",
  "short_name": "Mirror Drop",
  "description": "Guide two mirrored balls through falling blocks, through fog, storms, hail, aurora and meteor showers.",
  "start_url": "./",
  "scope": "./",
  "display": "fullscreen",
  "orientation": "portrait",
  "background_color": "#f6f1ea",
  "theme_color": "#f6f1ea",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
JSON

cat > "$out/sw.js" <<JS
// Offline support: always tries the network first so updates arrive straight away, and falls back to the saved copy offline.
const CACHE = 'mirror-drop-$ver';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
JS
echo "Built $out/ (version $ver)"
