# Mirror Drop aurora, layered compositor.
# The sky is built from several curtains of light at different apparent distances instead of a few hand-placed glows:
# far layers are wide, dim, blue and soft; near layers are narrower, brighter and more defined. Each curtain is a set of
# leaning rays hanging from a ragged lower edge, with brightness that varies along it, so no single area dominates.
# Usage: python3 comp2.py W H out.png phase   (phase 0..1 loops seamlessly)
import numpy as np, sys
from scipy import ndimage as nd
from PIL import Image
W, H = int(sys.argv[1]), int(sys.argv[2]); out = sys.argv[3]; ph = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
T = ph * 2 * np.pi
y, x = np.mgrid[0:H, 0:W].astype(np.float32); u = x / W; v = y / H              # v: 0 top, 1 bottom
def col(c): return np.array(c, np.float32).reshape(1, 1, 3) / 255

def noise2(scale_px, seed, aniso=(1, 1)):           # smooth 2D noise, unit variance (wraps, so it can drift seamlessly)
    r = np.random.default_rng(seed).standard_normal((H, W)).astype(np.float32)
    r = nd.gaussian_filter(r, (scale_px * aniso[1], scale_px * aniso[0]), mode='wrap')
    return (r - r.mean()) / (r.std() + 1e-6)
def noise1(coord, seed, smooth=6):                  # smooth 1D noise along a curtain
    r = np.random.default_rng(seed).standard_normal(4096).astype(np.float32)
    r = nd.gaussian_filter1d(r, smooth, mode='wrap'); r /= r.std() + 1e-6
    return np.interp((coord % 1.0) * 4095, np.arange(4096), r).astype(np.float32)

LEAN = 0.34                                           # rays lean: top-left to bottom-right
us = u - LEAN * (v - 0.6)                            # position measured along the lean
shear_px = LEAN * (v - 0.6) * W
def along_lean(img): return nd.map_coordinates(img, [y, (x - shear_px) % W], order=1, mode='wrap')
def ray_texture(seed, width_frac, length_frac=0.1):  # long soft rays, leaning
    n = np.random.default_rng(seed).random((H, W)).astype(np.float32)
    n = nd.gaussian_filter(n, (H * length_frac, W * width_frac), mode='wrap')
    n = (n - n.min()) / (n.max() - n.min() + 1e-6)
    return np.clip((along_lean(n) - 0.18) * 1.55, 0, 1)
# a gentle flowing distortion so curtains bend instead of running ruler-straight
flow = noise2(W * 0.22, 1) * W * 0.018 + noise2(W * 0.09, 2) * W * 0.005
def bend(img, k=1.0): return nd.map_coordinates(img, [y, np.clip(x + flow * k, 0, W - 1)], order=1, mode='nearest')

def curtain(u0, u1, hem, tilt, height, edge, seed, drift):
    """Intensity of one curtain and the height of each pixel above its lower edge."""
    hv = hem + tilt * (us - (u0 + u1) / 2) + 0.06 * noise1(us + 0.02 * np.sin(T + drift), seed, 4) + 0.01 * np.sin(T + drift)
    span = 1 / (1 + np.exp(-(us - u0) / edge)) / (1 + np.exp((us - u1) / edge))
    d = hv - v                                                            # > 0 above the edge
    above = np.exp(-np.clip(d, 0, None) / height) / (1 + np.exp(-d / 0.025))
    below = 0.35 * np.exp(-(np.clip(-d, 0, None) / 0.05) ** 2) * (d < 0)  # a little light spills below the edge
    # brightness varies along the curtain: bright sections and quiet sections, so no one place dominates
    var = 0.5 + 0.6 * np.tanh(1.6 * noise1(us * 0.8 + 0.015 * np.cos(T + drift), seed + 7, 14))
    return span * (above + below) * np.clip(var, 0.04, 1.2), d          # quiet sections go nearly dark: real gaps between formations

