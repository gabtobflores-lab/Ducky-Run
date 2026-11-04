# Converts baked PNG layers to WebP (with transparency) and writes them into mirror.html between the /*BAKE*/ markers,
# so the scenery ships inside the game and works offline. Usage: python3 tools/bake/embed.py key=path.png[:quality] ...
import sys, io, base64, re
from PIL import Image
items = []
for a in sys.argv[1:]:
    k, v = a.split('=', 1); q = 82
    if ':' in v: v, q = v.rsplit(':', 1); q = int(q)
    im = Image.open(v).convert('RGBA'); b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6, alpha_quality=90)
    items.append((k, base64.b64encode(b.getvalue()).decode())); print(k, im.size, round(len(b.getvalue()) / 1024), 'KB')
s = open('mirror.html').read()
blk = '/*BAKE*/const BAKED = {' + ','.join(f"{k}:'data:image/webp;base64,{d}'" for k, d in items) + '};/*BAKE END*/'
if '/*BAKE*/' in s: s = re.sub(r'/\*BAKE\*/.*?/\*BAKE END\*/', lambda m: blk, s, count=1, flags=re.S)
else: sys.exit('no /*BAKE*/ marker in mirror.html')
open('mirror.html', 'w').write(s); print('embedded', len(items))
