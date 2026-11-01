# Bakes the traced light paths (trace.py) into two small RGBA lookup textures for the game's live black-hole shader:
#   A: r of the first disk crossing (0..1 over RIN..ROUT), cos and sin of its angle, and whether it hit (1) / fell in (0.5 marks the shadow)
#   B: the same for the second crossing (the far side of the disk, lensed over and under the hole)
# The shader animates everything (rotation, swirling detail, Doppler, colour) live; these maps only say where each pixel's light comes from.
# Usage: python3 bake_map.py trace.npz outA.png outB.png
import numpy as np, sys, os
from PIL import Image
D = np.load(sys.argv[1]); RIN, ROUT = 2.6, float(os.environ.get('ROUT', 10.0))
hit, fate = D['hit'], D['fate']
for c, out in ((0, sys.argv[2]), (1, sys.argv[3])):
    h = hit[c]; m = h[..., 2] > 0
    r = np.where(m, np.clip((h[..., 0] - RIN) / (ROUT - RIN), 0, 1), 0)
    cs = np.where(m, np.cos(h[..., 1]) * .5 + .5, .5); sn = np.where(m, np.sin(h[..., 1]) * .5 + .5, .5)
    a = np.where(m, 1.0, np.where(fate == 2, .5, 0.0))
    Image.fromarray((np.stack([r, cs, sn, a], -1) * 255 + .5).astype(np.uint8), 'RGBA').save(out, optimize=True)
