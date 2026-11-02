# Builds a test copy of the game with an event picker, for trying events on purpose.
# It is never shipped: the App Store build and the web release are made from mirror.html untouched.
# Usage: python3 tools/build-eventlab.py out.html [--page]
#   --page  strips the document wrapper (<!doctype>, <html>, <head>, <body>) so the file can be published as a page whose host adds its own
import sys, re
src = open('mirror.html').read()
out = sys.argv[1]
page = '--page' in sys.argv

s = src.replace('<title>Mirror Drop</title>', '<title>Mirror Drop Event Lab</title>', 1)
# everything unlocked, so every event, mode and difficulty can be tried
s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<script>try { localStorage.mirrorEnt = "4"; } catch (e) {}</script>', 1)

LAB = r'''
<style>
  #lab{position:fixed;right:max(14px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));z-index:50;font:600 14px -apple-system,system-ui,sans-serif}
  #labbtn{height:40px;padding:0 16px;border-radius:20px;border:1px solid rgba(255,255,255,.55);color:#fff;cursor:pointer;
    background:linear-gradient(180deg,rgba(40,42,62,.62),rgba(28,30,44,.72));-webkit-backdrop-filter:blur(18px) saturate(180%);backdrop-filter:blur(18px) saturate(180%);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 6px 18px rgba(0,0,0,.25);text-shadow:0 1px 2px rgba(0,0,0,.35)}
  #labsheet{position:absolute;right:0;bottom:50px;width:min(300px,calc(100vw - 28px));padding:14px;border-radius:22px;display:none;
    background:rgba(28,30,44,.72);-webkit-backdrop-filter:blur(26px) saturate(180%);backdrop-filter:blur(26px) saturate(180%);border:1px solid rgba(255,255,255,.2);box-shadow:0 18px 40px rgba(0,0,0,.35);color:#f2f3f7}
  #labsheet.on{display:block}
  #labsheet h3{margin:0 0 4px;font-size:15px}
  #labsheet p{margin:0 0 10px;font-weight:500;font-size:12px;color:rgba(242,243,247,.7);line-height:1.35}
  #labgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  #labgrid button,#labrow button{min-height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.1);color:#f2f3f7;font:600 13px -apple-system,system-ui,sans-serif;cursor:pointer;text-align:left;padding:0 12px}
  #labgrid button.on{background:rgba(120,200,255,.35);border-color:rgba(160,220,255,.7)}
  #labgrid button small{display:block;font-weight:500;font-size:10px;color:rgba(242,243,247,.6)}
  #labrow{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
  #labrow button{text-align:center}
  #labnow{margin-top:10px;font-weight:500;font-size:12px;color:rgba(242,243,247,.75)}
</style>
<div id="lab"><div id="labsheet" role="dialog" aria-label="Event Lab"><h3>Event Lab</h3><p>Pick an event to start it now. A run starts if you are on the menu. This is a test copy of the game; everything is unlocked.</p>
  <div id="labgrid"></div><div id="labrow"><button type="button" id="labstop">End event</button><button type="button" id="labrand">Random: on</button></div><div id="labnow"></div></div>
  <button type="button" id="labbtn" aria-expanded="false">Events</button></div>
<script>
(() => {
  const NAMES = { fog: 'Fog', rain: 'Rain', storm: 'Storm', wind: 'Wind', snow: 'Snow', hail: 'Hail', heat: 'Heat Wave', sun: 'Sun Flash', meteor: 'Meteor Shower', aurora: 'Aurora', bhole: 'Black Hole', alien: 'Alien Invasion' };
  const PLAY = { rain: 'more blocks or faster', storm: 'lightning', wind: 'pushes the balls', snow: 'slower blocks', alien: 'warps and the beam', fog: 'harder to see' };
  try { ent = 4; } catch (e) {}
  let random = true; const grid = document.getElementById('labgrid'), sheet = document.getElementById('labsheet'), btn = document.getElementById('labbtn'), now = document.getElementById('labnow');
  Object.keys(WX).forEach(k => { const b = document.createElement('button'); b.type = 'button'; b.dataset.k = k; b.innerHTML = (NAMES[k] || k) + (PLAY[k] ? '<small>' + PLAY[k] + '</small>' : '<small>visual</small>'); grid.appendChild(b); });
  const start = k => {
    if (state !== 'play') { if (state === 'paused') return; startGame(); if (state !== 'play') return; }
    wx.kind = k; wx.phase = 'warn'; wx.t = 0; wx.p = 0; wx.a = 0; wx.cool = 999; wx.roll = 0;
    if (k === 'wind') windDir = Math.random() < .5 ? -1 : 1; if (k === 'rain') wx.rv = Math.random() < .5 ? 'fast' : 'dense'; wxNote(k);
    sheet.classList.remove('on'); btn.setAttribute('aria-expanded', 'false'); };
  grid.addEventListener('click', e => { const b = e.target.closest('button'); if (b) start(b.dataset.k); });
  document.getElementById('labstop').addEventListener('click', () => { if (wx.kind && wx.phase !== 'out') { wx.phase = 'out'; wx.t = 0; } });
  document.getElementById('labrand').addEventListener('click', e => { random = !random; e.target.textContent = 'Random: ' + (random ? 'on' : 'off'); });
  btn.addEventListener('click', () => { const on = !sheet.classList.contains('on'); sheet.classList.toggle('on', on); btn.setAttribute('aria-expanded', on); });
  setInterval(() => { if (!random && !wx.kind) wx.cool = 999; // with random events off, only the ones you pick happen
    grid.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === wx.kind));
    now.textContent = wx.kind ? (NAMES[wx.kind] || wx.kind) + ' · ' + ({ warn: 'arriving', on: 'on', out: 'leaving' }[wx.phase] || '') + (mode === 'zen' ? ' · Zen: visual only' : '') : 'No event' + (mode === 'zen' ? ' · Zen: visual only' : ''); }, 250);
})();
</script>
'''
s = s.replace('</body>', LAB + '\n</body>', 1)
if page:
    s = re.sub(r'<!doctype html>\s*', '', s, count=1, flags=re.I)
    for tag in ('<html lang="en">', '<head>', '</head>', '<body>', '</body>', '</html>'):
        s = s.replace(tag, '', 1)
    s = s.replace('<meta charset="utf-8">', '', 1)
open(out, 'w').write(s)
print('wrote', out)
