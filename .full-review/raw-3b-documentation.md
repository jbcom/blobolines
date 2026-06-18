# Phase 3B — Documentation Audit

**Scope:** full codebase. Repository documentation, markdown manuals, architectural guides, and inline code documentation/comments.
**Verdict:** High documentation hygiene with well-structured files (`ARCHITECTURE.md`, `TESTING.md`, `GAME-DESIGN.md`, `STANDARDS.md`). However, severe specification drift exists around Koota ECS, and the system lacks guidelines on state partitioning rules and high-frequency telemetry.

| Severity | Count | Findings |
|---|---|---|
| Critical | 0 | — |
| High | 1 | DOC-H1: Architectural spec-drift regarding Koota ECS |
| Medium | 1 | DOC-M1: No partition guidelines for state management channels |
| Low | 1 | DOC-L1: Stale "Dev tooling only" tag on `diagnostics.ts` |

---

## High

### DOC-H1 — Architectural spec-drift regarding Koota ECS
- **Location:** `docs/ARCHITECTURE.md:43-45`, comments in `src/sim/blob/entitySync.ts`, `app/scene/blob/PlayerBlob.tsx`
- **Details:** The primary technical documentation (`ARCHITECTURE.md`) and several load-bearing file comments assert that Koota ECS is the "queryable source of truth" for the blob entity and other gameplay elements. In reality, the ECS is totally vestigial:
  - There are no gameplay systems reading or querying ECS traits in production.
  - Telemetry and rendering depend almost exclusively on the Zustand `useWorldStore` and `getBlobDiagnostics()` state bridges.
  - This spec-drift is highly misleading to new developers, suggesting a core architectural dependency that does not exist in practice.
- **Recommended Fix:** 
  1. Update `ARCHITECTURE.md` to reflect the actual architecture, clarifying that Zustand and state bridges handle production state while ECS is currently vestigial/unwired.
  2. Clearly document the proposed path (either commit to fully wiring the game through ECS or remove it completely to satisfy the "no dead libraries" policy).

---

## Medium

### DOC-M1 — No partition guidelines for state management channels
- **Location:** `docs/ARCHITECTURE.md`, `src/state/README.md`
- **Details:** The game's state is partitioned across 5 distinct channels: two Zustand stores (`useGameStore` for overall state and settings, `useWorldStore` for trampolines and layout), plus several manual transient state bridges/bridges (such as `launchBridge`, `powerupBridge`, and `routeFeedbackBridge`).
  - There is currently no documented design pattern, flowchart, or boundary rule explaining *when* a developer should use a Zustand store versus a state bridge versus high-frequency telemetry.
  - This lack of architectural partitioning rules invites "bridge creep" where developers create redundant, ad-hoc state channels for every new visual effect.
- **Recommended Fix:** Document a state partitioning matrix in `ARCHITECTURE.md` or a new `src/state/README.md` specifying the roles, update frequencies, and subscription guidelines for each channel.

---

## Low

### DOC-L1 — Stale "Dev tooling only" tag on `diagnostics.ts`
- **Location:** `src/state/diagnostics.ts:6`
- **Details:** The header comments on `diagnostics.ts` describe it as a bridge for "dev tooling and diagnostics only". However, this file is actually the core production communication pipe that feeds telemetry to 26 visual and postfx consumers (e.g., trail particles, speed-reactive chromatic aberration, etc.).
- **Recommended Fix:** Update the comments to accurately reflect its status as a critical, high-frequency production visual bridge, rather than dev-only diagnostics.
