# Volumetric aurora: curtains are thin vertical sheets standing on wiggly ground footprints (Lawlor & Genetti style),
# ray-marched from a camera on the ground. Shape, folds, brightness of edge-on folds and perspective come from the geometry.
import numpy as np, sys, os
from scipy import ndimage as nd
from PIL import Image
W, H = int(sys.argv[1]), int(sys.argv[2]); out = sys.argv[3]; ph = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
T = 2 * np.pi * ph
E = lambda k, d: float(os.environ.get(k, d))
PITCH = np.radians(E('PITCH', 38)); FOV = np.radians(E('FOV', 78)); YAW = np.radians(E('YAW', 0))
NS = int(E('NS', 64))
def fbm1(x, seed, oct=4, base=1.0):
    r = np.random.default_rng(seed); v = 0; a = 1
    for o in range(oct):
        ph1, ph2 = r.uniform(0, 2*np.pi, 2); f = base * 2**o * r.uniform(0.8, 1.25)
        v = v + a * np.sin(x * f + ph1 + 0.6*np.sin(x*f*0.5+ph2)); a *= 0.5
    return v
# camera rays
j, i = np.mgrid[0:H, 0:W].astype(np.float32)
u = (i + 0.5) / W * 2 - 1; v = 1 - (j + 0.5) / H * 2
v = v + E('LS', 0.0)   # lens shift: slides the picture in the frame without changing the perspective
tf = np.tan(FOV / 2); asp = W / H
dx = u * tf * asp; dy = v * tf; dz = np.ones_like(dx)
# pitch up
cy, sy = np.cos(PITCH), np.sin(PITCH)
dy2 = dy * cy + dz * sy; dz2 = -dy * sy + dz * cy
cw, sw = np.cos(YAW), np.sin(YAW)
dx2 = dx * cw + dz2 * sw; dz3 = -dx * sw + dz2 * cw
n = np.sqrt(dx2**2 + dy2**2 + dz3**2); dx2 /= n; dy2 /= n; dz3 /= n
# curtains running AWAY from the viewer (along depth z): footprint x = x0 + wiggle(z). Seen from below they rise as tall columns.
# (x0 km, wiggle amp km, wiggle scale km, seed, bottom alt km, fade height km, thickness km, intensity, z start, z end)
CURT = [
    (E('X1', 8), E('A1', 14), E('L1', 60), 3, 100, E('HF1', 80), E('TH1', 3.0), 1.0, E('ZS1', 30), E('ZE1', 500)),
    (E('X2', 70), E('A2', 20), 80, 7, 104, 60, 4.0, E('I2', 0.45), 40, 600),
    (E('X3', -55), 18, 70, 11, 100, 60, 4.0, E('I3', 0.3), 30, 500),
    (E('X4', 18), E('A4', 22), 55, 19, 102, E('HF4', 90), E('TH4', 6.0), E('I4', 0.0), E('ZS4', 200), 600),
]
REFL = E('REFL', 0.0)
below0 = dy2 < 0
YB, YT = 95.0, 320.0
L = np.zeros((H, W), np.float32); Lh = np.zeros((H, W), np.float32)
up = dy2 > 0.02
t0 = np.where(up, YB / np.maximum(dy2, 1e-3), 0); t1 = np.where(up, YT / np.maximum(dy2, 1e-3), 0)
t1 = np.minimum(t1, t0 + 900)
jit = np.random.default_rng(5).random((H, W)).astype(np.float32)
for k in range(NS):
    t = t0 + (t1 - t0) * (k + jit) / NS; dt = (t1 - t0) / NS
    px = t * dx2; py = t * dy2; pz = t * dz3
    for (x0, A, Ls, sd, yb, hf, th, I, zs, ze) in CURT:
        xc = x0 + A * fbm1(pz / Ls + 0.35*np.sin(T + sd), sd, 4) + 0.4*A*np.sin(pz/(Ls*3) + T + sd)
        d = px - xc
        sheet = np.exp(-(d / th) ** 2)
        ybk = yb + 5 * fbm1(pz / 40 + sd, sd + 1, 3)
        h = py - ybk
        prof = np.where(h > 0, np.exp(-h / hf), np.exp(-(h / 3.0) ** 2))
        rays = 0.55 + 0.45 * (0.5 + 0.5 * fbm1(pz / 5 + 0.2*np.sin(T+sd), sd + 2, 3) / 1.6)
        patch = np.clip(0.5 + 0.5 * fbm1(pz / 90 + 0.3*np.cos(T+sd), sd + 3, 2) / 1.4, 0.1, 1)
        span = 1 / (1 + np.exp(-(pz - zs) / E('SPS', 30))) / (1 + np.exp((pz - ze) / 60))
        e = sheet * prof * rays * patch * span * I * up
        L += e * dt; Lh += e * dt * np.clip(h, 0, None)
    if E('IF', 0) > 0:   # a distant curtain running across the view, low over the horizon
        zc = E('ZF', 700) + 60 * fbm1(px / 150 + 0.3*np.sin(T), 31, 4)
        sheet = np.exp(-((pz - zc) / 12) ** 2)
        h = py - 100
        prof = np.where(h > 0, np.exp(-h / 90), np.exp(-(h / 4) ** 2))
        rays = 0.6 + 0.4 * (0.5 + 0.5 * fbm1(px / 8, 33, 3) / 1.6)
        patch = np.clip(0.5 + 0.5 * fbm1(px / 200 + 0.3*np.cos(T), 34, 2) / 1.4, 0.15, 1)
        e = sheet * prof * rays * patch * E('IF', 0) * up
        L += e * dt; Lh += e * dt * np.clip(h, 0, None)
