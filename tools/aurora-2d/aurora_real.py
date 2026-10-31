# Mirror Drop aurora, built the way a real aurora is.
# A real aurora is a thin, tall sheet of light hanging along the magnetic field. Seen from the ground:
#  - every ray runs along the field, so all rays are parallel and, in perspective, converge on one point high above the viewer;
#  - the sheet's lower edge is its brightest, sharpest part, and the light fades upward;
#  - where the sheet folds edge-on to the viewer you look through more of it, so folds show as bright streaks;
#  - farther curtains are dimmer, thinner and softer.
# Each pixel is described by which ray it lies on (s, the angle from the convergence point) and how far along that ray it is (r).
# A curtain is defined by its folding lower edge r_hem(s); its light is a profile of (r_hem - r): sharp below, fading above.
# Usage: python3 real.py W H out.png phase   (phase 0..1 loops seamlessly)
import numpy as np, sys, os
from scipy import ndimage as nd
from PIL import Image
W, H = int(sys.argv[1]), int(sys.argv[2]); out = sys.argv[3]; ph = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
T = ph * 2 * np.pi
EXPO = float(os.environ.get('EXPO', 0.38))
FOLD = float(os.environ.get('FOLD', 2.2))      # strength of fold brightening
RAYK = float(os.environ.get('RAYK', 0.6))      # contrast of the rays
GLOW = float(os.environ.get('GLOW', 1.6))
SCAT = float(os.environ.get('SCAT', 0.35))      # light scattered into the surrounding air
PMIN = float(os.environ.get('PMIN', 0.12))     # how dark the quiet stretches of a curtain get
SPANS = float(os.environ.get('SPANS', 0.1))   # softness of a curtain's ends      # soft diffuse light around each curtain
def col(c): return np.array(c, np.float32) / 255
def n1(t, seed, smooth=8, n=4096):                         # smooth 1D noise, unit variance, wraps on [0,1)
    r = np.random.default_rng(seed).standard_normal(n).astype(np.float32)
    r = nd.gaussian_filter1d(r, smooth, mode='wrap'); r /= r.std() + 1e-6
    return np.interp(np.mod(t, 1.0) * (n - 1), np.arange(n), r).astype(np.float32)

asp = W / H
Y, X = np.mgrid[0:H, 0:W].astype(np.float32); X = X / H; Y = Y / H     # screen in units of its height
XV, YV = 0.12, -1.25                                                   # where the rays converge: high above, a little left
A = np.arctan2(X - XV, Y - YV)                                         # which ray a pixel is on
R = np.hypot(X - XV, Y - YV)                                           # how far along that ray (larger = lower on screen)
a0, a1 = A.min(), A.max()
S = (A - a0) / (a1 - a0)                                               # 0 at the left edge of the view, 1 at the right
def r_at(y):                                                           # r of a screen height y, at mid-screen
    return float(np.hypot(asp * 0.5 - XV, y - YV))

def curtain(s0, s1, hem_y, fold_amp, fold_freq, rise, thick, seed, drift):
    """Light of one curtain. s0..s1: its extent across the view; hem_y: screen height of its lower edge; fold_amp/freq: how
    strongly and finely the sheet folds; rise: how far up the light fades (screen heights); thick: softness of the edge."""
    ss = np.linspace(0, 1, 4096, dtype=np.float32)
    ph1 = 0.03 * np.sin(T + drift); ph2 = 0.02 * np.cos(T * 1 + drift * 1.7)
    hem = (r_at(hem_y)
           + fold_amp * n1(ss * fold_freq + ph1, seed, 70)                        # folds: broad, smooth
           + fold_amp * 0.6 * n1(ss * fold_freq * 0.35 + ph2, seed + 1, 160)      # large bends
           + 0.006 * np.sin(T + ss * 20 + drift))                                  # a slow ripple
    dh = np.abs(np.gradient(hem, ss)) / (fold_amp * fold_freq + 1e-6)              # how steeply the edge turns: folds seen edge-on
    fold_b = 1 + FOLD * 1.4 * np.clip(dh, 0, 2.5) ** 1.3
    rays = 0.6 + 0.4 * n1(ss * 1.0 + 0.004 * np.sin(T + seed), seed + 2, 7)       # parallel rays
    rays *= 0.65 + 0.35 * n1(ss * 1.0 - 0.003 * np.cos(T + seed), seed + 3, 16)    # and broader ray groups
    rays = 1 + RAYK * (rays - 1)
    patch = np.clip(0.3 + 0.9 * n1(ss * 1.0 + 0.01 * np.sin(T + drift), seed + 4, 140), PMIN, 1.4)   # one or two bright stretches   # bright and quiet stretches
    span = 1 / (1 + np.exp(-(ss - s0) / SPANS)) / (1 + np.exp((ss - s1) / SPANS))
    B1 = fold_b * rays * patch * span
    hemP = np.interp(S, ss, hem); BP = np.interp(S, ss, B1)
    d = hemP - R                                                         # > 0 above the lower edge
    above = np.exp(-np.clip(d, 0, None) / rise)
    edge = 1 / (1 + np.exp(-d / thick))
    core = above * edge
    # rays flicker gently along their length
    flick = 0.82 + 0.18 * np.interp(np.mod(S * 1.0 + R * 0.35, 1.0) * 4095, np.arange(4096), n1(np.linspace(0, 1, 4096), seed + 5, 3))
    diffuse = np.exp(-np.clip(d, 0, None) / (rise * 1.6)) * (1 / (1 + np.exp(-d / (thick * 2.0))))
    soft = nd.gaussian_filter(np.interp(S, ss, patch * span), 1)       # broad soft light along the curtain
    return core * BP * flick + GLOW * 0.35 * diffuse * soft, d

