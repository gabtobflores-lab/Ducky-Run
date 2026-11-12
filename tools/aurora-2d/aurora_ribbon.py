# Mirror Drop aurora, built the way real northern lights look: one long, thin ribbon swirling across the sky.
# Hundreds of fine rays hang from the ribbon's lower edge and fade upward. All rays run along the magnetic field,
# so in perspective they converge on a point high above the viewer. Where the ribbon turns and runs along the rays,
# we look along it edge-on: many rays stack up and that fold glows brightest. This comes from the geometry here,
# it is not painted on. Farther parts of the ribbon (higher on screen) are dimmer and their rays shorter.
# Implementation: work in ray coordinates (s = angle from the convergence point, r = distance from it). Every point
# of the ribbon drops a ray, a column in (s, r) running from its edge up towards the convergence point. All the rays
# are summed on that grid and the grid is then mapped back to the screen.
# Usage: python3 aurora_ribbon.py W H out.png phase   (phase 0..1 loops seamlessly)
import numpy as np, sys, os
from scipy import ndimage as nd
from PIL import Image
E = lambda k, d: float(os.environ.get(k, d))
W, H, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]; ph = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
T = 2 * np.pi * ph; asp = W / H
XV, YV = asp * E('XVF', .5), E('YV', -1.7)            # where the rays converge: far above the top of the screen

# the ribbon's path on screen (x as a fraction of width, y as a fraction of height), drifting slowly in a loop
CP = [(-.15, .60), (.12, .67), (.42, .64), (.70, .55), (.86, .40), (.74, .27), (.50, .23), (.30, .15), (.36, .03), (.55, -.05)]
pts = []
for k, (x, y) in enumerate(CP):
    a = .035 * np.sin(T + k * 1.3) + .02 * np.sin(2 * T + k * .7)
    b = .025 * np.cos(T + k * 1.9)
    pts.append((x + a, y + b))
pts = np.array(pts)
def catmull(P, n):                                       # a smooth curve through the control points
    P = np.vstack([P[0] * 2 - P[1], P, P[-1] * 2 - P[-2]]); out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for tt in np.linspace(0, 1, n, endpoint=False):
            out.append(.5 * ((2 * p1) + (-p0 + p2) * tt + (2 * p0 - 5 * p1 + 4 * p2 - p3) * tt * tt + (-p0 + 3 * p1 - 3 * p2 + p3) * tt ** 3))
    return np.array(out)
C = catmull(pts, 500)                                    # thousands of points along the ribbon
u = np.linspace(0, 1, len(C))
_rip = np.random.default_rng(13).standard_normal(4096); _rip = nd.gaussian_filter1d(_rip, 45, mode='wrap'); _rip /= _rip.std()
tg = np.gradient(C, axis=0); tg /= np.linalg.norm(tg, axis=1, keepdims=True) + 1e-9; nrm_ = np.stack([-tg[:, 1], tg[:, 0]], 1)
rip = np.interp((u * 4096 * 2 + 4096 * ph) % 4096, np.arange(4096), _rip) * E('RIP', .007)
C = C + nrm_ * rip[:, None]                             # small folds rippling along the ribbon's edge, travelling slowly
cx, cy = C[:, 0] * asp, C[:, 1]
cs = np.arctan2(cx - XV, cy - YV); cr = np.hypot(cx - XV, cy - YV)

# the grid in ray coordinates
Y, X = np.mgrid[0:H, 0:W].astype(np.float32); X = X / H; Y = Y / H
S = np.arctan2(X - XV, Y - YV); Rr = np.hypot(X - XV, Y - YV)
s0, s1 = S.min() - .02, S.max() + .02; r0, r1 = max(.01, Rr.min() - .3), Rr.max() + .02
NS, NR = 3000, 1400
si = (cs - s0) / (s1 - s0) * (NS - 1); ri = (cr - r0) / (r1 - r0) * (NR - 1)
rr = np.linspace(r0, r1, NR)

def noise1(n, seed, smooth):
    v = np.random.default_rng(seed).standard_normal(n); v = nd.gaussian_filter1d(v, smooth, mode='wrap'); return v / (v.std() + 1e-9)
