---
title: Game Design
updated: 2026-06-17
status: current
domain: product
---

# Blobolines — Game Design

## The fantasy

You are a gooey gel blob. Bounce up an endless tower of springy trampolines and get
**as high as you can**. Every bounce squishes you, every launch stretches you, and you
splat colorfully when you land. The higher you climb the harder it gets — smaller pads,
trickier types, longer falls.

## Core loop

1. The blob rests on a trampoline.
2. **Drag back** to charge a slingshot launch (a power meter fills); **release** to fly.
3. In the air, **drag** to steer in 3D (left/right = world X, forward/back = world Z).
4. Land on a higher trampoline — it **auto-bounces** you (springy), and a clean landing
   builds your **combo** multiplier, which boosts launch power.
5. Climb. The **altimeter** tracks your height; the **next-pad radar** points toward the
   next intended trampoline in 3D space; your **best height** persists.
6. Fall too far below the highest pad you reached → **game over** → replay.

The whole game serves making that climb feel amazing: juicy goo, squash-stretch,
expressive eyes, splats.

## Spatial awareness

The tower is a 3D climb, so the camera, HUD, and generator share a strict spatial contract:
the immediate trampoline and the next trampoline after it must be visible from the launch
state, and consecutive pads may never collapse into a directly-overhead column. The HUD gives
players a compact **next-pad radar** while a run is active. It uses the last landed pad as the
progression floor and points toward the next generated trampoline above it, showing:

- lateral direction (`forward`, `back`, `left`, `right`, or a diagonal)
- vertical gap in metres, including negative values when the blob has arced above the target
- horizontal distance in metres

This keeps the player oriented without flattening the 3D space into an auto-aim lane: the
blob still has to be steered onto the actual trampoline.

Every consecutive trampoline pair also has a stored **golden path proof** on the source pad:
a calculated passive parabola with launch normal, source mode (`flat`, `moving`, `canted`, or
`wobbler`), flight time, apex, descending-impact landing point, absolute lip clearance,
landing precision percentile, compressed-arc score, and world-space samples. The final sample
is the impact point on the successor trampoline; an ascending height crossing is not a valid
route proof. The dev harness renders these proof samples as a solid red parabola plus a red
impact circle, then captures a timed PNG/JSON sequence for inspection.

Generation is difficulty-profiled but not fixed-patterned. Candidate pad types are weighted by
difficulty, then the hidden parabola verifier decides what is legal: the source pad may remain
flat or become moving, canted, or wobbly only if the resulting arc proves a readable descending
impact inside the successor footprint. Flat sources are verified against the real slingshot
launch curve rather than a fake straight-up bounce. The variant count is an exact difficulty
target, not only a lower bound: Easy stores exactly three accepted launch variants per step,
Medium exactly two, and Hard, Blobmare, Ultra Blobmare, and One Wrong Move exactly one, with
increasingly small lip, precision, footprint, and compression margins. Flat-to-flat,
flat-to-slider, slider-to-canted, canted-to-canted, wobbler recovery, and compressed parabolas
are all valid when the verifier proves the route under the selected profile. The long-run goal
is Tetris-like cadence: every seed is theoretically endless and eventually reaches one-path
precision, but Easy should give a kid a long runway before that ramp while Ultra Blobmare
reaches it much sooner.

During a live run, the proof stays hidden. Easy mode means larger footprints, more accepted
trajectory variants, wider lips, and slower cadence; it does **not** mean the game draws the
golden solution. Player-facing guidance comes from:

- camera framing that keeps the current, immediate, and following trampolines readable
- the next-pad radar, which gives direction/distance without naming the exact catch point
- a live aim preview while charging: Easy/Medium/Hard show a dotted launch arc plus a pulsing
  endpoint reticle at the descending height crossing, Blobmare keeps only the dotted arc, and
  Ultra Blobmare / One Wrong Move hide the parabola overlay entirely
- Blobby himself: while charging, his eyes, mouth, and goo body bead toward the selected launch
  direction, so expert modes still get character-readable intent without a drawn route
- a short route-quality toast after each certified landing (`Perfect route`, `Great route`,
  `Clean route`, or `Edge catch`) with the style-point bonus earned by proximity to that point

The solid red parabola and red impact circle are dev-harness evidence only. They prove the
seed and generator, but they are not mounted as normal player HUD.

## Trampoline types

