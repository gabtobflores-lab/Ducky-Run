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
EXPO = float(os.environ.get('EXPO', 0.27))
FOLD = float(os.environ.get('FOLD', 0.9))      # strength of fold brightening
RAYK = float(os.environ.get('RAYK', 0.3))      # contrast of the rays
GLOW = float(os.environ.get('GLOW', 3.0))      # soft diffuse light around each curtain
SCAT = float(os.environ.get('SCAT', 0.15))      # light scattered into the surrounding air
PMIN = float(os.environ.get('PMIN', 0.45))     # how dark the quiet stretches of a curtain get
SPANS = float(os.environ.get('SPANS', 0.1))      # softness of a curtain's ends
FOCUS = float(os.environ.get('FOCUS', 1.0))    # gathers the main curtain's light around one focal area
FOCX = float(os.environ.get('FOCX', 0.32))     # where that focal area is (across the view)
FOCW = float(os.environ.get('FOCW', 0.2))      # how wide that focal area is
GRP = float(os.environ.get('GRP', 0.12))      # contrast of the broad ray groups (columns)
BOTV = float(os.environ.get('BOTV', 0.6))      # blue-violet glow along the bottom
TEALK = float(os.environ.get('TEALK', 1.8))    # strength of the upper-right teal curtain
HEMY = float(os.environ.get('HEMY', 0.7))      # height of the main curtain's lower edge
FINE = float(os.environ.get('FINE', 0.5))      # delicate fine ray texture inside the glow
LEFTK = float(os.environ.get('LEFTK', 0.5))    # strength of the left curtain
LEFTY = float(os.environ.get('LEFTY', 0.78))      # height of the left curtain's lower edge
MFOLD = float(os.environ.get('MFOLD', 0.025))  # how deeply the main curtain's lower edge folds
MRISE = float(os.environ.get('MRISE', 0.26))      # how far up the main curtain's light reaches
CLUMP = float(os.environ.get('CLUMP', 0.5))    # soft clumps of brightness inside the glow, elongated along the rays
PHOTO = float(os.environ.get('PHOTO', 0.5))      # photographic softness of the finished image
HAZE = float(os.environ.get('HAZE', 0.25))      # broad blue haze around the light, stronger to the left
LOWR = float(os.environ.get('LOWR', 0.3))      # strength of the faint low-right curtain
VIOL = float(os.environ.get('VIOL', 1.2))      # violet fold edge along the right side of the main glow
MPK = float(os.environ.get('MPK', 0.14))       # how far above its lower edge the main curtain is brightest (0 = at the edge)
MFB = float(os.environ.get('MFB', 0.6))       # fold brightening on the main curtain
MPAT = float(os.environ.get('MPAT', 0.4))     # contrast of bright/quiet stretches on the main curtain
SIDE = float(os.environ.get('SIDE', 1.1))     # darkens the sky away from the main body
SIDX = float(os.environ.get('SIDX', 0.42))    # where the main body is across the screen
LOWG = float(os.environ.get('LOWG', 0.45))     # soft blue glow hanging below the main body
MBLUR = float(os.environ.get('MBLUR', 14))   # softness of the main curtain
LOWC = os.environ.get('LOWC', '20,125,235')   # colour of the glow below the body
CURL = float(os.environ.get('CURL', 0.0))     # a short low fold of light curling under the lower left of the main body
CURX = float(os.environ.get('CURX', -0.09))   # its position relative to the focal area
CURY = float(os.environ.get('CURY', 0.07))    # how far below the main edge the curl hangs
KNOT = float(os.environ.get('KNOT', 1.6))     # a soft bright knot of light at the lower left of the main body
KNY = float(os.environ.get('KNY', -0.03))       # its height relative to the main edge (screen heights, + = lower)
FOCWL = float(os.environ.get('FOCWL', 0.13))   # width of the focal area on its left side (0 = same as right): smaller gives a clear left edge
GAP = float(os.environ.get('GAP', 0.6))       # dark gap between the knot and the body above it
UPC = os.environ.get('UPC', '35,230,232')        # the main curtain's upper colour
def col(c): return np.array(c, np.float32) / 255
def n1(t, seed, smooth=8, n=4096):                         # smooth 1D noise, unit variance, wraps on [0,1)
    r = np.random.default_rng(seed).standard_normal(n).astype(np.float32)
    r = nd.gaussian_filter1d(r, smooth, mode='wrap'); r /= r.std() + 1e-6
    return np.interp(np.mod(t, 1.0) * (n - 1), np.arange(n), r).astype(np.float32)

