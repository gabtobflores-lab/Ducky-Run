#!/usr/bin/env bash
# Two tester builds of the game, never shipped: run after tools/build-app-update.sh
#   tester-all   owns every pack and VIP, 99,999 shards, a panel in the profile to start a run with any event
#   tester-free  the free version: everything locked, purchases ignored
# They leave the real game's purchases and wallet untouched.
set -euo pipefail
cd "$(dirname "$0")/.."
for v in all free; do
  mkdir -p "app-update/tester-$v"
  python3 - "$v" <<'PY'
import sys
v = sys.argv[1]
tag = '<head>\n<script>window.__mdTest = %r;</script>' % v
for src, dst in (('app-update/index.html', 'app-update/tester-%s/index.html' % v), ('release/index.html', 'release/tester-%s.html' % v)):
    s = open(src).read()
    assert '<head>' in s
    s = s.replace('<head>', tag, 1).replace('<title>Mirror Drop</title>', '<title>Mirror Drop (%s tester)</title>' % v, 1)
    open(dst, 'w').write(s)
PY
done
ls -la app-update/tester-all app-update/tester-free release/tester-*.html
