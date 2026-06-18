<!-- profile: arcade-game agent-state mobile-android nas-assets standard-repo v1 -->
# blobolines

A gooey-blob vertical-launch physics arcade game — bounce a squishy gel blob up
endless neon-soft trampolines with stored-momentum slingshot launches, 3D mid-air
steering, and big colorful World-of-Goo-style splats. React Three Fiber + Rapier,
shipped to GitHub Pages (web) and Android (Capacitor).

## Profiles loaded

@/Users/jbogaty/.claude/profiles/arcade-game.md
@/Users/jbogaty/.claude/profiles/agent-state.md
@/Users/jbogaty/.claude/profiles/mobile-android.md
@/Users/jbogaty/.claude/profiles/nas-assets.md
@/Users/jbogaty/.claude/profiles/standard-repo.md

## Repo-specific

- **Run:** `pnpm dev`
- **Test:** `pnpm test` (vitest happy-dom) · `pnpm test:browser` (Chromium fixtures) · `pnpm test:e2e` (Playwright)
- **Build:** `pnpm build` (tsc --noEmit + vite build)
- **Deploy:** GitHub Pages via `.github/workflows/cd.yml` on push to `main`; Android debug APK in `ci.yml`. See `docs/DEPLOYMENT.md`.
- **Org/Pages:** public repo `jbcom/blobolines`, MIT. Pages base path `/blobolines/` (gated by `GITHUB_PAGES=true`); Capacitor base `./` (gated by `CAPACITOR=true`).
- **Latest-everything policy:** always use latest stable of every dependency and modernize past breaking changes — never pin to older for convenience.

## Architecture (mirror arcade-cabinet dialect)

- `src/` = engine, deterministic sim, math/RNG facade, audio, shaders, content/tuning.
- `app/` = React entry, R3F `<Canvas>` views/scene, post-processing, and the shadcn DOM UI overlay (HUD/menus/modals) positioned absolutely over the canvas.
- **Determinism:** `src/sim/**` & `src/engine/**` are pure (no DOM, no `Math.random()` — use `createRng(seed)`; no `performance.now()` — use the engine clock facade). Enforced by `.claude/gates.json` ban_patterns.
- **Renderer↔UI bridge:** UI never touches three objects except via the documented store/bridge.

## Origin

`blobolines-poc.html` (2290-line single-file Gemini PoC, "Neon Launch 3D") + `Gemini-Building_a_Neon_Physics_Game.md` are the **minimum baseline to elevate** — kept at root as reference, not shipped. The real game is a full rebuild.

## Notes

- Goo/metaball prior art lives in `~/src/arcade-cabinet/{marmalade-drops,ebb-and-bloom,kings-road}` — mine, don't reinvent.
- Continuous overnight build is directive-driven: see `.agent-state/directive.md`. NO stopping; one initial commit; local comprehensive-review folded forward.
