---
title: Game Design
updated: 2026-06-16
status: current
domain: product
---

# Blobolines — Game Design

## The fantasy

You are a gooey gel blob. Bounce up an endless tower of springy trampolines and get
**as high as you can**. Every bounce squishes you, every launch stretches you, and you
splat colorfully when you land. The higher you climb the harder it gets — smaller pads,
trickier types, longer falls.

## Core loop (the spine — from the PoC, preserved)

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

The tower is a 3D climb, so the HUD gives players a compact **next-pad radar** while a
run is active. It uses the last landed pad as the progression floor and points toward the
next generated trampoline above it, showing:

- lateral direction (`forward`, `back`, `left`, `right`, or a diagonal)
- vertical gap in metres, including negative values when the blob has arced above the target
- horizontal distance in metres

This keeps the player oriented without flattening the 3D space into an auto-aim lane: the
blob still has to be steered onto the actual trampoline.

## Trampoline types

| Type | Color (token) | Behavior |
|------|---------------|----------|
| standard | `tramp.blue` | Reliable bounce (rebound ×1.0) |
| booster | `tramp.orange` | Big rebound (×1.8) |
| moving | `tramp.gold` | Glides sideways — timing matters |
| fragile | `tramp.green` | Disintegrates shortly after impact |

Low pads (below y≈25) are always `standard` so the start is forgiving; pads shrink with
altitude (difficulty curve).

## Blob expression (the eyes)

Procedural eyes (white sclera + bezel + black pupil + glint + tear) react to motion:

| State | Trigger |
|-------|---------|
| idle / blink | resting / periodic |
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

The world is seeded: a given seed replays the exact same tower (`createRng` → world
generator). The sim advances on a fixed timestep, so runs are reproducible — important
for testing and future features (daily seed, ghosts, replays).

See `docs/ARCHITECTURE.md` for how these systems are wired, and `docs/DESIGN.md` for the
visual identity / design tokens.
