# Colours one frame of the ray-traced black hole from the saved light paths (trace.py).
# The disk turns in a seamless loop: it is split into rings, each turning a whole number of times per loop,
# faster near the hole (Keplerian), with silky structure that is periodic in angle, so frame 1.0 equals frame 0.0.
# Usage: python3 shade.py trace.npz out.png phase [scale]
import numpy as np, sys, os
from scipy import ndimage as nd
from PIL import Image

D = np.load(sys.argv[1]); out = sys.argv[2]; ph = float(sys.argv[3]); SC = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
H, W = int(D['H']), int(D['W']); hit, fate, dirn = D['hit'], D['fate'], D['dir']
RIN, ROUT = 2.6, float(os.environ.get('ROUT', 17.0))
rng = np.random.default_rng(7)
NB = 26; edges = RIN * (ROUT / RIN) ** np.linspace(0, 1, NB + 1)            # rings, finer near the hole
turns = np.maximum(1, np.round(3.4 * (3.0 / np.sqrt(edges[:-1] * edges[1:])) ** 1.5)).astype(int)   # whole turns per loop
M = np.arange(2, 40); amp = rng.random((NB, M.size)) * (1.0 / M) ** .55; phs = rng.random((NB, M.size)) * 2 * np.pi

def disk(r, phi):
    b = np.clip(np.searchsorted(edges, r) - 1, 0, NB - 1)
    p = phi - 2 * np.pi * turns[b] * ph                                     # the turning
    s = np.zeros_like(r)
    for m_i, m in enumerate(M): s += amp[b, m_i] * np.cos(m * p + phs[b, m_i])
    s = s / 2.2
    fine = .5 + .5 * np.sin(r * 9.0 + 3 * np.sin(r * 1.7))                  # fine concentric rings
    T = (r / RIN) ** -.75 * np.clip(1 - np.sqrt(2.4 / r), 0, 1) ** .25        # a thin disk's temperature
    I = T ** float(os.environ.get('TP', 2.6)) * (1 + .55 * s) * (.82 + .18 * fine)
    I *= np.clip((r - RIN) / .5, 0, 1) * np.clip((ROUT - r) / 6, 0, 1) ** 1.5
    # mild Doppler: the side turning towards us a little brighter (the film kept it subtle)
    I *= 1 + .28 * np.sin(phi)
    k = np.clip((r - RIN) / (ROUT * .6 - RIN), 0, 1)[..., None]
    col = np.array([1.0, .95, .86]) * (1 - k) + np.array([1.0, .62, .28]) * k
    return I[..., None] * col

img = np.zeros((H, W, 3))
# sky: stars and a faint Milky Way where the rays escape
esc = fate == 1
th = np.arccos(np.clip(dirn[..., 1], -1, 1)); az = np.arctan2(dirn[..., 2], dirn[..., 0])
gx = (az / (2 * np.pi) + .5) * 2400; gy = th / np.pi * 1200
cx, cy = np.floor(gx), np.floor(gy); hsh = np.sin(cx * 127.1 + cy * 311.7) * 43758.5453; hsh -= np.floor(hsh)
fx, fy = gx - cx - .5, gy - cy - .5
star = np.where(hsh > .985, np.exp(-(fx * fx + fy * fy) * 40) * ((hsh - .985) / .015) ** 2 * 3, 0)
band = np.exp(-((th - np.pi / 2 - .35 * np.sin(az)) / .22) ** 2) * .012
sky = (star[..., None] * np.array([1, .97, .93]) * .5 + band[..., None] * np.array([.55, .5, .62]) + np.array([.001, .001, .002])) * esc[..., None] # space stays near black: the disk is the only light
# the disk: the nearest crossing in front, the second seen through where the first is thin
for c in (1, 0):
    h = hit[c]; m = h[..., 2] > 0
    if not m.any(): continue
    col = np.zeros((H, W, 3)); col[m] = disk(h[..., 0][m], h[..., 1][m])
    alpha = np.clip(np.linalg.norm(col, axis=-1) * 1.6, 0, .97)[..., None] * m[..., None]
    img = img * (1 - alpha) + col
img = img * 1.15 * SC + sky
# bloom: light spilling softly round the brightest parts, as a camera lens would
bl = sum(nd.gaussian_filter(img, (s, s, 0)) * w for s, w in ((W * .006, .35), (W * .025, .25), (W * .08, .18)))
img = img + bl
img = 1 - np.exp(-img * 1.35)
img = np.clip(img, 0, 1) ** (1 / 1.06)
Image.fromarray((img * 255 + np.random.default_rng(int(ph * 997)).random((H, W, 1)) * .9).clip(0, 255).astype(np.uint8)).save(out)
