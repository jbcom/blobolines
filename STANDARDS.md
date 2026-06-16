# STANDARDS.md — non-negotiables

## Code

- pnpm only; Biome lint+format; TypeScript strict; Conventional Commits; squash-merge PRs.
- No stubs, TODOs, placeholders, or deferrals in committed code — it works and is tested.
- Sim purity: `src/sim/**` & `src/engine/**` are pure (no DOM/three; `createRng` not
  `Math.random`; clock facade not `performance.now`). Enforced by `.claude/gates.json`.
- Render ≠ UI: DOM UI talks to the game only through the store bridge.
- Every committed render/UI change is verified by a visual fixture + a real-browser pass;
  sim/engine changes by unit tests (gates enforce this).

## Brand & visual

- The palette is the cover-art palette in `src/styles/tokens.ts` — the single source of
  truth. **No raw hex** in render/scene/UI/sim code (brand-hex gate). Add a token instead.
- Identity is soft, juicy, gooey — **not** neon-cyberpunk (the PoC look was dropped).
- Fonts: Fredoka Variable (display) + Nunito Variable (UI), self-hosted in
  `public/assets/fonts` (offline-capable for Android).
- The blob is a deformable gooey body with big expressive eyes — never a rigid sphere in
  the final look. Squash/stretch, splats, and eye states are core, not optional polish.

## Game feel

- The spine is the height-chase: launch the blob AS HIGH AS POSSIBLE. The altimeter and
  camera always keep "how high" legible. Everything else serves that climb.
- Juice over realism: squash, stretch, splat, merge, blink, haptics.
- Determinism: a seed reproduces a run exactly.

## Mobile

- Touch-first; safe-area aware (`env(safe-area-inset-*)`); target 60fps on a Pixel-5a-class
  device. Hover is decoration, not function.

## Performance budget (goo)

- The metaball goo raymarch is the heaviest fragment cost — keep `MAX_GOO_BALLS` and the
  step count within the mobile budget; profile before raising them.
