/* ============================================================
   audio.js — tiny original WebAudio synth (SFX + chiptune music)
   No samples, no external assets: every sound is generated here.
   ============================================================ */
(function (DR) {
  'use strict';

  var A = DR.audio = {};
  var ctx = null, master = null, musicGain = null, sfxGain = null;
  var ready = false, muted = DR.progress.muted;

  A.isMuted = function () { return muted; };

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.85; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.34; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.72; sfxGain.connect(master);
    ready = true;
    return ctx;
  }

  /** Must be called from a user gesture on mobile browsers. */
  A.unlock = function () {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  };

  A.setMuted = function (m) {
    muted = !!m;
    DR.progress.muted = muted; DR.saveProgress();
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.85, ctx.currentTime, 0.02);
  };
  A.toggleMute = function () { A.setMuted(!muted); return muted; };

  var noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s;
  }

  /* ---------- primitive voices ---------- */
  function tone(o) {
    if (!ready) return;
    var t0 = o.t !== undefined ? o.t : ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2 !== undefined) {
      if (o.slide === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t0 + o.d);
      else osc.frequency.linearRampToValueAtTime(o.f2, t0 + o.d);
    }
    var vol = o.v === undefined ? 0.3 : o.v;
    var atk = o.a === undefined ? 0.006 : o.a;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
    var node = osc;
    if (o.filter) {
      var bq = ctx.createBiquadFilter();
      bq.type = o.filter; bq.frequency.setValueAtTime(o.fc || 1200, t0);
      if (o.fc2) bq.frequency.linearRampToValueAtTime(o.fc2, t0 + o.d);
      bq.Q.value = o.q || 1;
      node.connect(bq); bq.connect(g);
    } else node.connect(g);
    g.connect(o.bus || sfxGain);
    osc.start(t0); osc.stop(t0 + o.d + 0.04);
  }

  function hit(o) {
    if (!ready) return;
    var t0 = o.t !== undefined ? o.t : ctx.currentTime;
    var s = noise();
    var bq = ctx.createBiquadFilter();
    bq.type = o.filter || 'bandpass';
    bq.frequency.setValueAtTime(o.fc || 1400, t0);
    if (o.fc2) bq.frequency.exponentialRampToValueAtTime(Math.max(40, o.fc2), t0 + o.d);
    bq.Q.value = o.q || 1.1;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.v === undefined ? 0.3 : o.v), t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
    s.connect(bq); bq.connect(g); g.connect(o.bus || sfxGain);
    s.start(t0); s.stop(t0 + o.d + 0.02);
  }

  /* A cartoon "quack": a fast pitch bend through a formant-ish filter. */
  function quack(pitch, vol, dur) {
    if (!ready) return;
    var t0 = ctx.currentTime, d = dur || 0.17;
    var osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pitch * 1.5, t0);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.72, t0 + d);
    var bq = ctx.createBiquadFilter(); bq.type = 'bandpass'; bq.Q.value = 4.5;
    bq.frequency.setValueAtTime(pitch * 4.2, t0);
    bq.frequency.exponentialRampToValueAtTime(pitch * 1.6, t0 + d);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.28, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    osc.connect(bq); bq.connect(g); g.connect(sfxGain);
    osc.start(t0); osc.stop(t0 + d + 0.03);
  }

  /* ---------- SFX library ---------- */
  var lastStep = 0;
  var SFX = {
    step: function () {
      var now = performance.now();
      if (now - lastStep < 90) return; lastStep = now;
      hit({ fc: 720, fc2: 240, d: 0.075, v: 0.085, filter: 'bandpass', q: 1.6 });
    },
    jump: function () {
      tone({ type: 'square', f: 340, f2: 760, d: 0.16, v: 0.16, slide: 'exp' });
      quack(430, 0.16, 0.12);
    },
    doubleJump: function () {
      tone({ type: 'square', f: 520, f2: 1020, d: 0.16, v: 0.16, slide: 'exp' });
    },
    land: function () { hit({ fc: 400, fc2: 120, d: 0.09, v: 0.14 }); },
    lane: function () {
      tone({ type: 'triangle', f: 620, f2: 900, d: 0.09, v: 0.13, slide: 'exp' });
    },
    dash: function () {
      hit({ fc: 240, fc2: 3600, d: 0.2, v: 0.2, filter: 'bandpass', q: 0.8 });
      tone({ type: 'sawtooth', f: 180, f2: 620, d: 0.2, v: 0.12, slide: 'exp', filter: 'lowpass', fc: 900, fc2: 2600 });
    },
    hat: function (n) {
      var scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
      var s = scale[Math.min(n || 0, scale.length - 1)];
      var f = 784 * Math.pow(2, s / 12);
      tone({ type: 'square', f: f, d: 0.08, v: 0.15 });
      tone({ type: 'square', f: f * 2, d: 0.14, v: 0.09, t: ctx.currentTime + 0.035 });
    },
    egg: function () {
      var t = ctx.currentTime;
      [0, 4, 7, 12].forEach(function (s, i) {
        tone({ type: 'triangle', f: 660 * Math.pow(2, s / 12), d: 0.3, v: 0.15, t: t + i * 0.045 });
      });
      hit({ fc: 5200, fc2: 2200, d: 0.24, v: 0.08, filter: 'highpass' });
    },
    power: function () {
      var t = ctx.currentTime;
      [0, 5, 9, 12, 17].forEach(function (s, i) {
        tone({ type: 'square', f: 523 * Math.pow(2, s / 12), d: 0.22, v: 0.14, t: t + i * 0.055 });
      });
    },
    hurt: function () {
      quack(180, 0.34, 0.32);
      tone({ type: 'sawtooth', f: 260, f2: 70, d: 0.38, v: 0.22, slide: 'exp', filter: 'lowpass', fc: 1400, fc2: 300 });
      hit({ fc: 900, fc2: 120, d: 0.3, v: 0.2 });
    },
    shieldBreak: function () {
      hit({ fc: 3800, fc2: 700, d: 0.34, v: 0.24, filter: 'bandpass', q: 0.7 });
      tone({ type: 'triangle', f: 900, f2: 300, d: 0.3, v: 0.16, slide: 'exp' });
    },
    stomp: function () {
      hit({ fc: 320, fc2: 90, d: 0.16, v: 0.26 });
      tone({ type: 'square', f: 200, f2: 520, d: 0.13, v: 0.15, slide: 'exp' });
    },
    kill: function () {
      hit({ fc: 1800, fc2: 300, d: 0.2, v: 0.2 });
      tone({ type: 'square', f: 620, f2: 1400, d: 0.13, v: 0.13, slide: 'exp' });
    },
    bossHit: function () {
      hit({ fc: 1200, fc2: 200, d: 0.3, v: 0.3 });
      tone({ type: 'sawtooth', f: 420, f2: 120, d: 0.3, v: 0.2, slide: 'exp', filter: 'lowpass', fc: 2200, fc2: 500 });
    },
    bossTell: function () {
      tone({ type: 'sawtooth', f: 160, f2: 300, d: 0.4, v: 0.13, filter: 'lowpass', fc: 700, fc2: 1600 });
    },
    bossShoot: function () {
      tone({ type: 'square', f: 900, f2: 260, d: 0.16, v: 0.12, slide: 'exp' });
    },
    honk: function () { quack(150, 0.32, 0.42); },
    bossDie: function () {
      var t = ctx.currentTime;
      for (var i = 0; i < 7; i++) hit({ fc: 1600 - i * 160, fc2: 90, d: 0.42, v: 0.24, t: t + i * 0.11 });
      [0, -5, -12].forEach(function (s, i) {
        tone({ type: 'sawtooth', f: 330 * Math.pow(2, s / 12), f2: 60, d: 0.9, v: 0.18, slide: 'exp', t: t + i * 0.16 });
      });
    },
    menu: function () { tone({ type: 'square', f: 660, d: 0.06, v: 0.11 }); },
    menuBig: function () {
      var t = ctx.currentTime;
      [0, 7, 12].forEach(function (s, i) { tone({ type: 'square', f: 523 * Math.pow(2, s / 12), d: 0.18, v: 0.13, t: t + i * 0.04 }); });
    },
    deny: function () { tone({ type: 'square', f: 200, f2: 130, d: 0.18, v: 0.14, slide: 'exp' }); },
    unlock: function () {
      var t = ctx.currentTime;
      [0, 4, 7, 12, 16, 19, 24].forEach(function (s, i) {
        tone({ type: 'triangle', f: 523 * Math.pow(2, s / 12), d: 0.5, v: 0.14, t: t + i * 0.075 });
      });
    },
    logoWhoosh: function () {
      hit({ fc: 200, fc2: 6000, d: 0.55, v: 0.2, filter: 'bandpass', q: 0.6 });
    },
    logoSlam: function () {
      hit({ fc: 260, fc2: 60, d: 0.5, v: 0.36 });
      tone({ type: 'sawtooth', f: 120, f2: 46, d: 0.6, v: 0.3, slide: 'exp', filter: 'lowpass', fc: 900, fc2: 200 });
    },
    logoChord: function () {
      if (!ready) return;
      var t = ctx.currentTime;
      // Bright original fanfare: D major add9 spread over two octaves.
      [50, 57, 62, 66, 69, 74, 78, 81].forEach(function (m, i) {
        tone({ type: 'triangle', f: 440 * Math.pow(2, (m - 69) / 12), d: 2.4, v: 0.11, a: 0.05, t: t + i * 0.035 });
        tone({ type: 'square', f: 440 * Math.pow(2, (m - 69) / 12), d: 1.6, v: 0.035, a: 0.09, t: t + i * 0.035 });
      });
    },
    win: function () {
      var t = ctx.currentTime;
      var mel = [[0, 0], [4, .12], [7, .24], [12, .36], [11, .5], [12, .6]];
      mel.forEach(function (n) {
        tone({ type: 'square', f: 523 * Math.pow(2, n[0] / 12), d: 0.34, v: 0.17, t: t + n[1] });
        tone({ type: 'triangle', f: 262 * Math.pow(2, n[0] / 12), d: 0.34, v: 0.12, t: t + n[1] });
      });
    },
    lose: function () {
      var t = ctx.currentTime;
      [0, -2, -5, -9].forEach(function (s, i) {
        tone({ type: 'square', f: 440 * Math.pow(2, s / 12), d: 0.44, v: 0.16, t: t + i * 0.19 });
        tone({ type: 'triangle', f: 220 * Math.pow(2, s / 12), d: 0.5, v: 0.12, t: t + i * 0.19 });
      });
      quack(140, 0.3, 0.6);
    },
    countdown: function (last) {
      tone({ type: 'square', f: last ? 880 : 523, d: last ? 0.4 : 0.16, v: 0.18 });
    },
    warn: function () { tone({ type: 'square', f: 1200, f2: 900, d: 0.1, v: 0.1 }); }
  };

  A.play = function (name, arg) {
    if (!ready || muted) return;
    var fn = SFX[name];
    if (fn) { try { fn(arg); } catch (e) { /* never let audio break the game */ } }
  };

  /* ============================================================
     Music — a very small step sequencer.
     Tracks are written as [semitoneOffset|null, durationInBeats].
     ============================================================ */
  var MIN = null;
  var TRACKS = {
    menu: {
      bpm: 124, root: 62, wave: 'square', bass: 'triangle', drums: 'light',
      chords: [0, -3, 5, -5],
      lead: [[7, 1], [9, .5], [7, .5], [4, 1], [0, 1], [4, 1], [7, .5], [9, .5], [11, 1], [12, 1],
             [11, 1], [9, .5], [7, .5], [4, 1], [7, 1], [4, .5], [2, .5], [0, 2]]
    },
    pond: {
      bpm: 148, root: 64, wave: 'square', bass: 'triangle', drums: 'run',
      chords: [0, 5, -3, -5],
      lead: [[0, .5], [4, .5], [7, .5], [12, .5], [11, 1], [7, 1], [9, .5], [7, .5], [4, .5], [0, .5], [2, 1],
             [4, .5], [7, .5], [9, .5], [11, .5], [12, 1], [16, 1], [14, .5], [12, .5], [9, .5], [7, .5], [4, 1]]
    },
    farm: {
      bpm: 156, root: 65, wave: 'square', bass: 'triangle', drums: 'run',
      chords: [0, -5, 3, -2],
      lead: [[12, .5], [10, .5], [7, .5], [10, .5], [12, 1], [7, 1], [5, .5], [7, .5], [9, .5], [10, .5], [12, 1],
             [15, .5], [14, .5], [12, .5], [10, .5], [9, 1], [7, 1], [5, .5], [3, .5], [5, .5], [7, .5], [10, 1]]
    },
    bath: {
      bpm: 162, root: 67, wave: 'square', bass: 'triangle', drums: 'run',
      chords: [0, 4, -3, -1],
      lead: [[0, .5], [7, .5], [12, .5], [7, .5], [9, .5], [14, .5], [12, 1], [7, .5], [4, .5], [0, 1],
             [2, .5], [4, .5], [7, .5], [11, .5], [12, 1], [11, .5], [9, .5], [7, .5], [4, .5], [2, 1], [0, 1]]
    },
    storm: {
      bpm: 168, root: 61, wave: 'sawtooth', bass: 'triangle', drums: 'heavy',
      chords: [0, -2, -4, -5],
      lead: [[0, .5], [3, .5], [7, .5], [10, .5], [12, 1], [10, .5], [7, .5], [3, 1],
             [5, .5], [8, .5], [12, .5], [15, .5], [14, 1], [12, .5], [10, .5], [7, 1],
             [0, .5], [3, .5], [7, .5], [3, .5], [0, 2]]
    },
    nest: {
      bpm: 174, root: 69, wave: 'square', bass: 'triangle', drums: 'heavy',
      chords: [0, 5, 7, 3],
      lead: [[12, .5], [11, .5], [12, .5], [16, .5], [19, 1], [16, .5], [12, .5], [14, 1],
             [16, .5], [19, .5], [21, .5], [23, .5], [24, 1.5], [19, .5], [16, .5], [12, .5], [16, 1],
             [19, .5], [16, .5], [12, 1]]
    },
    boss: {
      bpm: 172, root: 57, wave: 'sawtooth', bass: 'sawtooth', drums: 'heavy',
      chords: [0, 0, -1, -1],
      lead: [[0, .25], [0, .25], [12, .5], [11, .25], [12, .25], [11, .5], [8, .5], [7, .5],
             [0, .25], [0, .25], [12, .5], [15, .25], [14, .25], [12, .5], [8, .5], [5, .5],
             [3, .5], [5, .5], [7, .5], [8, .5], [7, .5], [5, .5], [3, .5], [0, .5]]
    }
  };

  var cur = null, timer = null, nextT = 0, step = 0, curName = '';
  var LOOKAHEAD = 0.12;

  function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function schedule() {
    if (!ready || !cur) return;
    var spb = 60 / cur.bpm;
    while (nextT < ctx.currentTime + LOOKAHEAD) {
      var t = Math.max(nextT, ctx.currentTime + 0.005);
      var beat = step * 0.25;                       // sequencer runs on 16ths
      var bar = Math.floor(beat / 4) % cur.chords.length;
      var chord = cur.chords[bar];

      // bass: root on every beat, fifth on the off-beat
      if (step % 4 === 0) {
        tone({ type: cur.bass, f: midi(cur.root - 24 + chord), d: spb * 0.9, v: 0.17, t: t, bus: musicGain, filter: 'lowpass', fc: 900 });
      } else if (step % 4 === 2) {
        tone({ type: cur.bass, f: midi(cur.root - 24 + chord + 7), d: spb * 0.5, v: 0.11, t: t, bus: musicGain, filter: 'lowpass', fc: 900 });
      }

      // drums
      var d = cur.drums;
      if (d !== 'off') {
        if (step % 8 === 0) hit({ fc: 180, fc2: 55, d: 0.14, v: d === 'heavy' ? 0.3 : 0.2, t: t, bus: musicGain });
        if (step % 8 === 4) hit({ fc: 1500, fc2: 700, d: 0.13, v: d === 'light' ? 0.11 : 0.17, t: t, bus: musicGain, filter: 'bandpass', q: 0.8 });
        if (d !== 'light' && step % 2 === 0) hit({ fc: 7000, d: 0.03, v: 0.05, t: t, bus: musicGain, filter: 'highpass' });
        if (d === 'heavy' && step % 16 === 14) hit({ fc: 2600, fc2: 900, d: 0.1, v: 0.14, t: t, bus: musicGain, filter: 'bandpass' });
      }

      // lead melody
      if (cur.leadIdx === undefined) { cur.leadIdx = 0; cur.leadBeat = 0; }
      if (Math.abs(beat - cur.leadBeat) < 1e-6) {
        var note = cur.lead[cur.leadIdx % cur.lead.length];
        if (note[0] !== MIN) {
          var f = midi(cur.root + note[0] + chord);
          tone({ type: cur.wave, f: f, d: Math.min(note[1] * spb * 0.92, 0.7), v: 0.13, t: t, bus: musicGain });
          tone({ type: 'triangle', f: f * 2, d: Math.min(note[1] * spb * 0.5, 0.3), v: 0.045, t: t, bus: musicGain });
        }
        cur.leadBeat += note[1];
        cur.leadIdx++;
        if (cur.leadIdx % cur.lead.length === 0) {
          // keep the melody phrase aligned to the 4-bar chord cycle
          var barLen = cur.chords.length * 4;
          cur.leadBeat = Math.ceil(cur.leadBeat / barLen) * barLen;
        }
      }

      nextT += spb * 0.25;
      step++;
      if (step > 100000) step = 0;
    }
  }

  A.music = function (name) {
    ensure();
    if (!ready) return;
    if (curName === name) return;
    curName = name;
    A.stopMusic(true);
    var t = TRACKS[name];
    if (!t) return;
    cur = Object.create(t);
    cur.leadIdx = 0; cur.leadBeat = 0;
    step = 0;
    nextT = ctx.currentTime + 0.08;
    if (musicGain) {
      musicGain.gain.cancelScheduledValues(ctx.currentTime);
      musicGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      musicGain.gain.linearRampToValueAtTime(0.34, ctx.currentTime + 0.5);
    }
    timer = setInterval(schedule, 25);
    schedule();
  };

  A.stopMusic = function (immediate) {
    curName = immediate === true ? curName : '';
    if (timer) { clearInterval(timer); timer = null; }
    cur = null;
    if (musicGain && ctx) {
      musicGain.gain.cancelScheduledValues(ctx.currentTime);
      musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
      musicGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    }
  };

  A.duck = function (on) {   // lower music under fanfares / pauses
    if (!ready || !musicGain) return;
    musicGain.gain.setTargetAtTime(on ? 0.09 : 0.34, ctx.currentTime, 0.08);
  };

})(window.DR);
