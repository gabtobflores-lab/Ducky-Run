# Mirror Drop aurora, built from ribbons.
# Every light form is a ribbon: a curved centre line with its own angle, length and width. Brightness is a function of the
# distance to that line - a narrow bright core plus an exponential falloff that dissolves into the dark - and of the position
# along it, which tapers to nothing at both ends. No light is a 2D Gaussian and no blur creates the shapes, so there are no
# oval patches. Ribbons sit in three depth layers (far: wide, dim, blue; near: narrow, bright, cyan).
# Usage: python3 ribbons.py W H out.png phase   (phase 0..1 loops seamlessly)
import numpy as np, sys
from scipy import ndimage as nd
from PIL import Image
W, H = int(sys.argv[1]), int(sys.argv[2]); out = sys.argv[3]; ph = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
T = ph * 2 * np.pi
import os
BROAD = float(os.environ.get('BROAD', 1.0))   # strength of the broad light that follows each formation
BW = float(os.environ.get('BW', 1.6))         # its width
BLEND = float(os.environ.get('BLEND', 1.7))   # >1 widens strand cores so they melt together
TEX = float(os.environ.get('TEX', 0.55))
UNIFY = float(os.environ.get('UNIFY', 0.8))   # how strongly the formations gather into one main mass
EXPO = float(os.environ.get('EXPO', 0.77))     # exposure compensation, keeps overall brightness unchanged       # internal texture scale (smaller = larger structures)
v = (np.arange(H, dtype=np.float32) / H)[:, None]            # 0 top .. 1 bottom
u = (np.arange(W, dtype=np.float32) / W)[None, :]
asp = W / H
def col(c): return np.array(c, np.float32) / 255
def n1(t, seed, smooth=8):                                   # smooth 1D noise, unit variance, wraps
    r = np.random.default_rng(seed).standard_normal(2048).astype(np.float32)
    r = nd.gaussian_filter1d(r, smooth, mode='wrap'); r /= r.std() + 1e-6
    return np.interp(np.mod(t, 1.0) * 2047, np.arange(2048), r).astype(np.float32)