| Type | Color (token) | Behavior |
|------|---------------|----------|
| standard | `tramp.blue` (warm coral) | Reliable bounce (rebound ×1.12) |
| booster | `tramp.orange` | Big rebound (×1.8) |
| moving | `tramp.gold` | Glides along a generated route axis — timing matters |
| fragile | `tramp.green` | Disintegrates shortly after impact |
| super | `tramp.violet` | Guaranteed mega-launch reward |
| ice | `tramp.ice` | Big rebound, slippery, breaks clean combo |
| wobbler | `tramp.violet` | Tips toward off-center hits |
| canted | `tramp.orange` | Certified tilted bounce toward the next pad |

The Easy opener is seeded and proof-gated rather than fixed, but the opening guide forces
readable stepping pads, forgiving footprints, visible lateral separation, and early route
mechanics so the player is not asked to solve a tool-assisted flat-to-flat stack. Its first
lane uses wider human-launchable offsets rather than near-overhead edge catches, so different
seed phrases immediately produce visibly different opening routes. Pads still shrink with
altitude (difficulty curve), while each difficulty profile sets its own
lip-clearance, landing-precision, cant-angle, footprint scale, shape variety, proof-variant
count, and compressed-arc rules.

Visually, trampolines are not platform slabs: each pad renders as a round raised frame with
radial laces and a suspended jelly membrane. Impacts depress and tilt only the membrane, so
the bounce surface reads as elastic trampoline material rather than a moving block. The low
biome uses cheerful blue daylight, honey sunlight, and peach fog behind mango, berry, gold,
and cocoa foreground objects for clear foreground/background separation without returning to
the old neon-cyberpunk look or collapsing into orange-on-orange.

## Blob expression (the eyes)

Procedural eyes (white sclera + bezel + black pupil + glint + tear) and the mouth react to
motion and launch charge:

| State | Trigger |
|-------|---------|
| idle / blink | resting / periodic |
| charge anticipation | slingshot held; eyes widen/dart, mouth opens |
| aim bead | charged slingshot; goo body forms a leading lobe toward the launch vector |
| squint | hard impact (landing) |
| wide | big launch / fast ascent |
| tear | falling far / near death |

## Physics constants (current tuning — `src/sim/physics/config.ts`)

| Constant | Value | Meaning |
|----------|-------|---------|
| `GRAVITY` | `[0, -22, 0]` | World gravity (vertical climber) |
| `BLOB.radius` | `0.85` | Blob collider radius |
| `BLOB.ccd` | `true` | Continuous collision (anti-tunnel at launch speed) |
| `BLOB.linearDamping` | `0.05` | Light drag |
| `DEATH_FALL_DISTANCE` | `24` | Fall this far below max height → game over |
| `WORLD_BOUND_XZ` | `35` | Lateral bounds (blob bounces off) |
| `MAX_IMPACT_SPEED` | `28` | Impact speed → full squash/squint |
| `FIXED_DT` (engine) | `1/60` | Fixed sim timestep |

Launch power (`src/sim/launch`): `dir × (BASE_POWER 14 + charge × 17.5) × rebound(type)
× comboMultiplier`. Combo multiplier: `1 + (streak−1) × 0.15`, streak capped at 8.

Trampoline spring (`src/sim/trampoline`): depress + tilt via the `-k·x − c·v` damped
spring (stiffness 170 / damping 26 for depress; 150 / 22 for tilt), springing back.

## Determinism

The world is seeded by a visible replay phrase. Normal New Game shuffles a fresh
adjective-adjective-noun phrase with `seedrandom`; Daily Challenge uses a stable
`blobolines-daily-YYYY-MM-DD` phrase; explicit numeric test seeds round-trip as
`seed-<base36>`. `createRng` is the single seedrandom-backed facade used throughout world,
sim, render VFX, and audio variation, so a given phrase replays the exact same tower and
procedural effects.

The sim advances on a fixed timestep, so runs are reproducible. A player can report a seed
phrase from the difficulty picker or game-over card, and the dev harness diagnostics include
that phrase alongside the route-proof screenshots. This is the basis for production seed
verification: plug in the phrase, regenerate the route proofs, and prove the tower has a
certified path under the selected difficulty profile.

See `docs/ARCHITECTURE.md` for how these systems are wired, and `docs/DESIGN.md` for the
visual identity / design tokens.
