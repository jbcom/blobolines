# Continuous Work Directive — blobolines

**Status:** ACTIVE
**Owner:** jbogaty
**Mandate:** "mutate your own prompt and directives to continually improve docs, tests,
codebase, and add features and polish to the game. Never block / WAIT-USER. Long-running
comprehensively-reviewed local branch, PR only at the end (or at a really significant
cutting point), address all feedback, squash-merge. Use the mounted assets server for
props/scenery/etc to make the game richer and more fun. Open-ended exploratory work,
immediate commitment to directives, full creative control."

Open-ended polish + feature work on the gooey-blob vertical-launch arcade game. Self-pace,
self-direct, self-assess at every stage boundary, and re-write this directive forward as
the work surfaces the next step. The previous full-codebase audit (see git history +
`.full-review/`) is DONE and merged-equivalent; this directive supersedes it.

## What CONTINUOUS means
1. Work continuously through the queue — never stop for status report, scope worry,
   summary, context pressure, or because a task feels big.
2. Never WAIT-USER for anything the agent can physically do (open PR, merge green PR,
   address feedback, cut branches, run verification). True blockers only: interactive
   credential entry, spend authorization, missing hardware, genuine scope-flip question.
3. Re-enumerate use cases before each non-trivial system; read own spec/docs first.
4. Visual work: run it, screenshot, READ the screenshot, compare to a named reference,
   fix before commit.

## Operating loop
while queue has [ ] items: enumerate → implement → verify (typecheck + lint + test, plus
test:browser where render/UI touched) → commit (conventional) → dispatch reviewers when
warranted, fold findings forward → mark [x] → self-assess (backward + forward sweep) →
re-write directive forward → next.

## Forbidden phrases
"deferred" | "v2+" | "out of scope" | "future work" | "tracked separately" | "follow-up"
"TODO" | "FIXME" | "stub" | "placeholder" | "mock for now"
"pause point" | "natural pause" | "fresh session" | "next session" | "stopping point"
"clean handoff" | "ready to hand off"

## Branch & commit discipline
- Long-running branch: `feat/nudge-achievements-toast` (current vehicle; already carries
  unmerged air-nudge + achievement-toast work). Layer forward commits here; open ONE PR
  at the next significant cutting point, then continue on a fresh branch.
- Conventional Commits, squash-merge, pnpm only, biome only, never commit to `main`.

## Assets
- NAS mounted at `/Volumes/home/assets` (12.7k GLBs; 3DLowPoly + 3DPSX). Use
  `assets-library` MCP to search/curate; `copy_asset` into `public/assets/models/` (GLBs
  carry embedded textures — do not re-extract). One visual style per project: 3DLowPoly to
  match the existing 6 bundled neon-soft low-poly props.

## Queue — Milestone: Biome richness pass

### B0 Architecture
- [x] B0.1 Enumerate the prop/scenery use cases & biome bands; read BiomeProps /
      BiomeScenicProps / tokens; decide a data-driven prop-registry shape (replace the 4
      hardcoded model components with a registry keyed by biome band) + record decision.
      → Decision in decisions.ndjson; `biomeBandAt(h)` added to src/config/biomes.ts as
      single-source-of-truth band resolver (+3 tests, suite 10 pass).
- [ ] [WAIT] B0.2 Curate 3DLowPoly props per biome band from the asset library (background
      agent a187cf74 running) — copies GLBs into public/assets/models/biomes/<band>/ and
      returns a JSON manifest; verify file sizes & poly budgets fit a mid-tier budget.

### B1 Implementation
- [ ] B1.1 Refactor BiomeScenicProps to the data-driven registry; each band shows a
      varied set (not one model), deterministic placement preserved, wrap logic intact.
- [ ] B1.2 Tests: registry/biome-band selection unit tests; visual/browser test for the
      enriched scene; preload coverage.

### B2 Verify & polish
- [ ] B2.1 Full verification (typecheck + lint + test + test:browser) and app-runs
      screenshot read; tune density/scale/placement against the named reference look.
- [ ] B2.2 Update docs (ARCHITECTURE / DESIGN as relevant) + CHANGELOG.

### B3 Cutting point
- [ ] B3.1 At the significant cutting point: open the PR, address all feedback, resolve
      threads, squash-merge; then re-write this directive forward to the next milestone.

## Notes
- This is a living plan. After every stage, backward+forward sweep and edit the queue.
- Next candidate milestones (surface, don't pre-commit): per-biome ambient audio beds,
  collectible pickups along the climb, parallax depth layers, blob trail/cosmetic unlocks.
