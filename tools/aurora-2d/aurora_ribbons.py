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
v = (np.arange(H, dtype=np.float32) / H)[:, None]            # 0 top .. 1 bottom
u = (np.arange(W, dtype=np.float32) / W)[None, :]
asp = W / H
def col(c): return np.array(c, np.float32) / 255
def n1(t, seed, smooth=8):                                   # smooth 1D noise, unit variance, wraps
    r = np.random.default_rng(seed).standard_normal(2048).astype(np.float32)
    r = nd.gaussian_filter1d(r, smooth, mode='wrap'); r /= r.std() + 1e-6
    return np.interp(np.mod(t, 1.0) * 2047, np.arange(2048), r).astype(np.float32)

def ribbon(x0, slope, v0, v1, width, curve, seed, glow=1.0, fil=0.5):
    """Intensity field of one ribbon. x0: centre at the ribbon's middle (screen widths); slope: drift right per screen height
    downward; v0..v1: top and bottom; width: core half-width (screen widths); curve: how much the line bends."""
    vm = (v0 + v1) / 2
    xc = x0 + slope * (v - vm) + curve * np.sin(v * 5.0 + seed + 0.6 * np.sin(T + seed)) + 0.014 * n1(v * 0.8 + 0.04 * np.sin(T + seed), seed, 140)
    xc = xc + 0.025 * np.sin(T + seed * 1.3)                                    # the whole ribbon sways slowly
    wv = width * (0.65 + 0.7 * np.clip(0.5 + 0.35 * n1(v * 0.7, seed + 3, 160), 0, 1))          # width changes along its length
    s = (u - xc) / wv                                                          # distance from the centre line, in widths
    core = np.exp(-s * s)                                                      # narrow bright core
    spread = np.exp(-np.abs(s) / (5.5 * glow)) * 0.5                          # soft light spreading around it (exponential: no halo ring)
    # fine filaments inside the ribbon: stripes running along its length, offset per ribbon
    fl = 0.5 + 0.5 * n1(s * 0.045 + seed * 0.37, seed + 11, 3)
    body = (core * (1 - 0.6 * fil + 0.6 * fil * fl) + spread * (0.8 + 0.2 * fl))
    # along the length: tapers in at the bottom, fades out at the top, with bright and quiet stretches
    t = (v - v0) / (v1 - v0)
    tc = np.clip(t, 0, 1)
    env = (tc * tc * (3 - 2 * tc)) ** 1.6 * np.clip((1 - t) / 0.22, 0, 1) ** 1.4 * (t > 0) * (t < 1)   # long fade upward, soft taper at the bottom
    env = env * np.clip(0.7 + 0.45 * n1(v * 0.9 + seed * 0.11 + 0.03 * np.cos(T + seed), seed + 5, 200), 0.3, 1.3)
    return body * env

# depth layers, far to near. (x0, slope, top, bottom, width, curve, seed, intensity, core colour, glow colour, glow, filaments)
FAR = [
    (0.18, 0.30, 0.06, 0.74, 0.130, 0.020, 1, 0.42, (30, 150, 220), (10, 55, 140), 2.2, 0.3),
    (0.74, 0.14, 0.03, 0.62, 0.140, 0.025, 2, 0.40, (10, 160, 175), (6, 60, 115),  2.2, 0.3),
    (0.98, 0.10, 0.28, 0.92, 0.100, 0.015, 3, 0.30, (25, 110, 210), (12, 38, 115), 2.0, 0.3),
    (0.48, 0.24, 0.10, 0.68, 0.150, 0.030, 13, 0.30, (20, 130, 215), (8, 40, 125), 2.4, 0.3),
]
MID = [
    (0.27, 0.38, 0.16, 0.80, 0.034, 0.018, 4, 0.34, (10, 210, 235), (0, 105, 200), 1.5, 0.4),
    (0.70, 0.20, 0.12, 0.62, 0.052, 0.022, 5, 0.6, (0, 220, 195),  (0, 120, 140),  1.5, 0.4),
    (0.08, 0.40, 0.40, 0.95, 0.030, 0.010, 6, 0.34, (40, 140, 245), (15, 65, 180),  1.0, 0.4),
    (0.80, 0.16, 0.46, 0.90, 0.040, 0.014, 12, 0.36, (0, 190, 200), (0, 90, 150),   1.5, 0.4),
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
        img += r[..., None] * (col(gc) * (1 - k) + col(cc) * k) * inten * 2.3
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
