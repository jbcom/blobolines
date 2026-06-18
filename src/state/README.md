# `src/state` — stores, persistence, and the imperative bridges

The single source of truth for game state, plus the **imperative bridges** that let
the 60fps render/physics loop talk to React without re-rendering every frame.

## Files

| File | Owns |
|------|------|
| `store.ts` | `useGameStore` (zustand) — phase (menu/playing/gameover), settings, progress (best height, crystals, unlocked skins), and the live `run` (height/crystals/combo). The UI subscribes here. |
| `worldStore.ts` | `useWorldStore` — the generated tower (cloud pads/crystals/powerups) and `ensureHeight` to extend it as the blob climbs. Pads carry a stable `id`. |
| `persistence.ts` | Capacitor **Preferences** read/write of progress + settings (`hydrateStore`, `attachPersistence`). Not localStorage. |
| `diagnostics.ts` | `getBlobDiagnostics` / `setBlobDiagnostics` — a plain mutable object the physics loop writes each frame and the visual components read, so the blob's position/velocity/expression never flow through React state. |
| `launchBridge.ts` | `requestLaunch`/`consumeLaunch`, `setAirSteer`/`getAirSteer`, `reportImpact`/`consumeImpact`, `reportCloudAdherence`/`consumeCloudAdherence`, `reportRebound`/`consumeRebound` — one-shot mailboxes between input/cloud pads and the blob's frame loop. |
| `powerupBridge.ts` | `activatePowerup`/`tickPowerups`/`isPowerupActive`/`resetPowerups` — power-up timers ticked at frame cadence, off the React tree. |

## The bridge pattern (why it exists)

React state changes trigger re-renders; doing that 60×/s for blob position would
tank the frame rate. So the **simulation writes to plain refs/objects** (bridges +
diagnostics) and the render components read them inside their own `useFrame`. React
state is reserved for things that change at *human* cadence (phase, score, combo,
settings). When adding new per-frame data flow, extend a bridge — don't add a
zustand field the render loop writes every frame.

## Rules

- Reads outside React use `useGameStore.getState()` (the canonical zustand
  out-of-hook read) — valid inside `useFrame` / Rapier callbacks.
- Persistence is Capacitor Preferences, available on web + Android. No direct
  `localStorage`.

See [`docs/STATE.md`](../../docs/STATE.md) and [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
