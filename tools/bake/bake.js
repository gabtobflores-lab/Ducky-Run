// Offline renderer for the events' scenery layers. Runs a (slow, high-quality) GLSL scene in headless Chromium tile by tile,
// and saves the result as a PNG with transparency. The game ships the result as image layers and animates everything else live.
// Usage: node tools/bake/bake.js scene.glsl out.png width height [variant] [ss]
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [src, out, W, H, variant = '0', ss = '2'] = process.argv.slice(2);
  const frag = fs.readFileSync(src, 'utf8');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); p.on('console', m => console.log('page:', m.text()));
  await p.setContent('<canvas id=c></canvas>');
  const ok = await p.evaluate(([frag, W, H, variant, ss]) => {
    const c = document.getElementById('c'); c.width = W; c.height = H;
    const gl = c.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, alpha: true, antialias: false });
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, 'precision highp float;uniform vec2 res;uniform float variant;uniform float SS;\n' + frag)); gl.linkProgram(pr); gl.useProgram(pr);
    const bf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(gl.getUniformLocation(pr, 'res'), W, H); gl.uniform1f(gl.getUniformLocation(pr, 'variant'), variant); gl.uniform1f(gl.getUniformLocation(pr, 'SS'), ss);
    gl.viewport(0, 0, W, H); gl.enable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    window.__gl = gl; window.__WH = [W, H]; return true; }, [frag, +W, +H, +variant, +ss]);
  const T = 128; let n = 0; const tot = Math.ceil(W / T) * Math.ceil(H / T);
  for (let y = 0; y < +H; y += T) for (let x = 0; x < +W; x += T) {
    await p.evaluate(([x, y, T]) => { const gl = window.__gl; gl.scissor(x, y, T, T); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish(); }, [x, y, T]);
    if (++n % 40 === 0) console.log(`tile ${n}/${tot}`); }
  const data = await p.evaluate(() => document.getElementById('c').toDataURL('image/png'));
  fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64')); console.log('wrote', out); await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
