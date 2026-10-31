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
# --- curtains: rays hang from a bright lower edge (hem) and fade upward; all rays lean top-left -> bottom-right ---
LEAN = 0.38                                   # how far (in screen widths) a ray drifts right per screen height downward
def sheared(img_u):                           # horizontal position measured along the lean
    return img_u - LEAN * (v - 0.6)
us = sheared(u)
def ragged(coord, seed):            # 1D noise along the curtain: each ray's lower end sits at its own height
    r = np.random.default_rng(seed).standard_normal(4096).astype(np.float32)
    r = nd.gaussian_filter1d(r, 6, mode='wrap'); r /= r.std() + 1e-6
    return np.interp((coord % 1.0) * 4095, np.arange(4096), r).astype(np.float32)
def curtain(u0, u1, hem, hem_curve, height, soft_below, edge_soft, seed_off=0.0):
    hv = hem + hem_curve * np.sin((us - u0) / max(u1 - u0, 1e-3) * np.pi) + 0.04 * ragged(us, 50 + int(seed_off * 10))   # ragged hem, each ray ends at its own height
    span = 1 / (1 + np.exp(-(us - u0) / edge_soft)) * 1 / (1 + np.exp((us - u1) / edge_soft))
    d = hv - v                                                   # > 0 above the hem
    above = np.exp(-np.clip(d, 0, None) / height) * (1 / (1 + np.exp(-d / 0.03)))
    below = np.exp(-(np.clip(-d, 0, None) / soft_below) ** 2) * (d < 0)
    return span * (above + below * 0.5), d
main, dmain = curtain(0.28, 0.76, 0.58, 0.09, 0.25, 0.05, 0.07)
core = np.exp(-((us - 0.56) / 0.14) ** 2) * np.exp(-np.clip(dmain, 0, None) / 0.16) * (1 / (1 + np.exp(-dmain / 0.03))) * (main > 0.01)   # brightest just above the hem
fold = np.exp(-((us - 0.68 - 0.035 * np.sin(v * 7.0 + 0.8)) / 0.03) ** 2) * np.exp(-((v - 0.45) / 0.14) ** 2)                 # the curtain turning away: a violet edge
teal, _ = curtain(0.72, 1.0, 0.38, 0.0, 0.22, 0.03, 0.035, 1)
left = (np.exp(-((us - 0.15) / 0.022) ** 2) + 0.25 * np.exp(-((us - 0.21) / 0.015) ** 2)) * np.clip((0.86 - v) / 0.12, 0, 1) * np.clip((v - 0.05) / 0.2, 0, 1)
lowteal, _ = curtain(-0.05, 0.22, 0.86, 0.0, 0.10, 0.04, 0.04, 2)
haze = np.exp(-((v - 0.95) / 0.1) ** 2) * (0.4 + 0.6 * np.exp(-((u - 0.62) / 0.35) ** 2))
pocket = 1 - 0.55 * np.exp(-((u - 0.55) / 0.2) ** 2) * np.exp(-((v - 0.76) / 0.06) ** 2)
# --- streak texture along the lean ---
def streaks(seed, fine):
    n = np.random.default_rng(seed).random((H, W)).astype(np.float32)
    n = nd.gaussian_filter(n, (H * 0.09, fine), mode='wrap')
    return (n - n.min()) / (n.max() - n.min())
shear = (LEAN * (v - 0.6)) * W
def shear_img(img, k=1.0):
    return nd.map_coordinates(img, [y, (x - shear * k) % W], order=1, mode='wrap')
st = shear_img(streaks(11, W * 0.03)) * 0.7 + shear_img(streaks(12, W * 0.008)) * 0.3   # broad soft rays, faint fine texture
st = np.clip((st - 0.2) * 1.6, 0, 1)
clumps = 0.95 + 0.4 * np.tanh(shear_img(smooth_noise(W * 0.05, 21, (1, 3.5))))
L_main = warp(main * (0.25 + 0.95 * st) * clumps)
L_core = warp(core * (0.4 + 0.8 * st) * clumps)
L_fold = warp(fold * (0.5 + 0.6 * st))
L_teal = warp(teal * (0.25 + 0.95 * shear_img(streaks(31, W * 0.008))))
L_left = left * (0.5 + 0.6 * st)
L_low = warp(lowteal * (0.3 + 0.9 * st))
# --- colour ---
def col(c): return np.array(c, np.float32).reshape(1, 1, 3) / 255
img = np.zeros((H, W, 3), np.float32)
sky = col((2, 4, 14)) * (1 - v[..., None]) + col((10, 8, 40)) * v[..., None]
img += sky
hk = np.clip(dmain / 0.35, 0, 1)[..., None]                               # height above the hem: cyan near the edge, blue higher up
mcol = col((0, 210, 245)) * (1 - hk) + col((25, 90, 255)) * hk
img += L_main[..., None] * mcol * 1.35
blob = np.exp(-((u - 0.64) / 0.09) ** 2) * np.exp(-((v - 0.64) / 0.045) ** 2)   # the hottest glow, just above the hem
img += (L_core ** 1.1)[..., None] * col((20, 255, 240)) * 2.2
img += warp(blob * (0.7 + 0.4 * st))[..., None] * col((60, 255, 245)) * 0.55
img += L_fold[..., None] * col((110, 70, 255)) * 0.9
tlobe = np.exp(-((u - 0.84) / 0.11) ** 2) * np.exp(-((v - 0.34) / 0.07) ** 2)   # a soft glowing lobe of teal, apart from the main curtain
img += (L_teal * 0.6 + warp(tlobe * (0.6 + 0.5 * st)))[..., None] * col((0, 185, 165)) * 1.2
img += L_left[..., None] * col((40, 110, 255)) * 1.0
img += L_low[..., None] * col((0, 160, 170)) * 0.7
bl = np.exp(-((u - 0.1) / 0.12) ** 2) * np.exp(-((v - 0.83) / 0.06) ** 2)
bump = np.exp(-((u - 0.82) / 0.07) ** 2) * np.exp(-((v - 0.76) / 0.06) ** 2)
img += warp(bl * (0.4 + 0.8 * st))[..., None] * col((0, 170, 180)) * 0.6
img += warp(bump * (0.5 + 0.6 * st))[..., None] * col((40, 110, 255)) * 0.7
img += haze[..., None] * col((70, 45, 210)) * 0.5
# streak smear upward (long exposure) + glow
sm = nd.uniform_filter1d(img, size=int(H * 0.03), axis=0)
img = img * 0.4 + sm * 0.6
img = img * 0.6 + nd.gaussian_filter(img, (W * 0.0036, W * 0.0036, 0)) * 0.4
glow = nd.gaussian_filter(img, (W * 0.05, W * 0.05, 0))
img = 1 - (1 - img) * (1 - glow * 0.75)
img = img * 0.45 + nd.gaussian_filter(img, (W * 0.012, W * 0.008, 0)) * 0.55
img *= pocket[..., None]
# vignette, deepest top-left
d = np.sqrt(((u - 0.45) / 0.8) ** 2 + ((v - 0.58) / 0.75) ** 2)
img *= (1 - 0.92 * np.clip(d, 0, 1) ** 2.2)[..., None]
img = np.clip(img, 0, 1) ** (1 / 1.05)
# fine grain
img += (rng.standard_normal((H, W, 1)) * 0.006).astype(np.float32)
Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(out)
