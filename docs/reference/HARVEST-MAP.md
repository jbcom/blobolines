---
title: Harvest Map
updated: 2026-06-16
status: current
domain: technical
---

# Harvest Map — which cabinet game to copy each subsystem from

~90% of Blobolines is a unique recombination of code already proven in
`~/src/arcade-cabinet/*`. For each subsystem, copy the BEST existing implementation,
then adapt to Blobolines' tokens, ECS, and game rules. Attribute the source in a code
comment. Paths are absolute.

## Gooey blob (the star)

| Piece | Source | Adapt |
|-------|--------|-------|
| Metaball density-field shader (fullscreen quad SDF) **[CHOSEN render path]** | `marmalade-drops/references/src-v1/shaders/metaballFluid.ts` | sync blob XY/radius/color uniforms via useFrame into preallocated Float32Arrays; z=0.5, NormalBlending, transparent, depthWrite=false |
| Metaball renderer wiring | `marmalade-drops/references/src-v1/components/game/MetaballRenderer.tsx` | drive from ECS blob entities |
| Blob component + Rapier merge | `marmalade-drops/references/src-v1/components/game/Blob.tsx` | radius = sqrt(mass)*0.4; render radius ~2x collider for squish |
| True-3D fallback (marching cubes) | `ebb-and-bloom/engine/rendering/marching-cubes/{MarchingCubesRenderer.tsx,ChemicalBlobBuilder.ts}` | only if volumetric look needed; heavier |
| Gooey shader look | fresnel rim `pow(1-dot(N,V),3)*0.6` + specular shimmer + thickness saturation + sharp smoothstep alpha. NO subsurface. |
| Splash burst on impact | `kings-road/src/combat/vfx/bloodMetaballs.ts` + `app/scene/combat/BloodMetaballsEffect.tsx` | pool ~3 bursts × 16 point-masses, parabolic gravity, smin raymarch, fade `1-smoothstep(0.7,1,age)`; recolor blood→colorful goo |
| Squash/stretch + jiggle | scale-based on impact (`scale.y*=0.7, x/z*=1.15`, ease-out-cubic spring back) — NOT MeshDistortMaterial. Spring ref: `infinite-headaches` WobbleComponent |
| Splat decals on surfaces | Canvas2D texture painting (cheap) — paint blob color, `texture.needsUpdate=true`. Trails: drei `<Trail>` len 8–12 |

## Audio (Tone.js)

| Piece | Source | Adapt |
|-------|--------|-------|
| **Audio engine [CHOSEN]** | `syntheteria/src/audio/{audioEngine,sfx,music,ambience,index}.ts` | class-less modular; master + sfx/music/ambient gain buses; lazy `Tone.start()` on first gesture; Tone.Loop procedural music |
| SFX mapping | rename SfxNames → bounce_platform (by type), launch_strength, collectible_chime, powerup_collect, explosion_splat, tension_charge_loop (LFO on FM synth) |
| Audio tests | `syntheteria/src/audio/__tests__/*.vitest.ts` (mock Tone, verify pooling/rate-limit) |
| Alt (complex buses/spatial) | `midway-mayhem/src/audio/audioBus.ts`; (era-tint/limiter) `on-the-ropes/src/audio/buses.ts` |

## Physics · Scene · PostFX

| Piece | Source | Adapt |
|-------|--------|-------|
| **Rapier world/bodies/constants [CHOSEN]** | `marmalade-drops/src/game/{rapierWorld,rapierBodies,rapierConstants}.ts` | FIXED_TIMESTEP 1/60, accumulator, CCD on blob (anti-tunnel), kinematic platforms; ball→blob, table→vertical bounds |
| **Fixed-timestep loop [CHOSEN]** | `marmalade-drops/src/hooks/usePinballLoop.ts` | accumulator while-loop in useFrame; clamp MAX_FRAME_DELTA |
| Canvas + scene decomposition | `marmalade-drops/src/app/AppSceneCanvas.tsx` + `PinballSceneAtmosphere.tsx` | small components, refs for mesh sync (no per-frame re-render) |
| Camera follow rig | `will-it-blow/src/player/FPSCamera.tsx` | vertical blob-follow: `k=1-exp(-dt/tau)`, lerp target to blobPos + offset; FOV warp on launch |
| **PostFX stack [CHOSEN]** | `midway-mayhem/src/render/PostFX.tsx` | EffectComposer multisampling=0; ToneMapping ACES + HueSaturation + BrightnessContrast + Bloom(0.45/0.72) + Noise + Vignette; pulse bloom on launch speed |
| Reactive chromatic/vignette | `overheat-titan-extraction/src/components/VisualEffects.tsx` | mutate Vector2 offset in place (never reassign — avoids circular-ref crash) |
| Mobile perf | dpr [1,1] on Pixel 5a, multisampling 0, conditional shadows via `reducedEffects` flag; N8AO too heavy — prefer Vignette for depth |

## UI · Test harness · CI/CD

| Piece | Source | Adapt |
|-------|--------|-------|
| cn() util | `realm-walker/lib/utils.ts` | already in src/lib/utils.ts |
| HUD overlay pattern | `midway-mayhem/src/ui/GameOverOverlay.tsx` | clamp() responsive, text-shadow glow, backdrop blur; reuse for game-over/HUD |
| Button (CVA) | `iron-frontier/components/ui/Button.tsx` | strip RN Platform.select; keep CVA variants |
| Dialog/modal | `iron-frontier/components/ui/Dialog.tsx` | swap RN-reanimated → Motion (AnimatePresence + motion.div) per our shadcn+Motion choice |
| **Test setup [CHOSEN]** | `midway-mayhem/src/test/setup.ts` | WebGL/canvas/rAF mocks + THREE console filter |
| **FixtureStage [CHOSEN]** | `midway-mayhem/src/test/scene.tsx` | SceneCapture exposes gl/scene/camera on window for sync screenshot; renderAndCapture, waitFrames(N), preserveDrawingBuffer; we have app/fixtures/FixtureStage.tsx — fold in capture helpers |
| Example fixture test | `midway-mayhem/src/test/harness.browser.test.tsx` (+ `Aethelgard.../tests/harness/*.browser.test.tsx`) | render component, waitFrames, assert canvas.toDataURL().length > 4000 |
| **CI Pages deploy [CHOSEN]** | `Aethelgard-Chronicles-of-Strata/.github/workflows/cd.yml` | job-scoped pages:write+id-token:write, upload-pages-artifact + deploy-pages (SHA-pinned v6/v5); pnpm build:pages; base `/blobolines/` |
| **CI signed APK [CHOSEN]** | `Aethelgard-Chronicles-of-Strata/.github/workflows/release.yml` | setup-java temurin 21 + setup-android, cap add/sync, gradlew; for ci.yml use assembleDebug + upload-artifact (no signing) |
| vitest browser config | `Aethelgard-Chronicles-of-Strata/vitest.config.ts` | @vitest/browser-playwright chromium, fileParallelism:false, react/three dedupe |

**Note:** cabinet uses CSS+CVA, not framer-motion. Blobolines deliberately uses
shadcn/ui (Radix) + Motion + anime.js per owner spec — a superset; add those libs and
keep the cabinet components as structural references.
