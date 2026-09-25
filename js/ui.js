/* ============================================================
   ui.js — DOM chrome: menus, HUD, cards, toasts
   ============================================================ */
(function (DR) {
  'use strict';
  var U = DR.util;
  var UI = DR.ui = {};

  var $ = function (id) { return document.getElementById(id); };
  var el = {};
  var current = 'none';

  UI.init = function () {
    ['hud', 'lives', 'abilityChip', 'scoreVal', 'distVal', 'hatVal', 'eggVal',
      'progressWrap', 'progressFill', 'progressDuck', 'bossBar', 'bossName', 'bossFill', 'bossFlash',
      'powerStrip', 'toast', 'touch', 'pauseBtn', 'levelGrid', 'duckGrid',
      'mTotalHats', 'mTotalEggs', 'pauseStats', 'goStats', 'lcStats', 'unlockList',
      'completeTitle', 'fader'].forEach(function (id) { el[id] = $(id); });

    document.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-go]') : null;
      if (!b) return;
      DR.audio.unlock();
      DR.audio.play(b.classList.contains('btn-primary') ? 'menuBig' : 'menu');
      UI.action(b.getAttribute('data-go'), b);
    });

    document.addEventListener('mouseover', function (ev) {
      var b = ev.target.closest ? ev.target.closest('.btn,.card') : null;
      if (b && !b.classList.contains('locked') && b !== el._lastHover) {
        el._lastHover = b;
        DR.audio.play('menu');
      }
    });

    DR.input.attachButtons($('touch'));
    DR.input.attachTouch($('stage'));
    $('pauseBtn').addEventListener('click', function () { DR.game.togglePause(); });

    if (DR.input.touchDevice) $('touch').classList.remove('hidden');
  };

  UI.action = function (a, btn) {
    switch (a) {
      case 'play': UI.show('levels'); break;
      case 'levels': UI.show('levels'); break;
      case 'ducks': UI.show('ducks'); break;
      case 'help': UI.show('help'); break;
      case 'menu': UI.show('menu'); break;
      case 'resume': DR.game.togglePause(); break;
      case 'restart': DR.game.restart(); break;
      case 'quit': DR.game.quitToMenu(); break;
      case 'next': DR.game.nextLevel(); break;
      case 'mute': {
        var m = DR.audio.toggleMute();
        if (btn) btn.textContent = 'AUDIO: ' + (m ? 'OFF' : 'ON');
        break;
      }
    }
  };

  /* ---------------- screens ---------------- */
  UI.show = function (name) {
    current = name;
    ['menu', 'levels', 'ducks', 'help', 'pause', 'gameover', 'complete'].forEach(function (n) {
      var s = $('scr-' + n);
      if (s) s.classList.toggle('active', n === name);
    });
    if (name === 'menu') UI.refreshMenu();
    if (name === 'levels') UI.buildLevels();
    if (name === 'ducks') UI.buildDucks();
    if (name === 'pause') {
      var mb = document.querySelector('#scr-pause [data-go="mute"]');
      if (mb) mb.textContent = 'AUDIO: ' + (DR.audio.isMuted() ? 'OFF' : 'ON');
    }
  };
  UI.current = function () { return current; };
  UI.hideAll = function () { UI.show('none'); };

  UI.setHudVisible = function (v) {
    el.hud.classList.toggle('hidden', !v);
    el.pauseBtn.classList.toggle('hidden', !v);
    el.pauseBtn.classList.toggle('show', v);
  };

  UI.fade = function (on) { el.fader.classList.toggle('on', !!on); };

  /* ---------------- menu ---------------- */
  UI.refreshMenu = function () {
    el.mTotalHats.textContent = U.fmt(DR.progress.totalHats);
    el.mTotalEggs.textContent = U.fmt(DR.progress.totalEggs);
  };

  /* ---------------- level cards ---------------- */
  UI.buildLevels = function () {
    var grid = el.levelGrid;
    grid.innerHTML = '';

    if (DR.progress.unlockedLevels > 1) {
      var ec = document.createElement('button');
      ec.type = 'button';
      ec.className = 'card card-endless';
      var ecv = document.createElement('canvas');
      ecv.width = 260; ecv.height = 96;
      drawEndlessThumb(ecv);
      ec.appendChild(ecv);
      ec.insertAdjacentHTML('beforeend',
        '<h3>∞ ENDLESS RUN</h3>' +
        '<div class="sub">Every zone, every boss, no finish line. One run — how far can you get?</div>' +
        '<div class="abil"><b>BEST</b> ' + U.fmt(DR.progress.endlessDist) + ' m &nbsp;·&nbsp; ' +
        U.fmt(DR.progress.endlessScore) + ' pts</div>' +
        '<div class="badge">NEW</div>');
      ec.addEventListener('click', function () { DR.game.startEndless(); });
      grid.appendChild(ec);
    }

    DR.LEVELS.forEach(function (lvl) {
      var unlocked = lvl.id <= DR.progress.unlockedLevels;
      var card = document.createElement('button');
      card.className = 'card' + (unlocked ? '' : ' locked');
      card.type = 'button';

      var cv = document.createElement('canvas');
      cv.width = 260; cv.height = 96;
      drawLevelThumb(cv, lvl, unlocked);
      card.appendChild(cv);

      var best = DR.progress.best[lvl.id];
      card.insertAdjacentHTML('beforeend',
        '<h3>' + lvl.id + '. ' + lvl.name + '</h3>' +
        '<div class="sub">' + lvl.sub + '</div>' +
        (unlocked
          ? '<div class="abil"><b>BOSS</b> ' + DR.BOSSES[lvl.boss].name + '</div>'
          : '<div class="lockmsg">Clear level ' + (lvl.id - 1) + ' to unlock</div>') +
        (best ? '<div class="best">BEST ' + U.fmt(best) + '</div>' : '') +
        (unlocked ? '' : '<div class="lockicon">🔒</div>'));

      if (unlocked) {
        card.addEventListener('click', function () { DR.game.startLevel(lvl.id); });
      } else {
        card.addEventListener('click', function () { DR.audio.play('deny'); });
      }
      grid.appendChild(card);
    });
  };

  function drawEndlessThumb(cv) {
    var c = cv.getContext('2d');
    var g = c.createLinearGradient(0, 0, cv.width, cv.height);
    g.addColorStop(0, '#42256b'); g.addColorStop(.5, '#a8447a'); g.addColorStop(1, '#ff9a5c');
    c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
    for (var i = 0; i < 3; i++) {
      var y = 34 + i * 22;
      c.fillStyle = 'rgba(255,212,71,.85)'; U.roundRect(c, -10, y, cv.width + 20, 8, 3); c.fill();
    }
    c.save(); c.translate(52, 64); c.scale(.6, .6);
    DR.art.duck(c, DR.duckById(DR.progress.duck).look, 0, 0, 1, { run: .3, time: 0 });
    c.restore();
    c.font = '900 46px "Trebuchet MS",Verdana,sans-serif';
    c.textAlign = 'right'; c.fillStyle = 'rgba(255,255,255,.9)';
    c.fillText('∞', cv.width - 18, 66);
  }

  function drawLevelThumb(cv, lvl, unlocked) {
    var c = cv.getContext('2d');
    var th = DR.THEMES[lvl.theme];
    var g = c.createLinearGradient(0, 0, 0, cv.height);
    g.addColorStop(0, th.sky[0]); g.addColorStop(.6, th.sky[1]); g.addColorStop(1, th.sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
    for (var i = 0; i < 3; i++) {
      var y = 34 + i * 22;
      c.fillStyle = th.path; U.roundRect(c, -10, y, cv.width + 20, 9, 3); c.fill();
      c.fillStyle = th.pathTop; c.fillRect(-10, y - 1, cv.width + 20, 2);
    }
    if (!unlocked) { c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 0, cv.width, cv.height); return; }
    c.save(); c.translate(46, 65); c.scale(.62, .62);
    DR.art.duck(c, DR.duckById(DR.progress.duck).look, 0, 0, 1, { run: .2, time: 0 });
    c.restore();
    c.save(); c.translate(210, 58); c.scale(.24, .24);
    DR.art.boss(c, { art: DR.BOSSES[lvl.boss].art, def: DR.BOSSES[lvl.boss] }, 0, 0, 1, 0);
    c.restore();
  }

  /* ---------------- duck cards ---------------- */
  UI.buildDucks = function () {
    var grid = el.duckGrid;
    grid.innerHTML = '';
    DR.DUCKS.forEach(function (d) {
      var unlocked = DR.isDuckUnlocked(d.id);
      var sel = DR.progress.duck === d.id;
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'card' + (unlocked ? '' : ' locked') + (sel ? ' sel' : '');

      var cv = document.createElement('canvas');
      cv.width = 240; cv.height = 130;
      var c = cv.getContext('2d');
      var g = c.createLinearGradient(0, 0, 0, 130);
      g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,.02)');
      c.fillStyle = g; c.fillRect(0, 0, 240, 130);
      c.save(); c.translate(120, 116);
      DR.art.duck(c, d.look, 0, 0, 1.45, { run: .12, time: .4 });
      c.restore();
      card.appendChild(cv);

      card.insertAdjacentHTML('beforeend',
        '<h3>' + d.name + '</h3>' +
        '<div class="sub">' + d.title + '</div>' +
        '<div class="abil"><b>' + d.ability.name + '</b><br>' + d.ability.desc + '</div>' +
        (unlocked ? (sel ? '<div class="badge">EQUIPPED</div>' : '')
          : '<div class="lockmsg">🔒 ' + DR.unlockProgressText(d) + '</div>'));

      if (unlocked) {
        card.addEventListener('click', function () {
          DR.progress.duck = d.id; DR.saveProgress();
          DR.audio.play('menuBig');
          UI.buildDucks();
          UI.refreshLives(DR.game.state && DR.game.state.lives);
        });
      } else {
        card.addEventListener('click', function () { DR.audio.play('deny'); });
      }
      grid.appendChild(card);
    });
  };

  /* ---------------- HUD ---------------- */
  var lifeIcons = [];
  UI.buildLives = function (max) {
    el.lives.innerHTML = '';
    lifeIcons = [];
    var look = DR.duckById(DR.progress.duck).look;
    for (var i = 0; i < max; i++) {
      var cv = document.createElement('canvas');
      cv.width = 60; cv.height = 60;
      cv.className = 'life';
      var c = cv.getContext('2d');
      c.translate(24, 34);
      DR.art.duckHead(c, look, 0, 0, 1.5);
      el.lives.appendChild(cv);
      lifeIcons.push(cv);
    }
  };

  UI.refreshLives = function (n) {
    if (n === undefined) return;
    lifeIcons.forEach(function (cv, i) {
      var spent = i >= n;
      if (!spent && cv.classList.contains('spent')) {
        cv.classList.add('pop');
        setTimeout(function () { cv.classList.remove('pop'); }, 260);
      }
      cv.classList.toggle('spent', spent);
    });
  };

  UI.setProgressDuck = function () {
    var cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    var c = cv.getContext('2d');
    c.translate(24, 36);
    DR.art.duckHead(c, DR.duckById(DR.progress.duck).look, 0, 0, 1.6);
    try { el.progressDuck.style.backgroundImage = 'url(' + cv.toDataURL() + ')'; } catch (e) { }
  };

  var lastScore = -1, lastHats = -1, lastEggs = -1;
  UI.setHud = function (s) {
    if (s.score !== lastScore) {
      el.scoreVal.textContent = U.fmt(s.score);
      if (s.score > lastScore + 1) {
        el.scoreVal.classList.remove('bump');
        void el.scoreVal.offsetWidth;
        el.scoreVal.classList.add('bump');
      }
      lastScore = s.score;
    }
    el.distVal.textContent = Math.floor(s.dist) + ' m';
    if (s.hats !== lastHats) {
      el.hatVal.textContent = s.hats; lastHats = s.hats;
      bumpCounter(el.hatVal.parentNode);
    }
    if (s.eggs !== lastEggs) {
      el.eggVal.textContent = s.eggs; lastEggs = s.eggs;
      bumpCounter(el.eggVal.parentNode);
    }
    var pct = U.clamp(s.progress, 0, 1) * 100;
    el.progressFill.style.width = pct + '%';
    el.progressDuck.style.left = pct + '%';
  };

  function bumpCounter(node) {
    node.classList.remove('tick');
    void node.offsetWidth;
    node.classList.add('tick');
  }

  UI.setAbility = function (d, ready, cdFrac) {
    var chip = el.abilityChip;
    chip.querySelector('.chip-key').textContent = d.ability.key;
    chip.querySelector('.chip-name').textContent = d.ability.name;
    chip.classList.toggle('passive', d.ability.type === 'passive');
    chip.classList.toggle('ready', ready);
    chip.querySelector('.chip-cd i').style.transform = 'scaleX(' + U.clamp(cdFrac, 0, 1) + ')';
  };

  UI.setBoss = function (b) {
    if (!b) { el.bossBar.classList.add('hidden'); return; }
    el.bossBar.classList.remove('hidden');
    el.bossName.textContent = b.name;
    el.bossFill.style.width = (100 * U.clamp(b.hp / b.maxHp, 0, 1)) + '%';
  };
  UI.bossHitFlash = function () {
    el.bossFlash.classList.remove('hit');
    void el.bossFlash.offsetWidth;
    el.bossFlash.classList.add('hit');
  };

  var POWER_LABEL = { shield: 'SHIELD', magnet: 'MAGNET', boost: 'TURBO' };
  UI.setPowers = function (p) {
    var html = '';
    ['shield', 'magnet', 'boost'].forEach(function (k) {
      var v = p[k];
      if (v && v.t > 0) {
        html += '<div class="pw"><span class="ico ico-' + (k === 'boost' ? 'bolt' : k) + '"></span>' +
          POWER_LABEL[k] + '<span class="bar"><i style="width:' + (100 * U.clamp(v.t / v.max, 0, 1)) + '%"></i></span></div>';
      }
    });
    if (el.powerStrip.innerHTML !== html) el.powerStrip.innerHTML = html;
  };

  var toastTimer = null;
  UI.toast = function (text, color) {
    var n = el.toast;
    n.textContent = text;
    n.style.color = color || '#ffd447';
    n.classList.remove('show');
    void n.offsetWidth;
    n.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { n.classList.remove('show'); }, 1600);
  };

  /* ---------------- result screens ---------------- */
  function rows(list) {
    return list.map(function (r) {
      return '<div class="row' + (r[2] ? ' ' + r[2] : '') + '"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
    }).join('');
  }

  UI.showPause = function (s) {
    el.pauseStats.innerHTML =
      '<span>SCORE ' + U.fmt(s.score) + '</span><span>' + Math.floor(s.dist) + ' m</span><span>LIVES ' + s.lives + '</span>';
    UI.show('pause');
  };

  function nextUnlockHtml() {
    var n = DR.nextLockedDuck && DR.nextLockedDuck();
    if (!n) return '';
    return '<div class="carrot"><div class="carrot-top">NEXT DUCK · <b>' + n.duck.name + '</b></div>' +
      '<div class="carrot-bar"><i style="width:' + Math.round(n.frac * 100) + '%"></i></div>' +
      '<div class="carrot-sub">' + DR.unlockProgressText(n.duck) + '</div></div>';
  }

  UI.showGameOver = function (s) {
    var list = [['Distance', Math.floor(s.dist) + ' m']];
    if (s.endless) list.push(['Zone reached', s.zone]);
    list.push(['Propeller hats', s.hats], ['Eggs', s.eggs],
      ['Enemies beaten', s.kills], ['Narrow escapes', s.dodges || 0],
      ['Final score', U.fmt(s.score), 'total']);
    if (s.endless) {
      list.push(['Best distance', U.fmt(s.bestDist) + ' m']);
      if (s.newBest) list.push(['', '★ NEW RECORD ★', 'newbest']);
    }
    el.goStats.innerHTML = rows(list) + nextUnlockHtml();
    UI.show('gameover');
    var b = document.querySelector('#scr-gameover [data-go="restart"]');
    if (b) setTimeout(function () { try { b.focus(); } catch (e) { } }, 60);
  };

  UI.showComplete = function (s, unlocks, isFinal) {
    el.completeTitle.textContent = isFinal ? 'YOU BEAT DUCKY RUN!' : 'LEVEL COMPLETE';
    var list = [
      ['Distance', Math.floor(s.dist) + ' m'],
      ['Propeller hats', s.hats + '  (+' + U.fmt(s.hats * 10) + ')'],
      ['Eggs', s.eggs + '  (+' + U.fmt(s.eggScore) + ')'],
      ['Enemies beaten', s.kills],
      ['Narrow escapes', s.dodges || 0],
      ['Boss bonus', '+' + U.fmt(s.bossBonus)],
      ['Lives left', s.lives + '  (+' + U.fmt(s.lifeBonus) + ')']
    ];
    if (s.perfect) list.push(['No lives lost!', '+' + U.fmt(s.perfectBonus)]);
    list.push(['Total', U.fmt(s.score), 'total']);
    if (s.newBest) list.push(['', '★ NEW BEST ★', 'newbest']);
    el.lcStats.innerHTML =
      '<div class="rank rank-' + s.rank + '"><span>' + s.rank + '</span><small>RANK</small></div>' +
      rows(list) + nextUnlockHtml();
    el.unlockList.innerHTML = (unlocks || []).map(function (u) {
      return '<div class="unlock">🔓 ' + u + '</div>';
    }).join('');
    var nextBtn = document.querySelector('#scr-complete [data-go="next"]');
    if (nextBtn) {
      nextBtn.style.display = isFinal ? 'none' : '';
    }
    UI.show('complete');
  };

})(window.DR);
