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
def curtain(u0, u1, hem, hem_curve, height, soft_below, edge_soft, seed_off=0.0, taper=0.0):
    hv = hem + hem_curve * np.sin((us - u0) / max(u1 - u0, 1e-3) * np.pi) + 0.04 * ragged(us, 50 + int(seed_off * 10))   # ragged hem, each ray ends at its own height
    tp = taper * np.clip(v - 0.25, 0, None)
    span = 1 / (1 + np.exp(-(us - u0 - tp) / edge_soft)) * 1 / (1 + np.exp((us - u1 + tp * 0.4) / edge_soft))
    d = hv - v                                                   # > 0 above the hem
    above = np.exp(-np.clip(d, 0, None) / height) * (1 / (1 + np.exp(-d / 0.03)))
    below = np.exp(-(np.clip(-d, 0, None) / soft_below) ** 2) * (d < 0)
    return span * (above + below * 0.5), d
main, dmain = curtain(0.24, 0.78, 0.58, 0.09, 0.25, 0.05, 0.07, taper=0.45)
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
back2, _ = curtain(0.30, 0.62, 0.40, -0.04, 0.28, 0.03, 0.05, 5)
L_back2 = nd.gaussian_filter(warp(back2 * (0.3 + 0.8 * shear_img(streaks(61, W * 0.02), 0.7))), W * 0.01)
front = np.exp(-((us - 0.30) / 0.07) ** 2) * np.exp(-((v - 0.55) / 0.3) ** 2)
L_front = nd.gaussian_filter(front * (0.5 + 0.5 * st), W * 0.03)
along = 0.8 + 0.35 * np.tanh(shear_img(smooth_noise(W * 0.04, 71, (0.6, 4.0))))
L_main = warp(main * (0.25 + 0.95 * st) * clumps * along)
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
hk = hk ** 2.2
mcol = col((0, 220, 245)) * (1 - hk) + col((10, 130, 255)) * hk
ulfade = (1 - 0.75 * np.clip((0.45 - u) / 0.3, 0, 1) * np.clip((0.45 - v) / 0.35, 0, 1)) * (1 - 0.5 * np.clip((0.4 - v) / 0.35, 0, 1))   # upper-left and top stay dark
img += (L_back2 * ulfade)[..., None] * col((35, 80, 235)) * 0.55          # far curtain: dimmer, bluer, softer
gaps = 1 - 0.85 * np.exp(-((us - 0.40 - 0.02 * np.sin(v * 6)) / 0.025) ** 2) * np.clip((0.66 - v) / 0.2, 0, 1) - 0.7 * np.exp(-((us - 0.30) / 0.025) ** 2) - 0.45 * np.exp(-((us - 0.50) / 0.015) ** 2) * np.clip((0.6 - v) / 0.3, 0, 1)
gaps = np.clip(nd.gaussian_filter(gaps, W * 0.006), 0, 1)
img += (L_main * ulfade * gaps)[..., None] * mcol * 1.25
img += L_front[..., None] * col((20, 160, 230)) * 0.35                      # near light, out of focus
blob = np.exp(-((u - 0.64) / 0.09) ** 2) * np.exp(-((v - 0.64) / 0.045) ** 2)   # the hottest glow, just above the hem
img += nd.gaussian_filter(L_core, W * 0.008)[..., None] * col((20, 255, 240)) * 1.1
img += warp(blob * (0.7 + 0.4 * st))[..., None] * col((60, 255, 245)) * 0.55
img += L_fold[..., None] * col((110, 70, 255)) * 0.9
tlobe = np.exp(-((us - 0.86) / 0.07) ** 2) * np.exp(-((v - 0.33) / 0.06) ** 2)   # smaller, leaning with the rays   # a soft glowing lobe of teal, apart from the main curtain
img += (L_teal * 0.75 + warp(tlobe * (0.2 + 1.1 * st)))[..., None] * col((0, 185, 165)) * 1.1
img += L_left[..., None] * col((40, 110, 255)) * 0.8
img += L_low[..., None] * col((0, 160, 170)) * 0.7
bl = np.exp(-((u - 0.1) / 0.12) ** 2) * np.exp(-((v - 0.83) / 0.06) ** 2)
bump = np.exp(-((u - 0.82) / 0.07) ** 2) * np.exp(-((v - 0.76) / 0.06) ** 2)
img += warp(bl * (0.4 + 0.8 * st))[..., None] * col((0, 170, 180)) * 0.6
img += warp(bump * (0.5 + 0.6 * st))[..., None] * col((40, 110, 255)) * 0.7
img += haze[..., None] * col((70, 50, 200)) * 0.4
# streak smear upward (long exposure) + glow
sm = nd.uniform_filter1d(img, size=int(H * 0.03), axis=0)
img = img * 0.4 + sm * 0.6
img = img * 0.6 + nd.gaussian_filter(img, (W * 0.0036, W * 0.0036, 0)) * 0.4
glow = nd.gaussian_filter(img, (W * 0.05, W * 0.05, 0))
img = 1 - (1 - img) * (1 - glow * 0.75)
img = img * 0.45 + nd.gaussian_filter(img, (W * 0.012, W * 0.008, 0)) * 0.55
img *= pocket[..., None]
bloom1 = nd.gaussian_filter(np.clip(img - 0.35, 0, None), (W * 0.01, W * 0.01, 0))
bloom2 = nd.gaussian_filter(np.clip(img - 0.2, 0, None), (W * 0.07, W * 0.07, 0))
img = img + bloom1 * 0.25 + bloom2 * 0.22
img[..., 2] = nd.shift(img[..., 2], (0, W * 0.0015), order=1, mode='nearest'); img[..., 0] = nd.shift(img[..., 0], (0, -W * 0.0015), order=1, mode='nearest')
lum = img.mean(-1)
sr = np.random.default_rng(99).random((H, W)); stars = (sr > 0.9993).astype(np.float32)
stars = nd.gaussian_filter(stars, 0.7) * 6 * (sr > 0.9993).sum() ** 0
img += (stars * np.clip(1 - lum / 0.12, 0, 1))[..., None] * 0.9
g = img.mean(-1, keepdims=True); img = np.clip(g + (img - g) * 1.12, 0, None)   # richer colour
img = img / (1 + img * 0.12)
# vignette, deepest top-left
d = np.sqrt(((u - 0.45) / 0.8) ** 2 + ((v - 0.58) / 0.75) ** 2)
img *= (1 - 0.92 * np.clip(d, 0, 1) ** 2.2)[..., None]
img = np.clip(img, 0, 1) ** (1 / 1.05)
# fine grain
img += (rng.standard_normal((H, W, 1)) * 0.006).astype(np.float32)
Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(out)
