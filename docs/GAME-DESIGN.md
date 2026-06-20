---
title: Game Design
updated: 2026-06-20
status: current
domain: product
---

# Blobolines — Game Design

## The fantasy

You are a gooey gel blob. Launch through an endless tower of soft cloud pads and get
**as high as you can**. Every cloud catch squishes you into a happy puddle, every launch
stretches you into a missile, and you splat colorfully when you land. The higher you climb
the harder it gets — smaller clouds, faster layers, trickier cloud types, longer falls.

## Core loop

1. The blob rests in a cloud pad.
2. **Hold on Blobby** to charge the route launch (a power meter fills); **release** to fly.
3. In the air, **drag** to steer in 3D (left/right = world X, forward/back = world Z).
4. Descend into a higher cloud — it adheres to Blobby, lets him puddle into the puff, and
   clean catches build your **combo** multiplier, which boosts launch power.
5. Climb. The **altimeter** tracks your height; the **next-pad radar** points toward the
   next intended cloud in 3D space; your **best height** persists.
6. Fall too far below the last cloud you caught → **game over** → replay.

The whole game serves making that climb feel amazing: juicy goo, squash-stretch,
expressive eyes, splats.

## Rewards & progression

- **Crystals** float along the climb in four rarity tiers (`src/world/crystalTier.ts`): common,
  rare, radiant, and the very-rare **treasure** jackpot (worth 25, a big golden chest with a
  celebratory gold-flash collect). Rarer tiers ramp in with altitude, so climbing higher pays out.
- **Skins** are unlocked two ways: most with crystals in the customizer, but several are
  **achievement-gated** — earning *Apex Ascent* (25k score → ghost), *Deep Space* (1000m → ink),
  *Voyager* (2000m → nebula), or *Faithful* (a 7-day daily streak → **aurora**) grants its
  exclusive skin. The customizer shows those tiles as "Earn: <achievement>".
- **Achievements** evaluate at run end + in real time; newly-met ones toast and persist, and a
  local high-scores leaderboard + achievements gallery track lifetime progress.
- **Daily-streak achievements** reward returning for the shared daily challenge on consecutive
  UTC days: *Daily Devotee* (a 3-day streak) and *Faithful* (a 7-day streak, which grants the
  aurora skin). The streak only advances on TODAY'S daily tower (not a replayed past one), so
  these reward genuine day-over-day return — the engagement loop the streak counter already drives.

## Spatial awareness

The tower is a 3D climb, so the camera, HUD, and generator share a strict spatial contract:
the immediate cloud and the next cloud after it must be visible from the launch
state, and consecutive clouds may never collapse into a directly-overhead column. The HUD gives
players a compact **next-pad radar** while a run is active. It uses the last landed pad as the
progression floor and points toward the next generated cloud above it, showing:

- lateral direction (`forward`, `back`, `left`, `right`, or a diagonal)
- vertical gap in metres, including negative values when the blob has arced above the target
- horizontal distance in metres

This keeps the player oriented without flattening the 3D space into an auto-aim lane: the
blob still has to be steered into the actual cloud catch volume.

Every consecutive cloud pair also has a stored **golden path proof** on the source cloud:
a calculated passive parabola with launch normal, source mode (`flat`, `moving`, `canted`, or
`wobbler`), flight time, apex, descending-impact landing point, absolute lip clearance,
landing precision percentile, compressed-arc score, and world-space samples. The final sample
is the impact point inside the successor cloud; an ascending height crossing is not a valid
route proof. The dev harness renders these proof samples as a solid red parabola plus a red
impact circle, then captures a timed PNG/JSON sequence for inspection.