hm = Lh / (L + 1e-6)                      # emission-weighted height above the lower edge
np.save(out + '.npy', np.stack([L, hm]))
# colour: bright cyan low, deeper blue higher
k = np.clip(hm / E('HC', 80), 0, 1)[..., None]
c = np.array([40, 245, 245]) / 255 * (1 - k) + np.array([20, 110, 230]) / 255 * k
img = L[..., None] / np.percentile(L, 99.5) * E('EXPO', 0.9) * c
img = img + nd.gaussian_filter(img, (W*0.03, W*0.03, 0)) * E('BLOOM', 0.35) + nd.gaussian_filter(img, (W*0.12, W*0.12, 0)) * E('HAZE', 0.0) * np.array([0.4, 0.8, 1.2])
below = np.clip(-dy2 / 0.25 + 0.1, 0, 1)[..., None]   # below the horizon: soft blue-violet glow of light scattered low in the sky
img = img + below * np.array([0.10, 0.14, 0.42]) * E('LOWB', 0.0) + nd.gaussian_filter(img, (W*0.08, W*0.08, 0)) * below * E('LOWR', 0.0)
if REFL > 0:   # below the horizon: the light above, mirrored, stretched downward and blurred - soft reflected glow
    rm = L.mean(1); lit = np.where(rm > 0.08 * rm.max())[0]; hr = int(lit.max()) + 1 if len(lit) else H   # last lit row
    if hr < H:
        ys = np.arange(hr, H); src = np.clip(hr - 1 - ((ys - hr) * E('RSC', 2.5)).astype(int), 0, hr - 1)
        refl = nd.gaussian_filter(img[src], (W * 0.03, W * 0.015, 0))
        wgt = np.exp(-(ys - hr) / (H * 0.12))[:, None, None]
        img[hr:] = img[hr:] + refl * REFL * (0.35 + 0.65 * wgt)
sky = np.linspace(0.01, 0.05, H)[:, None, None] * np.array([0.3, 0.4, 1.0]) + (np.clip((np.arange(H)[:, None, None] / H - 0.6) / 0.4, 0, 1) ** 1.5) * np.array([0.12, 0.2, 0.6]) * E('HORZ', 0.0)
img = img + sky
img = img / (1 + 0.5 * img)
Image.fromarray((np.clip(img, 0, 1) ** (1/1.05) * 255).astype(np.uint8)).save(out)
