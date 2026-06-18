---
title: Testing
updated: 2026-06-17
status: current
domain: quality
---

# Blobolines — Testing

Three layers, each catching a different class of bug. All run in CI on every PR.

## Unit — `pnpm test` (Vitest, happy-dom)

Pure logic: deterministic RNG/clock/springs, engine loop, world generator, golden-path
parabola proofs, launch/combo/collect math, ECS traits, design tokens. Fast, no GPU.
Determinism is explicitly tested (same seed → same sequence; fixed-timestep reproducibility).
Lives next to the code in `__tests__/`. `app/scene/blob/__tests__/TrajectoryPreview.test.ts`
locks the always-visible route parabola and endpoint reticle across every active tier.
`src/sim/blob/__tests__/blob.test.ts` locks the first-pad idle rule: visual impatience can
accumulate before player control, while waiting on a pad never launches for the player.

## Browser fixtures — `pnpm test:browser` (Vitest browser mode, real Chromium + WebGL)

Render regressions that only a real GPU context catches:
- `app/scene/world/__tests__/SkyDome.fixture.test.tsx` — sky shader paints pixels
- `app/scene/blob/__tests__/BlobActor.fixture.test.tsx` — gooey blob + eyes render
- `app/scene/blob/__tests__/GooCsg.fixture.test.tsx` — merged CSG goo body renders and
  survives rest/deform/refraction paths, including the first-pad idle-impatience burble and
  the charged aim-direction bead
- `app/scene/blob/__tests__/SplitBlobEchoes.fixture.test.tsx` — slicer-triggered mini
  Blobby fragments render as visible split echoes
- `app/scene/world/__tests__/GoldenRoutePreview.fixture.test.tsx` — solid red route-proof
  parabola renders from stored golden-path samples for the dev harness
- `app/scene/world/__tests__/RouteGateField.fixture.test.tsx` — proof-anchored phase
  portals and slicers render in WebGL and report gameplay hit metadata
- `app/views/hud/__tests__/LaunchInput.browser.test.tsx` — launch surface, keyboard
  steering, and air-steer reticle behavior
- `app/views/hud/__tests__/NextPadRadar.browser.test.tsx` — next-target direction,
  vertical gap, distance, and hidden state when no target exists
- `app/views/hud/__tests__/DifficultyMeter.browser.test.tsx` — active difficulty tier,
  metres to the next transition, and final-cadence state
- `app/views/hud/__tests__/RouteLandingToast.browser.test.tsx` — route-quality toast shows
  the landing grade/style bonus and clears itself
- `app/scene/__tests__/physics.fixture.test.tsx` — **Rapier physics regression**: a body
  falls under gravity (guards the WASM-suspension bug where `<Physics>` never mounts)

Fixtures render a component in `app/fixtures/FixtureStage` and assert the canvas produced
a non-trivial painted frame (`toDataURL().length`). Canvas lookups are scoped to the
fixture root to avoid cross-test flakiness.

## End-to-end — `pnpm test:e2e` (Playwright, real browser, dev + prod build)

`e2e/playable.spec.ts` is the **"is it playable?" gate**: open `?dev`, start a run,
launch the blob, assert the altimeter climbs off zero. This single flow proves Physics
mounted, the body simulates, the launch impulse applied, and the height-chase updates —
end to end.

`e2e/route-proof.spec.ts` is the **"is the dev-only route visibly proven?" gate**:
it drives the real DEV route-proof sequence, waits for the eight timed JSON+PNG captures,
asserts the opening Easy proof sequence generated exactly three proof variants per pair,
proves every landing is inside the target trampoline footprint, and pixel-checks each PNG for
the solid red parabola/impact overlay. This keeps the visual proof harness honest without
showing that answer key during normal play.

## Dev harness (manual + tooling)

`app/views/DevHarness` (`?dev` or the DEV button) fires blob events (start/launch/skin/
game-over) and **auto-writes** a scene screenshot + before/after diagnostics JSON to the
gitignored `artifacts/` dir via Vite middleware (`scripts/capturePlugin.ts`). Use it to
inspect or screenshot gameplay states without timing anything by hand.

The harness also has **route proof sequence**: it steps through the first consecutive
trampoline pairs, enables the solid red golden-path parabola for each pair, and writes
`artifacts/route-proof-XX-*.png` plus matching JSON. Those JSON files include the source
pad, target pad, source mode, launch normal, samples, flight time, apex, landing, lip
clearance, landing precision, compressed-arc score, starting difficulty, active difficulty,
next transition, exact active proof variant count, and the visible seed phrase needed to
replay the tower. The CLI seed verifier reports the same upper/lower contract as
`actual-min-actual-max/required-min-required-max`; for example a short Easy opening can
report `3-3/3-3`, while a longer Easy-starting route that has progressed into Medium can
report `2-3/2-3`. It also reports route-gate counts, split between phase portals and
slicers, and fails any gate that is not anchored to a proof sample, any phase portal that
cannot be crossed during a deterministic open timing, or any slicer with invalid fragment
metadata.

## Coverage gates

`.claude/gates.json` enforces (at commit time): render/UI changes need a visual test +
a real-browser pass; sim/engine changes need unit tests; audio changes need audio tests;
Capacitor/Android changes need `cap:sync`. Plus determinism bans (`Math.random`/
`performance.now` in sim) and the brand-hex ban outside tokens.

## Commands

```sh
pnpm test            # unit
pnpm test:browser    # Chromium fixtures (needs: pnpm exec playwright install chromium)
pnpm test:e2e        # Playwright e2e
pnpm typecheck       # tsc --noEmit
pnpm lint            # biome
```
