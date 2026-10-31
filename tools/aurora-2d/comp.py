# 2D "motion design" aurora: painted light shapes -> streak smear -> flowing distortion -> colour by intensity -> glow.
import numpy as np, sys
from scipy import ndimage as nd
from PIL import Image
W, H = int(sys.argv[1]), int(sys.argv[2]); out = sys.argv[3]; ph = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
rng = np.random.default_rng(7)
y, x = np.mgrid[0:H, 0:W].astype(np.float32); u = x / W; v = y / H          # v: 0 top, 1 bottom
T = ph * 2 * np.pi
def smooth_noise(scale_px, seed, aniso=(1, 1)):
    r = np.random.default_rng(seed).standard_normal((H, W)).astype(np.float32)
    r = nd.gaussian_filter(r, (scale_px * aniso[1], scale_px * aniso[0]), mode='wrap')
    return (r - r.mean()) / (r.std() + 1e-6)
# flowing distortion field (large, gentle)
dx = smooth_noise(W * 0.2, 1) * W * 0.02 + smooth_noise(W * 0.08, 2) * W * 0.005
def warp(img):
    return nd.map_coordinates(img, [y, np.clip(x + dx, 0, W - 1)], order=1, mode='nearest')
def lean(cx, slope):                # centre-line x (px) as a function of row: leans as it rises
    return (cx + slope * (0.62 - v)) * W
# --- painted light shapes (intensity masks) ---
def pillar(cx, slope, width, v0, v1, soft_top, soft_bot, curve=0.0, freq=4.0, phase=0.0, bulge=0.0, vb=0.6, sb=0.18, flare=0.0):
    # a curtain whose centre line curves (S-shape) and whose width swells in the middle and flares at the bottom
    c = lean(cx, slope) + curve * W * np.sin(freq * v + phase)
    wv = width * (1 + bulge * np.exp(-((v - vb) / sb) ** 2) + flare * np.clip(v - 0.7, 0, 1) * 3)
    across = np.exp(-((x - c) / (wv * W)) ** 2)
    along = 1 / (1 + np.exp(-(v - v0) / soft_top)) * 1 / (1 + np.exp((v - v1) / soft_bot))
    return across * along
main = pillar(0.42 + 0.015 * np.sin(T), 0.11, 0.095, 0.06, 0.9, 0.1, 0.05, curve=0.045, freq=5.0, phase=0.6 + 0.3 * np.sin(T), bulge=0.9, vb=0.58, sb=0.17, flare=0.5)
back = pillar(0.62 + 0.02 * np.cos(T), 0.12, 0.045, 0.28, 0.9, 0.08, 0.06, curve=0.025, freq=4.0, phase=2.2, bulge=0.6, vb=0.6, sb=0.15) * 0.7   # a thin violet curtain further back, right of the core   # a second, wider curtain further back
core = pillar(0.41 + 0.015 * np.sin(T), 0.11, 0.08, 0.40, 0.72, 0.07, 0.05, curve=0.045, freq=5.0, phase=0.6 + 0.3 * np.sin(T), bulge=0.8, vb=0.6, sb=0.1)
teal = pillar(0.73, 0.12, 0.08, 0.04, 0.42, 0.05, 0.025, curve=0.02, freq=6.0, bulge=0.3, vb=0.25, sb=0.1) * 1.3   # hangs from the top with a soft lower hem
left = pillar(0.12, 0.12, 0.04, 0.25, 0.95, 0.08, 0.04) * 0.7
haze = np.exp(-((v - 0.98) / 0.16) ** 2) * (0.45 + 0.4 * np.exp(-((u - 0.45) / 0.45) ** 2))
# --- streak texture: fine vertical threads of varying brightness, slanted with the lean ---
def streaks(seed, fine):
    n = np.random.default_rng(seed).random((H, W)).astype(np.float32)
    n = nd.gaussian_filter(n, (H * 0.09, fine), mode='wrap')            # long along, thin across
    n = (n - n.min()) / (n.max() - n.min())
    return n
shear = (0.11 * (0.62 - v)) * W
def shear_img(img, k=1.0):
    return nd.map_coordinates(img, [y, (x - shear * k) % W], order=1, mode='wrap')
st = shear_img(streaks(11, W * 0.005)) * 0.55 + shear_img(streaks(12, W * 0.0116)) * 0.45
st = np.clip((st - 0.25) * 1.7, 0, 1) ** 1.1
clumps = 0.95 + 0.45 * np.tanh(smooth_noise(W * 0.045, 21, (1, 3.5)))
# --- combine: light = shapes x streaks, then warp so it bends ---
L_main = warp(main * (0.25 + 0.95 * st) * clumps)
L_back = warp(back * (0.35 + 0.8 * shear_img(streaks(41, W * 0.009), 1.4)))
L_core = warp(core * (0.35 + 0.9 * st) * clumps)
L_teal = warp(teal * (0.2 + 1.0 * shear_img(streaks(31, W * 0.0036), 0.4)))
L_left = warp(left * (0.3 + 0.9 * st))
# --- colour ---
def col(c): return np.array(c, np.float32).reshape(1, 1, 3) / 255
img = np.zeros((H, W, 3), np.float32)
sky = col((2, 4, 14)) * (1 - v[..., None]) + col((10, 8, 40)) * v[..., None]
img += sky
mcol = col((25, 95, 255)) * np.clip((0.5 - v) / 0.35, 0, 1)[..., None] + col((0, 200, 240)) * (1 - np.clip((0.5 - v) / 0.35, 0, 1))[..., None]   # blue high up, cyan lower
lowk = np.clip((v - 0.74) / 0.16, 0, 1)[..., None]                      # below the core the light turns blue-violet
mcol = mcol * (1 - lowk) + col((60, 70, 255)) * lowk
img += L_main[..., None] * mcol * 1.25
img += L_back[..., None] * col((95, 60, 255)) * 1.0
img += (L_core ** 1.2)[..., None] * col((10, 235, 255)) * 1.35
img += L_teal[..., None] * col((0, 175, 160)) * 1.1
img += L_left[..., None] * col((50, 90, 255)) * 1.3
img += haze[..., None] * col((75, 45, 215)) * 0.8
# streak smear upward (long exposure) + glow
sm = nd.uniform_filter1d(img, size=int(H * 0.03), axis=0)
img = img * 0.4 + sm * 0.6
img = img * 0.6 + nd.gaussian_filter(img, (W * 0.0036, W * 0.0036, 0)) * 0.4
glow = nd.gaussian_filter(img, (W * 0.05, W * 0.05, 0))
img = 1 - (1 - img) * (1 - glow * 0.75)
# vignette, deepest top-left
d = np.sqrt(((u - 0.45) / 0.8) ** 2 + ((v - 0.58) / 0.75) ** 2)
img *= (1 - 0.92 * np.clip(d, 0, 1) ** 2.2)[..., None]
img = np.clip(img, 0, 1) ** (1 / 1.05)
# fine grain
img += (rng.standard_normal((H, W, 1)) * 0.006).astype(np.float32)
Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(out)
