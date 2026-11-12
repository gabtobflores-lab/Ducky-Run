# Fits the 2D renderer's layout/colour settings so a heavily blurred, low-res version of our frame matches the target's
# composition and colour. Fine detail is never compared, so all texture stays our own renderer's.
import numpy as np, subprocess, os, sys, json, tempfile
from PIL import Image
from scipy import ndimage as nd
from concurrent.futures import ThreadPoolExecutor
GW, GH = 24, 52
def coarse(path):
    a = np.asarray(Image.open(path).convert('RGB').resize((201, 437), Image.BILINEAR), np.float32) / 255
    a = nd.gaussian_filter(a, (6, 6, 0))
    return np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((GW, GH), Image.BILINEAR), np.float32) / 255
TGT = coarse('../apple-aurora-frame.jpg')
P = {  # name: (start, lo, hi)
 'EXPO': (0.4, 0.15, 0.9), 'FOCX': (0.47, 0.25, 0.65), 'FOCW': (0.32, 0.12, 0.5), 'HEMY': (0.62, 0.45, 0.8),
 'MRISE': (0.28, 0.1, 0.5), 'ZOOM': (1.5, 1.0, 2.0), 'ZCY': (0.58, 0.35, 0.75), 'XV': (-0.12, -0.8, 0.3),
 'SIDE': (0.3, 0.0, 1.5), 'SIDX': (0.52, 0.3, 0.7), 'TEALK': (2.6, 0.0, 5.0), 'LCK': (1.5, 0.0, 4.0),
 'LCX': (0.22, 0.05, 0.4), 'LCY': (0.7, 0.5, 0.95), 'LOWG': (0.35, 0.0, 1.5), 'BOTK': (0.3, 0.0, 1.5),
 'BOTV': (0.45, 0.0, 1.5), 'GLOW': (1.6, 0.5, 4.0), 'TOPY': (0.15, 0.0, 0.35), 'LOWR': (8, 0, 25),
 'LOWY': (0.75, 0.6, 0.95), 'VIOL': (2.0, 0.0, 4.0), 'STEM': (0.25, 0.0, 0.8),
}
names = list(P)
td = tempfile.mkdtemp(dir='.')
def loss(x, tag):
    env = dict(os.environ, **{k: f'{v:.4f}' for k, v in zip(names, x)})
    out = f'{td}/{tag}.png'
    subprocess.run(['python3', 'real.py', '201', '437', out, '0'], env=env, check=True)
    c = coarse(out)
    d = 10 * (((c - TGT) ** 2).mean() + 0.5 * ((c.mean(-1) - TGT.mean(-1)) ** 2).mean() + 2 * ((np.sort(c.max(-1).ravel())[-60:] - np.sort(TGT.max(-1).ravel())[-60:]) ** 2).mean())
    return float(d)
lo = np.array([P[k][1] for k in names]); hi = np.array([P[k][2] for k in names])
best = np.array([P[k][0] for k in names]); import os.path
if os.path.exists('fit_best.json'): jb = json.load(open('fit_best.json')); best = np.array([jb.get(k, P[k][0]) for k in names])
bl = loss(best, 'start'); print('start', round(bl, 4), flush=True)
rng = np.random.default_rng(1); sig = 0.15
N = int(sys.argv[1]) if len(sys.argv) > 1 else 400
it = 0
with ThreadPoolExecutor(4) as ex:
    while it < N:
        cands = [np.clip(best + rng.normal(0, sig, len(names)) * (hi - lo) * (rng.random(len(names)) < 0.35), lo, hi) for _ in range(8)]
        ls = list(ex.map(lambda a: loss(a[1], f'c{it}_{a[0]}'), enumerate(cands)))
        it += 8; k = int(np.argmin(ls))
        if ls[k] < bl: bl, best = ls[k], cands[k]; print(it, round(bl, 4), flush=True)
        if it % 80 == 0: sig = max(sig * 0.8, 0.03)
json.dump(dict(zip(names, map(float, best))), open('fit_best.json', 'w'), indent=1)
print('final', round(bl, 4)); print(json.dumps(dict(zip(names, [round(float(v), 3) for v in best]))))
