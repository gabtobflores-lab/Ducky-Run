# Original aurora scene for Mirror Drop, rendered with Blender Cycles.
# Glowing volumetric curtains: folded sheets of light, fine vertical rays, colour by height, a dark star field.
import bpy, math, sys, os
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
W, H, SPP, OUT, PH = int(argv[0]), int(argv[1]), int(argv[2]), argv[3], float(argv[4]) if len(argv) > 4 else 0.0

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
sc.cycles.samples = SPP; sc.cycles.use_denoising = True
sc.cycles.volume_step_rate = 0.5; sc.cycles.volume_max_steps = 256
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = OUT
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
sc.view_settings.exposure = 0.0

# camera on the ground looking up and ahead
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0, 0, 0); cam.rotation_euler = (math.radians(100), 0, 0)
cam.data.lens = 22; cam.data.sensor_fit = 'VERTICAL'

# night sky: near-black navy overhead, a little violet low down, faint stars
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
wn = world.node_tree.nodes; wl = world.node_tree.links; wn.clear()
wo = wn.new('ShaderNodeOutputWorld'); bg = wn.new('ShaderNodeBackground')
tc = wn.new('ShaderNodeTexCoord'); sep = wn.new('ShaderNodeSeparateXYZ'); ramp = wn.new('ShaderNodeValToRGB')
wl.new(tc.outputs['Generated'], sep.inputs[0]); wl.new(sep.outputs['Z'], ramp.inputs[0])
ramp.color_ramp.elements[0].position = 0.42; ramp.color_ramp.elements[0].color = (0.016, 0.01, 0.06, 1)
ramp.color_ramp.elements[1].position = 0.72; ramp.color_ramp.elements[1].color = (0.0002, 0.0003, 0.001, 1)
stars = wn.new('ShaderNodeTexVoronoi'); stars.inputs['Scale'].default_value = 900
srmp = wn.new('ShaderNodeValToRGB'); wl.new(tc.outputs['Generated'], stars.inputs['Vector']); wl.new(stars.outputs['Distance'], srmp.inputs[0])
srmp.color_ramp.elements[0].position = 0.0; srmp.color_ramp.elements[0].color = (0.6, 0.65, 0.8, 1)
srmp.color_ramp.elements[1].position = 0.035; srmp.color_ramp.elements[1].color = (0, 0, 0, 1)
add = wn.new('ShaderNodeMixRGB'); add.blend_type = 'ADD'; add.inputs[0].default_value = 1
wl.new(ramp.outputs['Color'], add.inputs[1]); wl.new(srmp.outputs['Color'], add.inputs[2])
wl.new(add.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 1
wl.new(bg.outputs[0], wo.inputs['Surface'])

# the aurora: one big volume, its glow computed per point by a node network
bpy.ops.mesh.primitive_cube_add(size=1); dom = bpy.context.active_object
dom.scale = (60, 60, 44); dom.location = (0, 20, 4)
mat = bpy.data.materials.new('aurora'); mat.use_nodes = True; dom.data.materials.append(mat)
N = mat.node_tree.nodes; L = mat.node_tree.links; N.clear()
out = N.new('ShaderNodeOutputMaterial')
geo = N.new('ShaderNodeNewGeometry')            # world position
xyz = N.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Position'], xyz.inputs[0])
def m(op, a, b=None, v=None):
    n = N.new('ShaderNodeMath'); n.operation = op
    for i, x in enumerate([a, b]):
        if x is None: continue
        if isinstance(x, (int, float)): n.inputs[i].default_value = x
        else: L.new(x, n.inputs[i])
    if v is not None: n.inputs[1].default_value = v
    return n.outputs[0]
def noise(vec, scale, detail=4, rough=0.5):
    n = N.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = detail; n.inputs['Roughness'].default_value = rough
    L.new(vec, n.inputs['Vector']); return n.outputs['Fac']
def comb(x, y, z):
    c = N.new('ShaderNodeCombineXYZ')
    for i, v in enumerate([x, y, z]):
        if isinstance(v, (int, float)): c.inputs[i].default_value = v
        else: L.new(v, c.inputs[i])
    return c.outputs[0]
X0, Y, Z = xyz.outputs['X'], xyz.outputs['Y'], xyz.outputs['Z']
# smoke-like flow: the light's horizontal position is pushed around by two layers of flowing noise that change with height,
# so streaks curl, bend and break into irregular clumps instead of running straight
_w1 = noise(comb(m('MULTIPLY', X0, 0.12), m('MULTIPLY', Z, 0.07), 3.0 + math.sin(PH * 2 * math.pi) * 0.3), 1.0, 3, 0.5)
_w2 = noise(comb(m('MULTIPLY', X0, 0.35), m('MULTIPLY', Z, 0.16), 7.0 + math.cos(PH * 2 * math.pi) * 0.3), 1.0, 3, 0.5)
X = m('ADD', X0, m('ADD', m('MULTIPLY', m('SUBTRACT', _w1, 0.5), 2.6), m('MULTIPLY', m('SUBTRACT', _w2, 0.5), 0.9)))
t = PH * 2 * math.pi
total = None; colsum = None
for k, (y0, z0, amp, fr, br, wid) in enumerate([(8.0, -0.2, 4.0, 0.16, 1.0, 0.75), (12.0, 4.5, 5.0, 0.12, 1.1, 0.7), (8.5, -2.0, 3.0, 0.1, 1.0, 0.45)]):
    s = k * 3.7 + 1
    # the curtain hangs along a folded path: y = y0 + folds(x)
    fold1 = m('MULTIPLY', m('SINE', m('ADD', m('MULTIPLY', X, fr), s + math.sin(t) * 0.5)), amp)
    fold2 = m('MULTIPLY', m('SINE', m('ADD', m('MULTIPLY', X, fr * 2.3), -s * 2 + math.cos(t) * 0.6)), amp * 0.35)
    warp = m('MULTIPLY', m('SUBTRACT', noise(comb(m('MULTIPLY', X, 0.05), s, math.sin(t) * 0.3), 1.0), 0.5), amp * 1.2)
    path = m('ADD', m('ADD', m('ADD', fold1, fold2), warp), y0 + 0.25 * 0)
    dy = m('SUBTRACT', Y, path)
    sheet = m('EXPONENT', m('MULTIPLY', m('POWER', m('ABSOLUTE', dy), 2.0), -1.0 / (wid * wid)))
    # height above the lower edge: soft fade in, long fade upward
    h = m('SUBTRACT', Z, m('ADD', z0, m('MULTIPLY', m('SUBTRACT', noise(comb(m('MULTIPLY', X, 0.12), s + 5, 0), 1.0), 0.5), 3.5)))
    edge = m('SMOOTH_MIN', m('MAXIMUM', m('ADD', m('MULTIPLY', h, 0.18), 1.0), 0.0), 1.0, 1.2)
    up = m('EXPONENT', m('MULTIPLY', m('MAXIMUM', h, 0.0), -1.0 / ([5.5, 4.5, 2.5][k])))
    # fine vertical rays: noise stretched tall along the curtain
    rays = noise(comb(m('MULTIPLY', m('ADD', X, m('MULTIPLY', Z, -0.08)), 2.2), m('MULTIPLY', dy, 0.5), m('MULTIPLY', Z, 0.04)), 1.0, 8, 0.6)
    rays = m('POWER', m('MAXIMUM', m('SUBTRACT', m('MULTIPLY', rays, 2.6), 0.78), 0.0), 2.2)
    # some stretches flare, others fade
    flare = m('POWER', m('MAXIMUM', m('SUBTRACT', m('MULTIPLY', noise(comb(m('MULTIPLY', X, 0.045), s + 9 + math.cos(t) * 0.2, math.sin(t) * 0.2), 1.0), 2.6), 0.95), 0.0), 1.5)
    lean = m('ADD', m('ADD', X, m('MULTIPLY', Z, [-0.09, -0.05, -0.04][k])), [1.15 - 0.3 * math.sin(t), -1.3 + 0.2 * math.cos(t), 2.05][k])
    mass = m('EXPONENT', m('MULTIPLY', m('POWER', m('DIVIDE', lean, [0.8, 0.5, 0.3][k]), 2.0), -1.0))
    if k == 0: mass = m('MULTIPLY', mass, m('ADD', 0.45, m('MULTIPLY', 1.8, m('EXPONENT', m('MULTIPLY', m('POWER', m('DIVIDE', m('SUBTRACT', Z, 2.4), 2.2), 2.0), -1.0)))))
    clump = m('ADD', 0.35, m('MULTIPLY', m('POWER', noise(comb(m('MULTIPLY', X, 0.55), m('MULTIPLY', Z, 0.28), s + math.sin(t) * 0.4), 1.0, 3, 0.5), 3.2), 5.0))
    dens = m('MULTIPLY', clump, m('MULTIPLY', m('MULTIPLY', m('MULTIPLY', m('MULTIPLY', sheet, edge), up), m('ADD', rays, 0.035)), m('MULTIPLY', m('ADD', m('MULTIPLY', mass, 2.2), m('MULTIPLY', flare, 0.04)), br)))
    total = dens if total is None else m('ADD', total, dens)
    hk = h if k == 0 else hk
# colour by height above the main curtain's edge: cyan-white low, cyan, blue, deep teal high
cr = N.new('ShaderNodeValToRGB'); L.new(m('DIVIDE', m('ADD', hk, 2.5), 11.5), cr.inputs[0])
els = cr.color_ramp.elements; els[0].position = 0.0; els[0].color = (0.16, 0.12, 0.85, 1); els[1].position = 0.12; els[1].color = (0.04, 0.3, 1.0, 1)
e = els.new(0.26); e.color = (0.0, 0.95, 1.0, 1); e = els.new(0.38); e.color = (0.0, 0.85, 1.0, 1)
e = els.new(0.62); e.color = (0.02, 0.45, 1.0, 1); e = els.new(1.0); e.color = (0.0, 0.55, 0.5, 1)
em = N.new('ShaderNodeEmission'); L.new(cr.outputs['Color'], em.inputs['Color']); L.new(m('MULTIPLY', total, 0.85), em.inputs['Strength'])
L.new(em.outputs[0], out.inputs['Volume'])

# a soft glow around the brightest light, as a lens sees it
sc.use_nodes = True; ct = sc.node_tree; ct.nodes.clear()
rl = ct.nodes.new('CompositorNodeRLayers'); gl = ct.nodes.new('CompositorNodeGlare'); co = ct.nodes.new('CompositorNodeComposite')
gl.glare_type = 'FOG_GLOW'; gl.quality = 'HIGH'; gl.size = 9; gl.mix = -0.3; gl.threshold = 0.35
bl = ct.nodes.new('CompositorNodeBlur'); bl.filter_type = 'GAUSS'; bl.use_relative = True; bl.factor_x = 0.03; bl.factor_y = 0.022
mx = ct.nodes.new('CompositorNodeMixRGB'); mx.inputs[0].default_value = 0.85
ct.links.new(rl.outputs['Image'], bl.inputs['Image']); ct.links.new(rl.outputs['Image'], mx.inputs[1]); ct.links.new(bl.outputs['Image'], mx.inputs[2])
ct.links.new(mx.outputs['Image'], gl.inputs['Image']); hs = ct.nodes.new('CompositorNodeHueSat'); hs.inputs['Saturation'].default_value = 1.15
ct.links.new(gl.outputs['Image'], hs.inputs['Image']); ct.links.new(hs.outputs['Image'], co.inputs['Image'])
bpy.ops.render.render(write_still=True)
