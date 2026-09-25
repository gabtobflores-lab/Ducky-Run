/* ============================================================
   ducks.js — playable roster, abilities and unlock rules
   ============================================================ */
(function (DR) {
  'use strict';
  var U = DR.util;

  /**
   * ability.type:
   *   'active'  — press E, has cooldown + duration
   *   'passive' — always on, tuned in game.js
   * Every duck is balanced around one clear strength.
   */
  DR.DUCKS = [
    {
      id: 'classic',
      name: 'Sunny',
      title: 'The Original',
      look: {
        body: '#ffd447', belly: '#fff3c4', head: '#ffd447', beak: '#f0932b',
        eye: '#20161f', legs: '#f0932b', wing: '#f0bd2b', accessory: 'none'
      },
      speedMul: 1.0,
      ability: {
        type: 'passive', key: '★', name: 'Lucky Down',
        desc: 'Starts every run with a Feather Shield and shrugs off hits with a longer mercy window.'
      },
      unlock: { kind: 'free', text: 'Always available' }
    },
    {
      id: 'rubber',
      name: 'Squeak',
      title: 'Bath Time Legend',
      look: {
        body: '#ff5f6d', belly: '#ffd2d6', head: '#ff5f6d', beak: '#ffb02b',
        eye: '#20161f', legs: '#ffb02b', wing: '#e84b58', accessory: 'none'
      },
      speedMul: 1.0,
      ability: {
        type: 'passive', key: '★', name: 'Rubber Bounce',
        desc: 'Double jump. Bouncy landings also give a small hop boost off bread pads.'
      },
      unlock: { kind: 'level', value: 1, text: 'Clear Duck Pond' }
    },
    {
      id: 'propeller',
      name: 'Pip',
      title: 'Sky Cadet',
      look: {
        body: '#8fd3ff', belly: '#dff3ff', head: '#8fd3ff', beak: '#f0932b',
        eye: '#20161f', legs: '#f0932b', wing: '#6fc0f0', accessory: 'propeller', accent: '#4aa3ff'
      },
      speedMul: 1.0,
      ability: {
        type: 'active', key: 'E', name: 'Hover', cd: 5.5, dur: 1.5,
        desc: 'Hovers in mid-air, floating clean over ground hazards. Great for greedy hat runs.'
      },
      unlock: { kind: 'hats', value: 150, text: 'Collect 150 propeller hats' }
    },
    {
      id: 'knight',
      name: 'Sir Quackalot',
      title: 'Pond Guard',
      look: {
        body: '#7ed957', belly: '#ccf5b5', head: '#7ed957', beak: '#f0932b',
        eye: '#20161f', legs: '#f0932b', wing: '#63bf42', accessory: 'helmet', accent: '#b8c6d6'
      },
      speedMul: 0.96,
      ability: {
        type: 'passive', key: '★', name: 'Aegis Shell',
        desc: 'A Feather Shield regrows every 14s, and dashes hit bosses twice as hard.'
      },
      unlock: { kind: 'level', value: 2, text: 'Clear Feathered Farm' }
    },
    {
      id: 'ninja',
      name: 'Shadow',
      title: 'Silent Quack',
      look: {
        body: '#4a3f5c', belly: '#7a6b96', head: '#4a3f5c', beak: '#c0392b',
        eye: '#ff5f6d', legs: '#c0392b', wing: '#3b3249', accessory: 'headband', accent: '#e0364f'
      },
      speedMul: 1.06,
      ability: {
        type: 'passive', key: '★', name: 'Phantom Dash',
        desc: 'Faster runner. Dash lasts longer, recharges quickly and phases straight through obstacles.'
      },
      unlock: { kind: 'boss', value: 3, text: 'Defeat 3 bosses' }
    },
    {
      id: 'mama',
      name: 'Mama Mallard',
      title: 'Nest Keeper',
      look: {
        body: '#f7f3e8', belly: '#ffffff', head: '#f7f3e8', beak: '#f0932b',
        eye: '#20161f', legs: '#f0932b', wing: '#e4dccb', accessory: 'bonnet', accent: '#ff9ec4'
      },
      speedMul: 0.98,
      ability: {
        type: 'passive', key: '★', name: 'Nest Magnet',
        desc: 'Permanently attracts pickups and every egg is worth double.'
      },
      unlock: { kind: 'eggs', value: 60, text: 'Collect 60 eggs' }
    }
  ];

  DR.duckById = function (id) {
    for (var i = 0; i < DR.DUCKS.length; i++) if (DR.DUCKS[i].id === id) return DR.DUCKS[i];
    return DR.DUCKS[0];
  };

  DR.unlockMet = function (d) {
    var p = DR.progress, u = d.unlock;
    switch (u.kind) {
      case 'free': return true;
      case 'level': return p.unlockedLevels > u.value;
      case 'hats': return p.totalHats >= u.value;
      case 'eggs': return p.totalEggs >= u.value;
      case 'boss': return p.bossesBeaten >= u.value;
      default: return false;
    }
  };

  DR.unlockProgressText = function (d) {
    var p = DR.progress, u = d.unlock;
    switch (u.kind) {
      case 'hats': return u.text + '  (' + Math.min(p.totalHats, u.value) + '/' + u.value + ')';
      case 'eggs': return u.text + '  (' + Math.min(p.totalEggs, u.value) + '/' + u.value + ')';
      case 'boss': return u.text + '  (' + Math.min(p.bossesBeaten, u.value) + '/' + u.value + ')';
      default: return u.text;
    }
  };

  /** Re-evaluate every unlock; returns the list of newly unlocked ducks. */
  DR.checkDuckUnlocks = function () {
    var got = [];
    DR.DUCKS.forEach(function (d) {
      if (DR.progress.ducks.indexOf(d.id) === -1 && DR.unlockMet(d)) {
        DR.progress.ducks.push(d.id);
        got.push(d);
      }
    });
    if (got.length) DR.saveProgress();
    return got;
  };

  DR.isDuckUnlocked = function (id) { return DR.progress.ducks.indexOf(id) !== -1; };

  /** The locked duck the player is closest to earning — used as a carrot. */
  DR.nextLockedDuck = function () {
    var p = DR.progress, best = null, bestFrac = -1;
    DR.DUCKS.forEach(function (d) {
      if (DR.isDuckUnlocked(d.id)) return;
      var u = d.unlock, frac = 0;
      if (u.kind === 'hats') frac = p.totalHats / u.value;
      else if (u.kind === 'eggs') frac = p.totalEggs / u.value;
      else if (u.kind === 'boss') frac = p.bossesBeaten / u.value;
      else if (u.kind === 'level') frac = (p.unlockedLevels - 1) / u.value;
      if (frac > bestFrac) { bestFrac = frac; best = d; }
    });
    return best ? { duck: best, frac: U.clamp(bestFrac, 0, 1) } : null;
  };

})(window.DR);
