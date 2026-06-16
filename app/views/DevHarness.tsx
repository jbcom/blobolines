import { useState } from "react";
import type { BlobSkin } from "@/core/types";
import { getBlobDiagnostics, requestLaunch, useGameStore, useWorldStore } from "@/state";

/**
 * Dev harness overlay — manual triggers for blob events so gameplay can be exercised
 * and screenshot-proven without real drag gestures. Only mounts in dev (import.meta.env
 * .DEV) or when `?dev` is in the URL. Toggle with the floating "DEV" button.
 *
 * Triggers: launch presets (straight up / angled / mega), set eye expression, jump the
 * altitude, set skin, and force game-over.
 */

const isDev =
  import.meta.env.DEV ||
  (typeof location !== "undefined" && new URLSearchParams(location.search).has("dev"));

const SKINS: BlobSkin[] = ["blue", "slime", "ghost", "ink"];

export function DevHarness() {
  const [open, setOpen] = useState(false);
  const setPhase = useGameStore((s) => s.setPhase);
  const setSkin = useGameStore((s) => s.setSkin);
  const setRun = useGameStore((s) => s.setRun);
  const resetRun = useGameStore((s) => s.resetRun);
  const resetWorld = useWorldStore((s) => s.reset);

  if (!isDev) return null;

  const startRun = () => {
    resetRun();
    resetWorld();
    setPhase("playing");
  };

  const norm = (v: readonly [number, number, number]) => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l] as const;
  };

  /** Snapshot of the whole environment + blob, for before/after diagnostics. */
  const envSnapshot = () => {
    const g = useGameStore.getState();
    const w = useWorldStore.getState();
    return {
      phase: g.phase,
      run: g.run,
      skin: g.progress.skin,
      bestHeight: g.progress.bestHeight,
      trampolineCount: w.trampolines.length,
      highestGeneratedY: w.highestY,
      blob: getBlobDiagnostics(),
    };
  };

  const post = (path: string, body: unknown) =>
    fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});

  /**
   * Fire an event, then after a settle delay write BOTH a screenshot (scene only — the
   * DOM harness/HUD are not in the canvas) and a before/after diagnostics JSON into the
   * gitignored `artifacts/` dir via the dev capture middleware. Lets the build agent see
   * exactly how the event changed the blob + environment without timing anything.
   */
  const fire = (label: string, action: () => void, delayMs = 600) => {
    const before = envSnapshot();
    action();
    setTimeout(() => {
      const after = envSnapshot();
      // Diagnostics first + independent, so a canvas-read failure can't suppress it.
      void post("/__diagnostics", { label, before, after });
      requestAnimationFrame(() => {
        try {
          const canvas = document.querySelector("canvas");
          if (canvas) void post("/__capture", { label, dataUrl: canvas.toDataURL("image/png") });
        } catch {
          /* canvas read can fail on some GL configs; diagnostics already sent */
        }
      });
    }, delayMs);
  };

  return (
    <div className="pointer-events-auto absolute right-2 bottom-2 z-[60] font-ui text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md bg-black/60 px-2 py-1 font-bold text-white/80"
      >
        DEV
      </button>
      {open && (
        <div className="mt-2 flex w-44 flex-col gap-1.5 rounded-lg border border-white/20 bg-black/80 p-2 text-white/90">
          <button type="button" className={btn} onClick={() => fire("start", startRun, 900)}>
            ▶ start run 📸
          </button>
          <button
            type="button"
            className={btn}
            onClick={() =>
              fire("launch-up", () => requestLaunch({ dir: norm([0, 1, 0]), charge: 1 }))
            }
          >
            ⤒ launch up (max) 📸
          </button>
          <button
            type="button"
            className={btn}
            onClick={() =>
              fire("launch-angled", () => requestLaunch({ dir: norm([0.4, 1, 0]), charge: 0.7 }))
            }
          >
            ⤴ launch angled 📸
          </button>
          <button
            type="button"
            className={btn}
            onClick={() =>
              fire("alt+50", () => setRun({ height: useGameStore.getState().run.height + 50 }))
            }
          >
            + 50m altitude 📸
          </button>
          <div className="mt-1 text-[10px] text-white/50">skin (📸)</div>
          <div className="flex flex-wrap gap-1">
            {SKINS.map((s) => (
              <button
                key={s}
                type="button"
                className={chip}
                onClick={() => fire(`skin-${s}`, () => setSkin(s))}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={btn}
            onClick={() => fire("gameover", () => setPhase("gameover"))}
          >
            ✕ game over 📸
          </button>
        </div>
      )}
    </div>
  );
}

const btn = "rounded bg-white/10 px-2 py-1 text-left hover:bg-white/20";
const chip = "rounded bg-white/10 px-1.5 py-0.5 hover:bg-white/20";
