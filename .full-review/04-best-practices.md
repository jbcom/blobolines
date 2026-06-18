# Phase 4: Framework & Best Practices Review

**Scope:** entire blobolines codebase (~16.4k LOC TS/TSX, 231 files).
Raw outputs: `raw-4a-best-practices.md`.

## Overall verdict
The project is built on **state-of-the-art modern tools** (Vite 8, React 19, Tailwind v4, Biome, and Playwright), maintaining excellent code standards and rigorous style policies.
However, **gaps in testing-layer configuration** allow module duplication bugs during test runs (e.g., multiple imports of Three.js), which can result in runtime prototype clashing. In addition, the **CI/CD pipelines are not fully optimized for speed or safety**, missing Playwright browser binary caching and having no automated dependency security scans.

---

## Framework & Language Findings (4A)

### Medium
- **LANG-M1** — **Multiple Three.js instances imported in Vitest runners**: When running unit and browser tests, the test runner outputs `THREE.WARNING: Multiple instances of Three.js being imported.` This is caused by a missing `resolve.dedupe: ["three"]` rule in `vitest.config.ts` and `vitest.browser.config.ts`, exposing the test environment to prototype-clash bugs (such as those affecting `three-bvh-csg`'s custom prototype properties).

### Low
- **LANG-L1** — **TS type castings using unsafe casts**: The code uses unsafe types and castings (e.g. `as unknown as` and `as any`) in several files (like `GooCsg.tsx` and `PlayerBlob.tsx`) to work around type-definition gaps in R3F or three-bvh-csg. These bypass compile-time safety checks.

---

## CI/CD & DevOps Findings (4B)

### High
- **DEV-H1** — **Missing E2E execution and optimized caching in CI/CD**: The GitHub Actions CI pipeline completely omits Playwright E2E execution. Moreover, every build re-downloads and installs the Chromium browser binary for Playwright from scratch, which slows down the build by 1–2 minutes per run and risks build failures from network instability.

### Info
- **DEV-I1** — **Lack of automated security audits**: The CI pipeline does not run automated dependency scanning (e.g., `pnpm audit` or third-party CVE scanning) on commits, relying instead on manual or out-of-band checks.

---

## Invariants verified
- Biome rules for lint & format **HOLDS** · ES2022 compile target **HOLDS** · Proper aliasing for imports (`@/*`, `@app/*`) **HOLDS** · Single production Three.js bundle chunk **HOLDS**.

---

## Critical Issues for Phase 5 Context
- **Consolidation focus for Phase 5:** Consolidate findings from Phases 1–4 into a final report (`05-final-report.md`). Create a prioritized remediation queue outlining critical, high, and medium/low-risk fixes.