asp = W / H
Y, X = np.mgrid[0:H, 0:W].astype(np.float32); X = X / H; Y = Y / H     # screen in units of its height
XV, YV = float(os.environ.get('XV', -0.15)), -1.25                                                   # where the rays converge: high above, a little left
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
    rays *= (1 - GRP) + GRP * n1(ss * 1.0 - 0.003 * np.cos(T + seed), seed + 3, 16)    # and broader ray groups
    rays *= 1 + FINE * 0.25 * n1(ss * 1.0 + 0.002 * np.sin(T + seed), seed + 6, 1.2)   # delicate fine rays
    rays = 1 + RAYK * (rays - 1)
    patch = np.clip(0.3 + 0.9 * n1(ss * 1.0 + 0.01 * np.sin(T + drift), seed + 4, 140), PMIN, 1.4)   # one or two bright stretches   # bright and quiet stretches
    if seed == 22:
        fold_b = 1 + (fold_b - 1) * MFB
        patch = patch.mean() + (patch - patch.mean()) * MPAT
    span = 1 / (1 + np.exp(-(ss - s0) / SPANS)) / (1 + np.exp((ss - s1) / SPANS))
    B1 = fold_b * rays * patch * span
    if seed == 22 and FOCUS > 0:
        wf = np.where(ss < FOCX, FOCWL if FOCWL > 0 else FOCW, FOCW)
        B1 = B1 * ((1 - FOCUS) + FOCUS * 1.6 * np.exp(-np.abs((ss - FOCX) / wf) ** (2.6 if FOCWL > 0 else 2)))
    hemP = np.interp(S, ss, hem); BP = np.interp(S, ss, B1)
    d = hemP - R                                                         # > 0 above the lower edge
    above = np.exp(-np.clip(d, 0, None) / rise)
    if seed == 22 and MPK > 0:   # brightest part of the body sits above the edge; light below it fades softly towards the edge
        above = np.exp(-np.clip(d - MPK, 0, None) / rise) * (0.25 + 0.75 * np.exp(-(np.clip(MPK - d, 0, None) / (MPK * 0.55)) ** 2))
    edge = 1 / (1 + np.exp(-d / thick))
    core = above * edge
    # rays flicker gently along their length
    flick = 0.82 + 0.18 * np.interp(np.mod(S * 1.0 + R * 0.35, 1.0) * 4095, np.arange(4096), n1(np.linspace(0, 1, 4096), seed + 5, 3))
    diffuse = np.exp(-np.clip(d, 0, None) / (rise * 1.6)) * (1 / (1 + np.exp(-d / (thick * 2.0))))
    soft = nd.gaussian_filter(np.interp(S, ss, patch * span), 1)       # broad soft light along the curtain
    if CLUMP > 0:   # soft clumps: a smooth field in ray coordinates, stretched along the rays, drifting slowly
        rng2 = np.random.default_rng(seed + 77)
        fld = nd.gaussian_filter(rng2.standard_normal((256, 256)).astype(np.float32), (14, 5), mode='wrap')
        fld = (fld - fld.mean()) / (fld.std() + 1e-6)
        rr = (R - R.min()) / (R.max() - R.min())
        cl = nd.map_coordinates(fld, [np.mod(rr * 255 * 1.4 + 6 * np.sin(T + seed), 256), np.mod(S * 255 * 2.2 + 4 * np.cos(T + seed), 256)], order=1, mode='wrap')
        core = core * np.clip(1 + CLUMP * 0.45 * np.tanh(cl), 0.15, 1.8)
    return core * BP * flick + GLOW * 0.35 * diffuse * soft, d

# curtains, far to near: (s0, s1, edge height, fold amp, fold freq, rise, edge softness, seed, intensity, edge colour, upper colour, blur)
CURTAINS = [
    (0.00, 0.40, LEFTY, 0.020, 0.45, 0.16, 0.04, 11, 0.30 * LEFTK, (30, 130, 230), (12, 45, 140), 9.0),   # far left, blue
    (0.60, 1.00, 0.40, 0.022, 0.5, 0.10, 0.04, 12, 0.60 * TEALK, (0, 205, 185),  (0, 90, 130),  8.0),    # upper right, teal
    (0.10, 0.84, HEMY, MFOLD, 0.6, MRISE, 0.035, 22, 1.00, (60, 245, 240), tuple(int(v) for v in UPC.split(',')), MBLUR),   # main curtain: one wide body
    (0.66, 1.00, 0.88, 0.020, 0.45, 0.08, 0.04, 14, 0.30 * LOWR, (0, 170, 190),  (5, 60, 140),  8.0),   # low right, faint
    (FOCX + CURX - 0.05, FOCX + CURX + 0.05, HEMY + CURY, 0.03, 0.9, 0.07, 0.03, 41, 0.9 * CURL, (60, 245, 240), (20, 170, 240), 5.0),   # low curl
    (FOCX + 0.12, FOCX + 0.2, HEMY - 0.03, 0.01, 0.5, MRISE * 1.3, 0.035, 31, 0.5 * VIOL, (120, 80, 255), (70, 50, 200), 6.0),   # violet fold edge
]
img = np.zeros((H, W, 3), np.float32)
sky = col((1, 3, 10)) * (1 - Y[..., None]) + col((7, 11, 36)) * Y[..., None]
img += sky
for (s0, s1, hy, fa, ff, rise, th, sd, inten, ec, uc, blur) in CURTAINS:
    L, d = curtain(s0, s1, hy, fa, ff, rise, th, sd, sd * 1.3)
    if blur > 0: L = nd.gaussian_filter(L, blur * W / 1206)
    k = np.clip(d / rise, 0, 1)[..., None] ** float(os.environ.get('KEXP', 4.0))                          # colour by height above the edge
    c = col(ec) * (1 - k) + col(uc) * k
    img += L[..., None] * c * inten * EXPO
