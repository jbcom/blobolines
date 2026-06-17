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
Lives next to the code in `__tests__/`.

## Browser fixtures — `pnpm test:browser` (Vitest browser mode, real Chromium + WebGL)

Render regressions that only a real GPU context catches:
- `app/scene/world/__tests__/SkyDome.fixture.test.tsx` — sky shader paints pixels
- `app/scene/blob/__tests__/BlobActor.fixture.test.tsx` — gooey blob + eyes render
- `app/scene/blob/__tests__/GooCsg.fixture.test.tsx` — merged CSG goo body renders and
  survives rest/deform/refraction paths
- `app/scene/world/__tests__/GoldenRoutePreview.fixture.test.tsx` — solid red route-proof
  parabola renders from stored golden-path samples
- `app/scene/world/__tests__/LandingTargetMarker.fixture.test.tsx` — the live golden-path
  bullseye paints at the certified next landing point
- `app/views/hud/__tests__/LaunchInput.browser.test.tsx` — launch surface, keyboard
  steering, and air-steer reticle behavior
- `app/views/hud/__tests__/NextPadRadar.browser.test.tsx` — next-target direction,
  vertical gap, distance, and hidden state when no target exists
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
end to end. It passes against both `pnpm dev` and the production preview build.

## Dev harness (manual + tooling)

`app/views/DevHarness` (`?dev` or the DEV button) fires blob events (start/launch/skin/
game-over) and **auto-writes** a scene screenshot + before/after diagnostics JSON to the
gitignored `artifacts/` dir via Vite middleware (`scripts/capturePlugin.ts`). Use it to
inspect or screenshot gameplay states without timing anything by hand.

The harness also has **route proof sequence**: it steps through the first consecutive
trampoline pairs, enables the solid red golden-path parabola for each pair, and writes
`artifacts/route-proof-XX-*.png` plus matching JSON. Those JSON files include the source
pad, target pad, source mode, launch normal, samples, flight time, apex, landing, lip
clearance, landing precision, and compressed-arc score.

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
