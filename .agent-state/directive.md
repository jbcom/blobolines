# Continuous Work Directive — blobolines

**Status:** ACTIVE
**Owner:** jbogaty
**Mandate:** "do not stop until fully done — overwrite directive and begin work in a new long-running local branch" (full-codebase comprehensive review + remediation)

Drive a **comprehensive review of the ENTIRE codebase** to completion, then **fix
every finding worth fixing** — Critical and High at minimum, Medium/Low where the
fix is clean — all on the long-running local branch `review/full-codebase-audit`.
This is the `/comprehensive-review:full-review` orchestrator run scoped to the
whole repo, plus the remediation pass that the review exists to enable.

## What CONTINUOUS means
1. Work continuously through the review phases and the remediation queue — never stop
   for a status report, scope worry, summary, context pressure, or because a task
   feels big.
2. The full-review orchestrator has a Checkpoint-1 (after Phase 2) that normally asks
   the user. The user's standing mandate is "do not stop until fully done" — treat the
   checkpoint as **auto-continue**: record the Phase 1-2 summary into the review files
   and proceed to Phase 3 without halting. (User can interrupt at any time.)
3. Only stop on: explicit user halt, red CI that can't be made green, or a genuine
   STOP_FAIL blocker (interactive credential entry, spend authorization, missing
   hardware, true scope-flip design question).

## Operating loop
while queue has [ ] items: implement, verify (typecheck + lint + test), commit,
dispatch reviewers if warranted, mark [x], next.

## Forbidden phrases
"deferred" | "v2+" | "out of scope" | "future work" | "tracked separately" | "follow-up"
"TODO" | "FIXME" | "stub" | "placeholder" | "mock for now"
"pause point" | "natural pause" | "fresh session" | "next session" | "stopping point"
"clean handoff" | "ready to hand off"

## Branch & commit discipline
- ONE long-running branch: `review/full-codebase-audit`. ALL work layers as forward
  commits here. Open the PR ONCE at the very end.
- Conventional Commits. The review-artifact commit is `chore:`; each remediation
  group is `fix:`/`refactor:`/`perf:`/`docs:`/`test:` as appropriate.
- Never commit to `main` directly.

## Queue — Full-codebase review + remediation

### R0 Review orchestration (the `/full-review` phases)
- [x] R0.1 Scope written (.full-review/00-scope.md), state.json initialized
- [x] R0.2 Phase 1 — Code Quality (code-reviewer) + Architecture (architect-review) → .full-review/01-quality-architecture.md
- [x] R0.3 Phase 2 — Security (security-auditor) + Performance (perf engineer) agents running in background; consolidate → .full-review/02-security-performance.md on completion
- [x] R0.4 Checkpoint-1 AUTO-CONTINUE — blocked on R0.3 agents; auto-records summary + proceeds (no halt) once Phase 2 lands
- [x] R0.5 Phase 3 — Testing (test-automator) + Documentation agents running in background; consolidate → .full-review/03-testing-documentation.md on completion (launched early, parallel with Phase 2 perf agent)
- [x] R0.6 Phase 4 — Framework/Language (typescript-pro) + CI/CD/DevOps (deployment-engineer) agents running in background; consolidate → .full-review/04-best-practices.md on completion (launched early for parallelism)
- [x] R0.7 Phase 5 — Consolidated report; blocked on R0.3/R0.5/R0.6 agents → .full-review/05-final-report.md
- [x] R0.8 Commit the review artifacts (chore:) — after R0.7
- [x] R0.9 Replace coarse R1.1 with concrete per-finding [ ] items derived from 05-final-report.md, then unblock R1–R4

### R1 Remediation — Critical (P0)
- [x] R1.1 Build the remediation queue (No Critical findings found)
- [x] R1.2 Fix all Critical (P0) findings (No Critical findings found)

### R2 Remediation — High (P1)
- [ ] R2.1 Fix TEST-H1 / DEV-H1: Integrate Playwright E2E tests into GitHub Actions CI pipeline and optimize with browser caching
- [ ] R2.2 Fix AR-H1 / DOC-H1: Cleanly remove vestigial Koota ECS and reconcile all code, config, tests, and documentation
- [ ] R2.3 Fix PERF-H2: Refactor monolithic per-frame loop in `PlayerBlob.tsx` into clean helper concern steps
- [ ] R2.4 Fix PERF-H1: Optimize `GooCsg.tsx` CSG chain, reduce BufferGeometry allocations/GC churn, and add geometry leak tests

### R3 Remediation — Medium/Low (clean fixes only)
- [ ] R3.1 Fix LANG-M1: Deduplicate Three.js imports in Vitest configurations to prevent prototype clashing
- [ ] R3.2 Fix SEC-M1: Add robust meta CSP security headers on GitHub Pages deploy
- [ ] R3.3 Fix CQ-M1: Move hardcoded gameplay-tuning magic numbers in `PlayerBlob` to config
- [ ] R3.4 Fix CQ-M2: Consolidate duplicated combo-heat formulas under a single helper
- [ ] R3.5 Fix CQ-M3: Convert repetitive unsafe `zIndex` castings to clean tailwind classes
- [ ] R3.6 Fix CQ-M4: Secure `three-bvh-csg` hash clearing with an explicit GooCsg fixture test
- [ ] R3.7 Fix AR-M1: Clean up non-existent `src/systems/**` glob in `.claude/gates.json`
- [ ] R3.8 Fix SEC-L1: Gate `?dev` parameter DevHarness mounting on `import.meta.env.DEV` to prevent production cheating
- [ ] R3.9 Fix SEC-L3: Harden local storage deserialization with Zod schema validation
- [ ] R3.10 Fix other Low/Clean findings (CQ-L1, CQ-L2, CQ-L3, CQ-L4, PERF-M1, PERF-M2, DOC-L1)

### R4 Close-out
- [ ] R4.1 Full verification: pnpm typecheck && pnpm lint && pnpm test (+ test:browser where render/UI touched) && pnpm test:e2e
- [ ] R4.2 Verify the app RUNS (dev server + screenshot read)
- [ ] R4.3 Update docs/CHANGELOG for any behavior/architecture changes made during remediation
- [ ] R4.4 Open the PR once green; address remote feedback; resolve threads; squash-merge

## Notes
- The R1/R2/R3 items are derived directly from the Phase 5 consolidated audit report (`05-final-report.md`).
- All remediation work must layer as forward commits on the branch `review/full-codebase-audit`.