if KNOT > 0:   # bright knot where the curtain's lower edge folds towards the viewer: compact, stretched a little along the rays
    s_k = FOCX + CURX; r_k = r_at(HEMY + KNY)
    g = np.exp(-((S - s_k) / 0.035) ** 2 - ((R - r_k) / 0.045) ** 2)
    g = g + 0.5 * np.exp(-((S - s_k - 0.03) / 0.02) ** 2 - ((R - r_k + 0.05) / 0.06) ** 2)   # a fainter tail curling up and right
    img = img + nd.gaussian_filter(g, 4 * W / 1206)[..., None] * col((70, 250, 245)) * KNOT * EXPO
    if GAP > 0:   # a pocket of darker sky between the knot and the body: the sheet folds away there
        gp = np.exp(-((S - s_k - 0.035) / 0.03) ** 2 - ((R - r_k + 0.065) / 0.03) ** 2)
        img = sky + (img - sky) * (1 - GAP * nd.gaussian_filter(gp, 6 * W / 1206))[..., None]
if LOWG > 0:   # light from the body lights the air beneath it: a broad blue glow, below the body, fading downward
    litL = nd.gaussian_filter(np.clip((img - sky).mean(-1), 0, None), W * 0.07)
    litL = np.roll(litL, int(0.09 * H), axis=0); litL[:int(0.09 * H)] = 0
    litL = litL / (litL.max() + 1e-6)
    wv = np.clip((Y - 0.5) / 0.12, 0, 1) * np.clip((0.95 - Y) / 0.2, 0, 1)
    img = img + (litL * wv)[..., None] * col(tuple(int(v) for v in LOWC.split(','))) * LOWG
if BOTV > 0:   # a broad, soft blue-violet glow along the bottom, strongest under the light, fading upward
    under = nd.gaussian_filter(np.clip((img - sky).mean(-1), 0, None), W * 0.12)
    under = under / (under.max() + 1e-6)
    bot = np.clip((Y - 0.72) / 0.28, 0, 1) ** 1.3 * (0.35 + 0.65 * under)
    img = img + bot[..., None] * (col((95, 50, 215)) * 0.8 + col((40, 80, 230)) * 0.2) * BOTV
if HAZE > 0:   # a broad blue haze: the lit air around the aurora, leaning towards the left side
    lightH = np.clip((img - sky).mean(-1), 0, None)
    hz = nd.gaussian_filter(lightH, W * 0.14); hz = hz / (hz.max() + 1e-6)
    hz = hz * (0.6 + 0.4 * np.clip((0.6 - X / asp) / 0.6, 0, 1))
    img = img + hz[..., None] * col((10, 125, 215)) * HAZE * 0.35
if SCAT > 0:   # light scattered into the air around the curtains: wide, soft, follows the light (not a screen-wide wash)
    lightL = img - sky
    img = img + nd.gaussian_filter(lightL, (W * 0.06, W * 0.06, 0)) * SCAT + nd.gaussian_filter(lightL, (W * 0.02, W * 0.02, 0)) * SCAT * 0.6
if SIDE > 0:   # the sky falls off to darkness away from the main body
    xs = X / asp
    ur = np.clip((xs - 0.55) / 0.3, 0, 1) * np.clip((0.55 - Y) / 0.25, 0, 1)      # leave the upper-right curtain visible
    img = sky + (img - sky) * (1 - SIDE * (1 - np.exp(-((xs - SIDX) / 0.38) ** 2)) * (1 - 0.75 * ur))[..., None]
# composition: dark top for the score, calmer band behind the balls
img *= (0.35 + 0.65 * np.clip((Y - 0.04) / 0.18, 0, 1))[..., None]
img *= (1 - 0.15 * np.exp(-((Y - 0.78) / 0.045) ** 2))[..., None]
# light scattering: small and only on the brightest light
br = np.clip(img - 0.35, 0, None)
img += nd.gaussian_filter(br, (W * 0.01, W * 0.01, 0)) * 0.45
img = img * (1 - PHOTO) + nd.gaussian_filter(img, (W * 0.004, W * 0.004, 0)) * PHOTO        # the softness of a photograph
st = (np.random.default_rng(99).random((H, W)) > 0.99985).astype(np.float32)
img += (nd.gaussian_filter(st, 0.6) * 4 * np.clip(1 - img.mean(-1) / 0.06, 0, 1))[..., None] * 0.45
img = img / (1 + 0.3 * img)
img = np.clip(img, 0, 1) ** (1 / 1.03)
img += np.random.default_rng(int(ph * 997) + 3).standard_normal((H, W, 1)).astype(np.float32) * 0.004
Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out)