Generation is difficulty-profiled but not fixed-patterned. Candidate pad types are weighted by
difficulty, then the hidden parabola verifier decides what is legal: the source pad may remain
flat or become moving, canted, or wobbly only if the resulting arc proves a readable descending
impact inside the successor footprint. Flat sources are verified against the real hold-charge
route curve rather than a fake straight-up bounce. The generator also budgets the horizontal
turn angle between consecutive route bearings: an arc can be mathematically reachable and still
be rejected if it asks the player to reverse direction too sharply for the active difficulty.
The variant count is an exact active-difficulty target, not only a lower bound: Easy stores
exactly three accepted launch variants per step, Medium exactly two, and Hard, Blobmare, Ultra
Blobmare, and Ultimate Blobmare exactly one, with increasingly small lip, precision, footprint,
turn-angle, charge fit, and compression margins. Flat-to-flat, flat-to-slider, slider-to-canted,
canted-to-canted, wobbler recovery, and compressed parabolas are all valid when the verifier
proves the route under the active profile. The long-run goal is Tetris-like cadence: every
seed is theoretically endless and eventually reaches one-path precision, but Easy gives a kid
a long runway before that ramp while Ultra Blobmare reaches it much sooner.

During a live run, the dev proof stays hidden, but the player always sees the live parabola
that would happen from the current charge. Easy mode means larger footprints, more accepted
trajectory variants, wider lips, and slower cadence; expert modes tighten charge/angle
precision instead of removing the readable route instrument. Player-facing guidance comes from:

- camera framing that keeps the current, immediate, and following clouds readable
- the next-pad radar, which gives direction/distance without naming the exact catch point
- a live aim preview while charging: every difficulty shows the dotted launch arc plus a
  pulsing endpoint reticle at the descending height crossing
- Blobby himself: while charging, his eyes, mouth, and goo body bead toward the selected launch
  direction, so expert modes still get character-readable intent without a drawn route
- a short route-quality toast after each certified landing (`Perfect route`, `Great route`,
  `Clean route`, or `Edge catch`) with the style-point bonus earned by proximity to that point

The solid red parabola and red impact circle are dev-harness evidence only. They prove the
seed and generator, but they are not mounted as normal player HUD.

## Cloud Pad Types

| Type | Color (token) | Behavior |
|------|---------------|----------|
| standard | `cloud.puff` | Reliable soft catch and player-charged launch |
| booster | `cloud.gold` | Warm high-energy catch cue; launch still belongs to the player |
| moving | `cloud.gold` | Drifts along a generated route axis — timing matters |
| fragile | `cloud.blush` | Wispy puff breaks apart shortly after catch |
| super | `cloud.gold` | Big reward-cloud cue; no automatic launch |
| ice | `cloud.glow` | Slick catch that breaks clean combo |
| wobbler | `cloud.storm` | Unstable puff tilts toward off-center catches |
| canted | `cloud.warm` | Certified angled cloud catch toward the next cloud |

Cloud pads are not solid platforms. Blobby can pass upward through the underside, then once he
is descending inside the cloud footprint the cloud applies adherence: horizontal velocity is
damped, vertical fall is softened, and the goo body settles into a smiling puddle that coats the
top of the puff. Holding charge makes that puddle cling and bead toward the route direction;
release detaches it into a stretched missile shape.

## Route gates

Expert profiles can add obstacles directly onto the certified path instead of changing the
meaning of the launch tool:

- **Phase portals** unlock in Ultra Blobmare and Ultimate Blobmare. They are vertical warm-light
  gates anchored to a stored golden-path sample, pulse open/closed on a deterministic cadence,
  and knock Blobby off-route when touched while closed.
- **Slicers** unlock in Blobmare. They are vertical wire gates, like a warm egg-slicer frame,
  anchored to a stored golden-path sample. The hidden proof still runs all the way to the next
  cloud, but the live aim guide and dev red proof stop at the slicer so the player must
  route the remaining cut after passing through it. Touching a slicer splits Blobby into three
  to five visible goo fragments that follow certified post-cut lanes. One survivor lane is
  guaranteed to stay inside the next cloud footprint, and the main body inherits that
  survivor exit velocity so the cut behaves like a route mechanic instead of pure decoration.
- The generator only emits a gate when the source/target pair already has a valid proof; the
  metadata stores the source pad, target pad, proof sample index, live radius, and gate-specific
  timing or split parameters. Phase portals store period/open-fraction/phase data; slicers store
  fragment count, split spread, and post-cut fragment lane samples.