NU = len(C)
# along the ribbon: fine rays, broader bright patches, both drifting along it in whole loops
k_ray = noise1(4096, 3, 1.2); k_pat = noise1(4096, 5, 60); k_len = noise1(4096, 7, 25)
def wrapS(arr, off): x = (np.arange(NU) / NU * 4096 * 3 + off) % 4096; return np.interp(x, np.arange(4096), arr)
ray = np.clip(.75 + .25 * wrapS(k_ray, 4096 * ph), .2, None) ** 1.2
pat = np.clip(.75 + .4 * wrapS(k_pat, -4096 * ph), .25, None) ** 1.2   # bright stretches and near-gaps along the ribbon
far = np.clip((cy - (-.05)) / .7, .25, 1)              # higher on screen = farther away: dimmer and shorter
L = np.clip(E('LEN', .045) * (1 + .4 * wrapS(k_len, 0)), .02, .12) * (.5 + .5 * far)  # how far up each ray reaches
amp = ray * pat * (.35 + .65 * far)
ends = np.clip((u - .0) / .06, 0, 1) * np.clip((1 - u) / .1, 0, 1)   # the ribbon fades in and out at its ends
amp *= ends

A = np.zeros((NS, NR), np.float32); B = np.zeros_like(A); V = np.zeros_like(A)
for i in range(NU):
    if amp[i] < .01: continue
    j = int(round(si[i]));
    if j < 0 or j >= NS: continue
    d = cr[i] - rr                                        # > 0 above the ribbon's edge (towards the convergence point)
    edge = 1 / (1 + np.exp(np.clip(-d / E('EDGE', .011), -60, 60)))  # a crisp lower edge
    up = np.clip(d, 0, None)
    A[j] += amp[i] * edge * np.exp(-up / (L[i] * .3))     # the bright lower part of each ray
    B[j] += amp[i] * edge * np.exp(-up / L[i])            # the whole ray
    V[j] += amp[i] * edge * np.exp(-up / (L[i] * 1.5)) * np.clip(up / L[i], 0, 1)   # the faint top, turning violet
# rays have a little width; light also spills softly round the whole ribbon
for G, sw in ((A, 3.5), (B, 6.0), (V, 12)): G[:] = nd.gaussian_filter(G, (sw, 1.0))
sc = lambda G: nd.map_coordinates(G, [(S - s0) / (s1 - s0) * (NS - 1), (Rr - r0) / (r1 - r0) * (NR - 1)], order=1, mode='constant')
a, b, v = sc(A), sc(B), sc(V)
n = np.percentile(b, 99.7) + 1e-6; a, b, v = a / n, b / n, v / n
EX = E('EXPO', 1.0)
img = (a[..., None] * np.array([.35, 1.0, .95]) * .75 + b[..., None] * np.array([.02, .62, 1.0]) * .95 + v[..., None] * np.array([.42, .25, .95]) * .9) * EX   # cyan at the edge, blue above, violet at the top
# glow and scattering in the air round the bright parts
img = img + nd.gaussian_filter(img, (W * .012, W * .012, 0)) * .6 + nd.gaussian_filter(img, (W * .045, W * .045, 0)) * E('GLOW', 1.0) + nd.gaussian_filter(img, (W * .15, W * .15, 0)) * .35  # the luminous haze round the ribbon
# the night sky: deep blue, a little lighter at the horizon, stars, the Milky Way faintly behind
sky = np.zeros((H, W, 3)) + np.array([.008, .014, .04]) + (Y / Y.max())[..., None] * np.array([.02, .03, .07])
rng = np.random.default_rng(11); st = (rng.random((H, W)) > .9986).astype(np.float32) * rng.random((H, W)).astype(np.float32)
st = nd.gaussian_filter(st, .7) * 5; sky += st[..., None] * np.array([.9, .93, 1.0]) * .55
mw = np.exp(-(((X / asp - .2) - (Y / Y.max()) * .5) / .18) ** 2) * .025; sky += mw[..., None] * np.array([.5, .5, .7])
img = img + sky
img = 1 - np.exp(-img * 1.25)
img = np.clip(img, 0, 1) ** (1 / 1.05)
img += np.random.default_rng(int(ph * 997) + 1).standard_normal((H, W, 1)) * .004
Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(out)