# layers, far to near: (u0, u1, edge height, tilt, rise, edge softness, intensity, blur, ray width, low colour, high colour)
LAYERS = [
    (0.02, 0.58, 0.40,  0.06, 0.30, 0.08, 0.30, 0.020, 0.055, (30, 85, 215),  (12, 35, 120)),   # far, left
    (0.50, 1.05, 0.33, -0.04, 0.26, 0.08, 0.32, 0.020, 0.055, (0, 160, 150),  (5, 70, 100)),   # far, right
    (0.14, 0.60, 0.57,  0.10, 0.27, 0.05, 0.55, 0.009, 0.032, (0, 190, 230),  (20, 95, 235)),   # middle, left
    (0.58, 0.96, 0.47, -0.05, 0.24, 0.05, 0.6, 0.009, 0.032, (0, 200, 165),  (0, 120, 150)),   # middle, right (teal)
    (0.30, 0.74, 0.65,  0.12, 0.22, 0.04, 0.72, 0.004, 0.022, (25, 235, 240), (0, 175, 240)),   # near, centre
]
img = np.zeros((H, W, 3), np.float32)
sky = col((2, 4, 13)) * (1 - v[..., None]) ** 1.3 + col((9, 12, 42)) * (1 - (1 - v[..., None]) ** 1.3)
img += sky
for i, (u0, u1, hem, tilt, rise, edge, inten, blur, rw, lo, hi) in enumerate(LAYERS):
    m, d = curtain(u0, u1, hem, tilt, rise, edge, 100 + i * 13, i * 1.7)
    tex = 0.3 + 0.75 * ray_texture(200 + i, rw)
    L = bend(m * tex, 1.0 - 0.15 * i)
    L = nd.gaussian_filter(L, W * blur)                                   # far layers softer
    L = L * 0.75 + nd.gaussian_filter(bend(m), W * (0.035 + blur)) * 0.55     # a soft luminous body behind the rays: light in the air, not just lines
    k = np.clip(d / (rise * 1.3), 0, 1)[..., None] ** 1.6                   # colour by height above the edge
    c = col(lo) * (1 - k) + col(hi) * k
    img += L[..., None] * c * inten * 2.6

# faint luminous wisps: thin, long, dim rays scattered through the sky
wisp = ray_texture(400, 0.004, 0.16) ** 3 * (0.35 + 0.65 * np.clip(noise2(W * 0.15, 401), 0, None))
wisp *= np.exp(-((v - 0.48) / 0.32) ** 2)
img += nd.gaussian_filter(bend(wisp), 1.0)[..., None] * col((40, 140, 230)) * 0.16

# atmospheric haze: a restrained navy-violet glow near the horizon
haze = np.exp(-((v - 1.0) / 0.2) ** 2) * (0.55 + 0.45 * np.exp(-((u - 0.55) / 0.5) ** 2))
img += haze[..., None] * col((45, 35, 150)) * 0.35

# soft long-exposure smear along the rays, then controlled bloom (only the bright parts glow)
img = img * 0.55 + nd.uniform_filter1d(img, size=max(3, int(H * 0.02)), axis=0) * 0.45
bright = np.clip(img - 0.3, 0, None)
img = img + nd.gaussian_filter(bright, (W * 0.012, W * 0.012, 0)) * 0.35 + nd.gaussian_filter(bright, (W * 0.06, W * 0.06, 0)) * 0.25

# keep the score area and the ball line calm: gently darker at the very top and in a band behind the balls
img *= (0.55 + 0.45 * np.clip(v / 0.16, 0, 1))[..., None]
img *= (1 - 0.22 * np.exp(-((v - 0.78) / 0.05) ** 2))[..., None]

# particles: sparse, faint motes and stars, only where the sky is dark
lum = img.mean(-1)
rs = np.random.default_rng(99).random((H, W))
stars = nd.gaussian_filter((rs > 0.99985).astype(np.float32), 0.6) * 4
motes = nd.gaussian_filter((rs < 0.00003).astype(np.float32), W * 0.002) * (W * 0.002) ** 2 * 18
img += (stars * np.clip(1 - lum / 0.08, 0, 1))[..., None] * 0.5
img += (motes * np.clip(1 - lum / 0.3, 0, 1))[..., None] * col((120, 200, 255)) * 0.5

# grade: soft shoulder so highlights never clip, slight vignette, fine grain against banding
img = img / (1 + 0.35 * img)
d = np.sqrt(((u - 0.5) / 0.85) ** 2 + ((v - 0.55) / 0.8) ** 2)
img *= (1 - 0.6 * np.clip(d, 0, 1) ** 2.4)[..., None]
img = np.clip(img, 0, 1) ** (1 / 1.04)
img += np.random.default_rng(int(ph * 1000) + 5).standard_normal((H, W, 1)).astype(np.float32) * 0.005
Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out)
