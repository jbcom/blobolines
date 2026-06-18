# Phase 4A — Framework & Best Practices Audit

**Scope:** full codebase. TypeScript configuration, React Three Fiber context, Vite build bundler options, package dependency graph, and CI/CD pipelines.
**Verdict:** Modern, high-grade development stack utilizing Vite 8, React 19, and Biome. But subtle gaps exist in the testing environment's module resolution, causing multiple instances of Three.js to load, and CI/CD runs can be speed-optimized through better dependency and binary caching.

| Severity | Count | Findings |
|---|---|---|
| Critical | 0 | — |
| High | 1 | DEV-H1: Missing E2E execution and optimized caching in the CI/CD pipeline |
| Medium | 1 | LANG-M1: Multiple Three.js instances imported in Vitest runners (prototype-clash risk) |
| Low | 2 | LANG-L1: TS type castings using unsafe casts (`as unknown as` and `any`) |
| Info | 1 | DEV-I1: Lack of automated security audit in CI/CD pipeline |

---

## High

### DEV-H1 — Missing E2E execution and optimized caching in the CI/CD pipeline
- **Location:** `.github/workflows/ci.yml`, `docs/DEPLOYMENT.md`
- **Details:** The CI pipeline lacks any step to execute the Playwright E2E tests (`pnpm test:e2e`). Furthermore, every CI build re-downloads and installs the Chromium browser binary for Playwright from scratch (`pnpm exec playwright install`).
  - This increases CI execution time by 1–2 minutes per run and exposes the build pipeline to transient download failures from the Playwright package CDN.
- **Recommended Fix:** 
  1. Add `pnpm test:e2e` to `.github/workflows/ci.yml`.
  2. Implement Playwright binary caching using standard `actions/cache` matching the Playwright version from `package.json`.

---

## Medium

### LANG-M1 — Multiple Three.js instances imported in Vitest runners (prototype-clash risk)
- **Location:** `vitest.config.ts`, `vitest.browser.config.ts`
- **Details:** When running tests, the console outputs: `THREE.WARNING: Multiple instances of Three.js being imported.`
  - This occurs because Vitest resolves `three` multiple times across different tests and dependencies (such as `@react-three/fiber`, `@react-three/drei`, and `three-bvh-csg`).
  - While Vite handles this in the main build via `resolve.dedupe: ["three"]`, the Vitest config files do not specify `dedupe` in their `resolve` block. This exposes tests to prototype-clash bugs (where geometry bounds or properties attached to Three's prototype in one module are missing or throw errors in another).
- **Recommended Fix:** Add `resolve: { dedupe: ["three"] }` to both `vitest.config.ts` and `vitest.browser.config.ts` to mirror the production bundler setup and silence the warnings.

---

## Low

### LANG-L1 — TS type castings using unsafe casts
- **Location:** `app/scene/blob/GooCsg.tsx:85,243`, `app/scene/blob/PlayerBlob.tsx:37`, `app/views/GameOver.tsx`
- **Details:** The codebase relies on multiple `as unknown as` and `as any` casts to work around minor library interface differences (e.g., three-bvh-csg types, three's custom shader material bindings, etc.). This bypasses TS compilation safety and can hide type-safety regressions during refactoring.
- **Recommended Fix:** Replace unsafe casts with clean, typed interface wrappers or helper guards wherever possible.
