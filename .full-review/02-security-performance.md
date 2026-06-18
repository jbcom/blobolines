# Phase 2: Security & Performance Review

**Scope:** entire blobolines codebase (~16.4k LOC TS/TSX, 231 files).
Raw outputs: `raw-2a-security.md`, `raw-2b-performance.md`.

## Overall verdict
The codebase is **highly secure and defensively designed**, with a very narrow attack surface since it operates entirely client-side (no auth, no backend, no dynamic SQL/NoSQL). **Zero Critical or High security findings.**
Performance-wise, the game holds to solid standards, but is constrained by **heavy CPU and GPU hot-path pressure** within its procedural CSG geometry pipeline and monolithic game loops. High findings concentrate in: (1) high memory and GC churn from per-frame CSG merges in `GooCsg.tsx` and (2) a monolithic, un-time-sliced ~300-line `useFrame` callback in `PlayerBlob.tsx`.

---

## Security Findings (2A)

### Medium
- **SEC-M1** — **No CSP / security headers on GitHub Pages deploy**: The Pages deploy currently lacks any Content Security Policy (CSP). While the risk is low, implementing a meta CSP (with `script-src 'self' 'wasm-unsafe-eval'` for Rapier WASM, `worker-src 'self' blob:`, etc.) provides defense-in-depth against future injection/XSS regressions.

### Low
- **SEC-L1** — **Dev harness reachable in production via `?dev`**: The `?dev` query parameter is not gated on the build environment, allowing end-users to mount and interact with the full developer harness (cheating/forcing phases) in production. Gate this on `import.meta.env.DEV`.
- **SEC-L3** — **Unvalidated persisted game state deserialization**: Storage values are parsed and hydrated into the game state and audio engine without schema validation. Hardening storage retrieval via `zod` prevents potential NaN/crashes from modified or corrupted storage.

---

## Performance Findings (2B)

### High
- **PERF-H1** — **Per-frame CSG union & geometry disposal in `GooCsg.tsx`**: Rendering the procedural goo metaballs requires real-time Constructive Solid Geometry (CSG) additions every frame. Despite a ping-pong buffer system, `three-bvh-csg`'s `evaluate()` allocates fresh `BufferGeometry` instances, putting intense pressure on the garbage collector. This causes visible frame-rate stutters on mid-tier mobile devices.
- **PERF-H2** — **Monolithic per-frame logic in `PlayerBlob.tsx`**: The main physics step runs in a ~300-line single monolithic loop. Powerups, hazards, steering, collision, and telemetry are all tightly coupled, preventing selective sub-system throttling or simple unit testing of physics sub-steps.

### Medium
- **PERF-M1** — **Wasted per-frame write overhead to vestigial Koota ECS**: Updating the Koota ECS traits (`Transform`/`Velocity`/`Blob`) on every frame represents wasted work, as no production gameplay systems actually query these traits (as highlighted in AR-H1).
- **PERF-M2** — **High-frequency diagnostic state fan-out**: `getBlobDiagnostics()` feeds telemetry to 26 consumers. Consumers must be carefully audited to ensure they use pull-based ref lookups or three.js loops rather than React's `useState` subscriptions, which would trigger 60–120 DOM reconciliations per second.

### Low
- **PERF-L1** — **Garbage collection pressure from array/vector allocations in frame loops**: Small array spreads, math allocations, and vector instantiations are performed inside active frame loops, adding cumulative GC pressure over long sessions.
- **PERF-L2** — **Lack of dynamic low-FPS quality throttling**: The game does not actively monitor FPS to dynamically drop quality tiers (e.g., lowering `maxMerges` or disabling expensive refraction) when performance degrades.

---

## Invariants verified
- No backend/auth exposure **HOLDS** · Pnpm audit clean **HOLDS** · Safe local credentials (gitignored `.env`) **HOLDS** · No dangerouslySetInnerHTML/eval **HOLDS** · Safe Capacitor native bridge **HOLDS** · Proper geometry disposal **PARTIAL** (does not leak, but high GC churn).

---

## Critical Issues for Phase 3 Context
- **Testing focus for Phase 3:** Ensure coverage for CSG rendering reliability and asset pre-rendering (since fallback geometry does not exist). Ensure e2e tests cover storage verification, and validation of simulated lag (confirming physics don't break when frames are skipped or delayed).
- **Documentation focus for Phase 3:** Clearly document the performance boundaries of CSG, the architectural decision on Koota ECS (to either commit to it or remove it), and the intended usage pattern for state bridges vs. direct high-frequency diagnostic refs.