def noise2(scale, seed, stretch=1.0):                       # smooth 2D noise in screen units, unit variance; stretch > 1 elongates it vertically
    r = np.random.default_rng(seed).standard_normal((H // 4 + 1, W // 4 + 1)).astype(np.float32)
    r = nd.gaussian_filter(r, (scale * W / 4 * stretch, scale * W / 4), mode='wrap')
    r = nd.zoom(r, 4, order=1)[:H, :W]
    return (r - r.mean()) / (r.std() + 1e-6)
# one shared flow field bends every formation the same way, so they feel like parts of one sky
FLOWX = noise2(0.14, 501, 3.5) * 0.045 + noise2(0.05, 502, 5.0) * 0.01
FLOWY = noise2(0.25, 503, 3.0) * 0.008
U0 = u + FLOWX                                              # warped coordinates: everything below is drawn in them
V0 = v + FLOWY

def ribbon(x0, slope, v0, v1, width, curve, seed, glow=1.0, fil=0.5, strands=4):
    """One aurora formation: several interconnected strands that share a strongly curving path but drift apart, cross and
    merge along it. Each strand changes width and brightness on its own (it can fade out and re-emerge), its edges are
    asymmetric and broken by a small local warp, and a soft volume of light surrounds the whole formation."""
    rr = np.random.default_rng(seed)
    # local edge warp: makes contours uneven and adds wispy extensions
    U = U0 + noise2(0.03, seed + 900, 7.0) * min(width, 0.05) * 0.45   # vertically stretched: uneven edges and wisps, never squiggles
    V = V0
    vm = (v0 + v1) / 2
    # the formation's path: bends and changes direction as it rises (amplitude several times the old ribbons)
    amp = 0.035 + curve * 3.0
    path = (x0 + slope * (V - vm)
            + amp * np.sin(V * 3.1 + seed * 1.7 + 0.5 * np.sin(T + seed))
            + amp * 0.3 * np.sin(V * 5.3 + seed * 0.9 - 0.4 * np.cos(T + seed * 0.7))
            + 0.03 * n1(V * 0.7 + 0.03 * np.sin(T + seed), seed, 160)
            + 0.02 * np.sin(T + seed * 1.3))
    tot = np.zeros((H, W), np.float32); vol = np.zeros((H, W), np.float32); envF = np.zeros((H, W), np.float32)
    for k in range(strands):
        sk = seed * 31 + k
        ws = min(width, 0.045)                                              # wide far formations don't spread sideways
        off = ws * (k - (strands - 1) / 2) * 1.5 + ws * 1.6 * n1(V * 0.55 + rr.random(), sk + 20, 130)   # strands drift apart and cross
        wk = min(width, 0.06) * (0.55 + 1.2 * np.clip(0.5 + 0.45 * n1(V * 0.8 + rr.random(), sk + 40, 110), 0, 1))       # width swells and pinches
        bk = np.clip(0.35 + 0.85 * n1(V * 1.1 + rr.random() + 0.03 * np.cos(T + sk), sk + 60, 90), 0, 1.25)   # fades out, re-emerges
        sd = (U - path - off) / wk
        sa = np.where(sd > 0, sd * (0.75 + 0.5 * rr.random()), sd * (1.25 - 0.5 * rr.random()))               # one edge sharper than the other
        sa = sa / BLEND
        core = np.exp(-sa * sa)
        # inner structure follows the strand's own curve, not a straight line
        fl = 0.55 + 0.45 * n1((sd / BLEND) * 0.05 * TEX + V * 0.12 + rr.random(), sk + 80, 3)
        # each strand ends at its own ragged height that varies across the screen: no straight horizontal edges
        e1 = v1 + 0.07 * n1(U * 0.6 + rr.random(), sk + 120, 90) - 0.03 * k / strands
        e0 = v0 + 0.06 * n1(U * 0.5 + rr.random(), sk + 140, 90)
        tk = np.clip((V - e0) / np.maximum(e1 - e0, 0.05), 0, 1)
        envk = (tk * tk * (3 - 2 * tk)) ** 1.5 * np.clip((1 - tk) / 0.35, 0, 1) ** 1.3
        envF = np.maximum(envF, envk)
        tot += core * bk * envk * (1 - 0.55 * fil + 0.55 * fil * fl)
        vol += np.exp(-np.abs(U - path - off) / (min(wk.max(), 0.06) * 2.2 * min(glow, 1.4))) * bk * envk   # soft volume sized in screen units
    tot /= strands ** 0.5
    vol /= strands
    # soft volumetric scattering: the light seems to sit inside a glowing haze rather than on a flat background
    # broad illumination: a continuous field of light that follows the formation's own curving path (not a screen-wide glow),
    # with irregular contours and internal brightness from low-frequency 2D noise; the strands become structure inside it
    bw = min((min(width, 0.06) * 1.6 + 0.035) * BW, 0.12)                # capped: never a wide slab
    dp = np.abs(U - path) / bw
    mod = np.clip(0.65 + 0.45 * noise2(0.07, seed + 700, 2.5) + 0.2 * noise2(0.025, seed + 710, 4.0), 0.05, 1.4)
    # the broad light ends irregularly: its lower and upper limits wander across the formation
    eb1 = v1 + 0.1 * n1(U * 1.4 + seed * 0.3, seed + 730, 60); eb0 = v0 + 0.08 * n1(U * 1.1 + seed * 0.7, seed + 740, 60)
    tb = np.clip((V - eb0) / np.maximum(eb1 - eb0, 0.05), 0, 1)
    envB = (tb * tb * (3 - 2 * tb)) ** 1.5 * np.clip((1 - tb) / 0.4, 0, 1) ** 1.5
    broad = np.exp(-dp ** 1.4) * mod * np.minimum(envF * 1.5, 1) * envB
    body = tot + 0.5 * vol + BROAD * broad
    env = np.clip(0.7 + 0.45 * n1(V * 0.9 + seed * 0.11 + 0.03 * np.cos(T + seed), seed + 5, 200), 0.25, 1.3)
    return body * env

# depth layers, far to near. (x0, slope, top, bottom, width, curve, seed, intensity, core colour, glow colour, glow, filaments)
FAR = [
    (0.18, 0.30, 0.06, 0.74, 0.130, 0.020, 1, 0.42, (30, 150, 220), (10, 55, 140), 2.2, 0.3),
    (0.74, 0.14, 0.03, 0.60, 0.140, 0.025, 2, 0.28, (10, 160, 175), (6, 60, 115),  2.2, 0.3),
    (0.98, 0.10, 0.28, 0.92, 0.100, 0.015, 3, 0.30, (25, 110, 210), (12, 38, 115), 2.0, 0.3),
    (0.48, 0.24, 0.10, 0.68, 0.150, 0.030, 13, 0.30, (20, 130, 215), (8, 40, 125), 2.4, 0.3),
]
MID = [
    (0.27, 0.38, 0.16, 0.80, 0.034, 0.018, 4, 0.34, (10, 210, 235), (0, 105, 200), 1.5, 0.4),
    (0.70, 0.20, 0.12, 0.62, 0.052, 0.022, 5, 0.6, (0, 220, 195),  (0, 120, 140),  1.5, 0.4),
    (0.08, 0.40, 0.40, 0.95, 0.030, 0.010, 6, 0.34, (40, 140, 245), (15, 65, 180),  1.0, 0.4),
    (0.76, 0.26, 0.22, 1.04, 0.045, 0.03, 18, 0.32, (0, 195, 205), (0, 95, 160),   1.6, 0.4),
]
NEAR = [
    (0.55, 0.28, 0.30, 0.74, 0.016, 0.016, 7, 0.75, (70, 245, 240), (0, 160, 215),  0.9, 0.45),
    (0.24, 0.42, 0.50, 0.90, 0.014, 0.008, 10, 0.45, (60, 210, 250), (20, 100, 220), 0.8, 0.45),
    (0.86, 0.12, 0.20, 0.48, 0.018, 0.010, 9, 0.55, (30, 235, 210), (0, 140, 160),  0.9, 0.45),
]
img = np.zeros((H, W, 3), np.float32)
img += col((1, 3, 10)) * (1 - v[..., None]) + col((7, 11, 36)) * v[..., None]   # near-black top, midnight blue below
for layer, soft in ((FAR, 1.0), (MID, 1.0), (NEAR, 1.0)):
    for (x0, sl, a, b, w, cv, sd, inten, cc, gc, gl, fil) in layer:
        r = ribbon(x0, sl, a, b, w, cv, sd, gl, fil)
        # colour: the core colour where the ribbon is intense, the glow colour in its soft spread
        k = np.clip(r * 2.5, 0, 1)[..., None]
        img += r[..., None] * (col(gc) * (1 - k) + col(cc) * k) * inten * 4.1 * EXPO
# main mass: one large curving body of light that the formations gather into. Inside it their light is lifted and joined by a
# soft glow that follows the same curve; outside it they recede. It leans and widens towards the bottom right, reaching the
# lower-right formation, and its outline is irregular (2D noise), so it never reads as an oval.
skyimg = col((1, 3, 10)) * (1 - v[..., None]) + col((7, 11, 36)) * v[..., None]
if UNIFY > 0:
    pM = 0.44 + 0.22 * (V0 - 0.5) + 0.05 * np.sin(V0 * 3.4 + 1.2 + 0.4 * np.sin(T)) + 0.02 * np.sin(T)
    wM = 0.17 + 0.12 * np.clip(V0 - 0.35, 0, 1)
    M = np.exp(-(np.abs(U0 - pM) / wM) ** 1.6) * np.clip(1 + 0.35 * noise2(0.08, 801, 2.0), 0.3, 1.5)
    M *= np.clip((V0 - 0.1) / 0.25, 0, 1) ** 1.5 * np.clip((1.02 - V0) / 0.2, 0, 1)
    M = np.clip(M, 0, 1.2)
    light = img - skyimg
    lum = np.clip(light.mean(-1), 0, None)
    glowM = nd.gaussian_filter(light, (W * 0.03, W * 0.03, 0))      # the formations' own light, softly spread inside the mass
    img = skyimg + light * (1 - UNIFY * 0.6 + UNIFY * 0.9 * M[..., None]) + glowM * (UNIFY * 0.45 * M[..., None])
# fine atmospheric texture: faint streaks of light through the whole sky, very low contrast
rs = np.random.default_rng(31).random((H // 4 + 1, W)).astype(np.float32)
fine = nd.gaussian_filter(rs, (H * 0.02, 0.8), mode='wrap'); fine = (fine - fine.mean()) / (fine.std() + 1e-6)
fine = np.repeat(fine, 4, axis=0)[:H]
lumf = img.mean(-1, keepdims=True)
img *= 1 + 0.06 * fine[..., None] * np.clip(lumf * 6, 0, 1)
# composition: dark band at the top for the score, a calmer band behind the balls
img *= (0.35 + 0.65 * np.clip((v - 0.04) / 0.18, 0, 1))[..., None]
img *= (1 - 0.18 * np.exp(-((v - 0.78) / 0.045) ** 2))[..., None]
# restrained light scattering: only the brightest light, small radius
br = np.clip(img - 0.35, 0, None)
img += nd.gaussian_filter(br, (W * 0.008, W * 0.008, 0)) * 0.5
# stars only in dark sky, soft shoulder (no clipping), fine grain
st = (np.random.default_rng(99).random((H, W)) > 0.99985).astype(np.float32)
img += (nd.gaussian_filter(st, 0.6) * 4 * np.clip(1 - img.mean(-1) / 0.06, 0, 1))[..., None] * 0.45
img = img / (1 + 0.3 * img)
img = np.clip(img, 0, 1) ** (1 / 1.03)
img += np.random.default_rng(int(ph * 997) + 3).standard_normal((H, W, 1)).astype(np.float32) * 0.004
Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out)
