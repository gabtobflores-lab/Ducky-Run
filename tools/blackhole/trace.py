# Ray-traced black hole (Schwarzschild), the way Interstellar's Gargantua was made: every pixel's light ray is
# followed backwards through curved space, so the bent arcs, the lensed far side of the disk and the photon ring
# come from the physics itself, not from drawing.
#   Units: Schwarzschild radius = 1. A null geodesic in Schwarzschild space obeys, in flat-space coordinates,
#   x'' = -1.5 h^2 x / r^5 with h = |x x v| constant (the classic "starless" formulation).
# The light paths never change, so they are traced once and saved (where each ray crosses the disk plane, first and
# second time, and where escaping rays end up on the sky). shade.py then colours every frame from those maps.
# Usage: python3 trace.py W H out.npz
import numpy as np, sys, time, os
E = lambda k, d: float(os.environ.get(k, d))

W, H, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
CAM = np.array([0.0, E('CY', 1.35), E('CZ', -24.0)])          # a little above the disk plane, as in the film
TARGET = np.array([E('TX', -5.2), E('TY', -4.6), 0.0])        # aiming below and left of the hole puts it towards the upper-right corner
FOVY = np.radians(E('FOV', 64))
RIN, ROUT = 2.6, E('ROUT', 17.0)                # disk: from just outside the innermost stable orbit (3) outward

fw = TARGET - CAM; fw /= np.linalg.norm(fw)
rt = np.cross(np.array([0, 1.0, 0]), fw); rt /= np.linalg.norm(rt)
up = np.cross(fw, rt)
ty = np.tan(FOVY / 2); tx = ty * W / H
j, i = np.mgrid[0:H, 0:W].astype(np.float64)
u = ((i + .5) / W * 2 - 1) * tx; v = (1 - (j + .5) / H * 2) * ty
d = fw[None, None] + u[..., None] * rt + v[..., None] * up
d /= np.linalg.norm(d, axis=-1, keepdims=True)
n = W * H
x = np.broadcast_to(CAM, (n, 3)).copy(); vel = d.reshape(n, 3).copy()
h2 = np.sum(np.cross(x, vel) ** 2, axis=1)

hit = np.zeros((2, n, 3), np.float32)        # per crossing: r, phi, a "hit" flag
cnt = np.zeros(n, np.int8)
fate = np.zeros(n, np.int8)                  # 0 flying, 1 escaped, 2 fell in
idx = np.arange(n)
t0 = time.time(); step = 0
while idx.size and step < 4000:
    xs, vs, hs = x[idx], vel[idx], h2[idx]
    r = np.linalg.norm(xs, axis=1)
    dt = np.clip(0.06 * (r - 0.6), 0.004, 0.9)          # small steps near the hole, long strides far away
    # velocity-Verlet step of x'' = -1.5 h^2 x / r^5
    a = -1.5 * hs[:, None] * xs / r[:, None] ** 5
    xn = xs + vs * dt[:, None] + .5 * a * dt[:, None] ** 2
    rn = np.linalg.norm(xn, axis=1)
    an = -1.5 * hs[:, None] * xn / rn[:, None] ** 5
    vn = vs + .5 * (a + an) * dt[:, None]
    # crossing the disk plane (y = 0)?
    cr = (xs[:, 1] * xn[:, 1] < 0)
    if cr.any():
        k = np.where(cr)[0]; f = xs[k, 1] / (xs[k, 1] - xn[k, 1]); p = xs[k] + (xn[k] - xs[k]) * f[:, None]
        rp = np.hypot(p[:, 0], p[:, 2]); ok = (rp > RIN) & (rp < ROUT) & (cnt[idx[k]] < 2)
        for kk, pp, rr in zip(k[ok], p[ok], rp[ok]):
            g = idx[kk]; c = cnt[g]; hit[c, g] = (rr, np.arctan2(pp[2], pp[0]), 1.0); cnt[g] = c + 1
    x[idx], vel[idx] = xn, vn
    esc = (rn > 60) & (np.sum(xn * vn, axis=1) > 0); fell = rn < 1.0
    fate[idx[esc]] = 1; fate[idx[fell]] = 2
    idx = idx[~(esc | fell)]; step += 1
    if step % 200 == 0: print(f'step {step}: {idx.size} rays still flying ({time.time() - t0:.0f}s)', flush=True)
fate[idx] = 1
dirn = vel / np.linalg.norm(vel, axis=1, keepdims=True)
np.savez_compressed(out, W=W, H=H, hit=hit.reshape(2, H, W, 3), fate=fate.reshape(H, W), dir=dirn.reshape(H, W, 3).astype(np.float32))
print('traced in', round(time.time() - t0), 's')
