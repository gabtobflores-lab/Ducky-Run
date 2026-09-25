# Ducky Run 🦆

A fast, duck-themed lane-runner for the browser. The duck runs on its own —
you pick the path, time the jumps, dash through trouble and take down the boss
waiting at the end of every level.

**Play it:** open `index.html` in any modern browser. No build step, no
dependencies, no downloads — everything (art, animation, music, sound effects)
is generated at runtime from code.

## Controls

| Action | Keys | Touch |
| --- | --- | --- |
| Switch path | `W` / `S` or `↑` / `↓` | Swipe up / down |
| Jump (hold for height) | `Space` | Tap |
| Dash attack | `J`, `X` or `Shift` | Swipe right |
| Duck ability | `E` | On-screen button |
| Pause | `P` / `Esc` | Pause button |
| Mute | `M` | — |

## What's in it

- **5 levels** — Duck Pond, Feathered Farm, Bubble Bathhouse, Stormy Skies and
  The Golden Nest — each with its own palette, parallax backdrop, hazard mix and boss.
- **Endless Run**, unlocked after level 1: zones rotate through every theme, a
  boss shows up every second zone, the pace never stops and your best distance sticks around.
- **6 unlockable ducks**, each with a distinct ability — a starting shield, a
  double jump, a mid-air hover, a regenerating shell, a phasing dash, a pickup magnet.
- **5 bosses** with telegraphed attack patterns. Dodge the volley, then punish
  the charge with a dash.
- **Collectibles**: propeller hats (chain them for a score multiplier), eggs,
  feather shields, bread magnets and turbo quacks.
- 3 lives per attempt, combo multipliers, close-call and flawless-streak bonuses,
  a per-level rank and saved best scores.

## Layout

```
index.html      markup: canvas, HUD, menus
styles.css      all DOM chrome
js/util.js      math, world geometry, saved progress
js/audio.js     WebAudio synth — every SFX and music track
js/input.js     keyboard, touch and on-screen buttons
js/particles.js pooled particles and score popups
js/art.js       every sprite, drawn procedurally
js/ducks.js     playable roster, abilities, unlock rules
js/levels.js    level table, endless zones, backdrop rendering
js/entities.js  obstacles, enemies, pickups, projectiles, spawner
js/boss.js      boss state machine and attack scripts
js/intro.js     opening cinematic
js/ui.js        menus, HUD, cards, results
js/game.js      simulation and world rendering
js/main.js      bootstrap
```

Progress is stored in `localStorage` under `duckyrun.save.v1`.

Made by Jasper and Gabriel.
