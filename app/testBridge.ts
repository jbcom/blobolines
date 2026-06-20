import { STARTER_BLOB_Y } from "@/sim/physics";
import {
  getBlobDiagnostics,
  type LaunchRequest,
  requestLaunch,
  useGameStore,
  useWorldStore,
} from "@/state";

/**
 * Headless E2E control surface. Playwright drives the game by clicking the DevHarness buttons,
 * but under CI's SwiftShader software GL a synthetic click on a GPU-saturated main thread can
 * stall indefinitely (the click action never settles) — making the E2E job flaky. This bridge
 * exposes the SAME store/launch operations the harness buttons invoke as plain function calls on
 * `window.__blobtest`, so specs drive the game via `page.evaluate(() => window.__blobtest.x())`
 * with no synthetic pointer events. It is mounted only under `import.meta.env.DEV` (the dev
 * server the E2E uses) — never in a production build — and reads exclusively from the documented
 * store/bridge, touching no three.js objects.
 */
export interface BlobTestBridge {
  /** Reset run + world and enter the playing phase (the "start run" harness action). */
  startRun(): void;
  /** Launch straight up at max charge once the blob has settled on the starter pad. Resolves
   *  when the launch impulse has been requested (mirrors the harness's requestLaunchWhenReady). */
  launchUp(): Promise<void>;
  /** Force the game-over phase (the "game over" harness action). */
  gameOver(): void;
  /** Current blob altitude (world Y) — what the altimeter HUD reads. */
  altitude(): number;
  /** Current game phase. */
  phase(): string;
}

function launchWhenReady(req: LaunchRequest, attempt = 0): Promise<void> {
  const ready =
    useGameStore.getState().phase === "playing" &&
    getBlobDiagnostics().position[1] >= STARTER_BLOB_Y * 0.7;
  if (ready || attempt >= 50) {
    requestLaunch(req);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    window.setTimeout(() => {
      void launchWhenReady(req, attempt + 1).then(resolve);
    }, 50);
  });
}

/** Install the test bridge on window under dev/test only. Idempotent. */
export function installTestBridge(): void {
  if (!import.meta.env.DEV) return;
  const bridge: BlobTestBridge = {
    startRun() {
      useGameStore.getState().resetRun();
      useWorldStore.getState().reset();
      useGameStore.getState().setPhase("playing");
    },
    launchUp() {
      return launchWhenReady({ dir: [0, 1, 0], charge: 1 });
    },
    gameOver() {
      useGameStore.getState().setPhase("gameover");
    },
    altitude() {
      return getBlobDiagnostics().position[1];
    },
    phase() {
      return useGameStore.getState().phase;
    },
  };
  (window as unknown as { __blobtest: BlobTestBridge }).__blobtest = bridge;
}