- Seed verification checks every gate against the proof samples and confirms phase portals have
  a certified open timing while slicers have valid fragment metadata and at least one surviving
  certified lane. A route gate floating away from the proof path is a verifier failure, not a
  visual flourish.

The selected difficulty is the starting cadence, not a permanent lock. As altitude increases,
the effective route profile advances through the later modes; the HUD flashes labels like
`MEDIUM!!!` and `HARD!!!` when that transition happens and keeps a compact active-tier meter
under the altimeter so the player can read the current cadence and distance to the next
transition. Guidance stays visible across tiers: expert modes tighten charge, angle,
footprint, and gate timing instead of hiding the route instrument. The Easy opener is seeded
and proof-gated rather than fixed, but the opening guide forces readable same-side stepping
clouds, forgiving footprints, visible lateral separation, compact vertical spacing, and early
canted/wobbler route mechanics so the player is not asked to solve a tool-assisted
flat-to-flat stack. Sliders are withheld during the Easy profile and unlock once the
effective route difficulty has progressed beyond Easy. Clouds still shrink with altitude
(difficulty curve), while each effective difficulty profile sets its own lip-clearance,
landing-precision, cant-angle, footprint scale, shape variety, proof-variant count,
turn-angle budget, compressed-arc rules, and expert route-gate cadence.

Visually, cloud pads are blobs in a different blob: lumpy warm puffs shaded with the same wet
goo material language as Blobby, not square platforms or rubber hoops. Impacts compress the
cloud, catch splats stain the puff, and each type gets a silhouette cue from its cloud behavior.
The low biome uses cheerful blue daylight, honey sunlight, and peach fog behind mango, berry,
gold, and cocoa foreground objects for clear foreground/background separation without returning
to the old neon-cyberpunk look or collapsing into orange-on-orange.

## Blob expression (the eyes)

Procedural eyes (white sclera + bezel + black pupil + glint + tear) and the mouth react to
motion and launch charge:

| State | Trigger |
|-------|---------|
| idle / blink | resting / periodic; first-pad waiting still counts as visual idle time |
| impatient burble | lingering in a cloud without aiming; goo lobes perk/twitch and face opens |
| charge anticipation | route charge held; eyes widen/dart, mouth opens |
| aim bead | charged route launch; goo body forms a leading lobe toward the launch vector |
| squint | hard impact (landing) |
| wide | big launch / fast ascent |
| tear | falling far / near death |

Visual impatience never launches for the player: Blobby can get visibly restless before the
first launch, but every grounded launch belongs to a player hold-release.

## Physics constants (current tuning — `src/sim/physics/config.ts`)

| Constant | Value | Meaning |
|----------|-------|---------|
| `GRAVITY` | `[0, -22, 0]` | World gravity (vertical climber) |
| `BLOB.radius` | `0.85` | Blob collider radius |
| `BLOB.ccd` | `true` | Continuous collision (anti-tunnel at launch speed) |
| `BLOB.linearDamping` | `0.05` | Light drag |
| `DEATH_FALL_DISTANCE` | `24` | Fall this far below the last caught cloud → game over |
| `WORLD_BOUND_XZ` | `35` | Lateral bounds (blob bounces off) |
| `MAX_IMPACT_SPEED` | `28` | Impact speed → full squash/squint |
| `FIXED_DT` (engine) | `1/60` | Fixed sim timestep |

Launch power (`src/sim/launch`): `dir × (BASE_POWER 14 + charge × 17.5) ×
launchMultiplier × comboMultiplier`. Combo multiplier: `1 + (streak − comboStart + 1) ×
comboStep` (anchored at `comboStart` 2, `comboStep` 0.12), streak capped at MAX_COMBO 12.
Cloud catches adhere and score; they do not auto-bounce into the next launch.

Cloud catch spring (`src/sim/trampoline`, compatibility name): depress + tilt via the
`-k·x − c·v` damped spring (stiffness 170 / damping 26 for depress; 150 / 22 for tilt),
springing back.

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