# curtains, far to near: (s0, s1, edge height, fold amp, fold freq, rise, edge softness, seed, intensity, edge colour, upper colour, blur)
CURTAINS = [
    (0.00, 0.45, 0.52, 0.020, 0.45, 0.12, 0.04, 11, 0.30, (30, 130, 230), (12, 45, 140), 9.0),   # far left, blue
    (0.60, 1.00, 0.40, 0.022, 0.5, 0.10, 0.04, 12, 0.60, (0, 205, 185),  (0, 90, 130),  8.0),    # upper right, teal
    (0.10, 0.84, 0.66, 0.045, 0.6, 0.17, 0.035, 13, 1.00, (60, 245, 240), (0, 150, 235), 6.0),   # main curtain: one wide body
    (0.66, 1.00, 0.88, 0.020, 0.45, 0.08, 0.04, 14, 0.30, (0, 170, 190),  (5, 60, 140),  8.0),   # low right, faint
]
img = np.zeros((H, W, 3), np.float32)
sky = col((1, 3, 10)) * (1 - Y[..., None]) + col((7, 11, 36)) * Y[..., None]
img += sky
for (s0, s1, hy, fa, ff, rise, th, sd, inten, ec, uc, blur) in CURTAINS:
    L, d = curtain(s0, s1, hy, fa, ff, rise, th, sd, sd * 1.3)
    if blur > 0: L = nd.gaussian_filter(L, blur * W / 1206)
    k = np.clip(d / rise, 0, 1)[..., None] ** 0.8                          # colour by height above the edge
    c = col(ec) * (1 - k) + col(uc) * k
    img += L[..., None] * c * inten * EXPO
if SCAT > 0:   # light scattered into the air around the curtains: wide, soft, follows the light (not a screen-wide wash)
    lightL = img - sky
    img = img + nd.gaussian_filter(lightL, (W * 0.06, W * 0.06, 0)) * SCAT + nd.gaussian_filter(lightL, (W * 0.02, W * 0.02, 0)) * SCAT * 0.6
# composition: dark top for the score, calmer band behind the balls
img *= (0.35 + 0.65 * np.clip((Y - 0.04) / 0.18, 0, 1))[..., None]
img *= (1 - 0.15 * np.exp(-((Y - 0.78) / 0.045) ** 2))[..., None]
# light scattering: small and only on the brightest light
br = np.clip(img - 0.35, 0, None)
img += nd.gaussian_filter(br, (W * 0.01, W * 0.01, 0)) * 0.45
img = img * 0.7 + nd.gaussian_filter(img, (W * 0.003, W * 0.003, 0)) * 0.3        # the softness of a photograph
st = (np.random.default_rng(99).random((H, W)) > 0.99985).astype(np.float32)
img += (nd.gaussian_filter(st, 0.6) * 4 * np.clip(1 - img.mean(-1) / 0.06, 0, 1))[..., None] * 0.45
img = img / (1 + 0.3 * img)
img = np.clip(img, 0, 1) ** (1 / 1.03)
img += np.random.default_rng(int(ph * 997) + 3).standard_normal((H, W, 1)).astype(np.float32) * 0.004
Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out)
