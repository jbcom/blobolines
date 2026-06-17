import { Button, Dialog } from "@app/components/ui";
import { usePunchOnChange } from "@app/hooks";
import { Check, Gem, Lock } from "lucide-react";
import { useRef, useState } from "react";
import type { BlobSkin } from "@/core/types";
import { SKIN_COST, useGameStore } from "@/state";
import { mixHex, palette } from "@/styles/tokens";

/** Columns in the skin grid — used for arrow-key (and gamepad d-pad → arrow) roving nav. */
const GRID_COLS = 2;

/**
 * Blob customizer — pick or unlock a goo skin with collected crystals. Equipped skins
 * apply immediately (the goo body reads `progress.skin`). Reachable from the title.
 */
const SKINS: { id: BlobSkin; name: string }[] = [
  { id: "blue", name: "Bloop" },
  { id: "slime", name: "Slime" },
  { id: "ghost", name: "Ghost" },
  { id: "ink", name: "Ink" },
];

export function BlobCustomizer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const crystals = useGameStore((s) => s.progress.crystals);
  const equipped = useGameStore((s) => s.progress.skin);
  const unlocked = useGameStore((s) => s.progress.unlockedSkins);
  const setSkin = useGameStore((s) => s.setSkin);
  const unlockSkin = useGameStore((s) => s.unlockSkin);
  const addCrystals = useGameStore((s) => s.addCrystals);
  // Punch the header gem count whenever crystals change (the deduct on a purchase reads as
  // a satisfying kick rather than a silent number swap).
  const gemRef = usePunchOnChange<HTMLSpanElement>(crystals, { scale: 1.3 });

  // Roving-tabindex grid nav: one tile is in the tab order at a time; arrow keys (and a
  // gamepad d-pad, which most browsers map to arrows) move focus across the 2-col grid.
  const [focusIdx, setFocusIdx] = useState(0);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const onGridKey = (e: React.KeyboardEvent) => {
    const n = SKINS.length;
    // Derive the current index from the actually-focused tile (not React state, which may not
    // have flushed yet) so arrow nav is robust regardless of how focus arrived.
    const cur = tileRefs.current.indexOf(document.activeElement as HTMLButtonElement);
    const from = cur >= 0 ? cur : focusIdx;
    let next: number;
    if (e.key === "ArrowRight") next = (from + 1) % n;
    else if (e.key === "ArrowLeft") next = (from - 1 + n) % n;
    else if (e.key === "ArrowDown") next = Math.min(from + GRID_COLS, n - 1);
    else if (e.key === "ArrowUp") next = Math.max(from - GRID_COLS, 0);
    else return; // not an arrow key — next is only assigned in the arrow branches above
    e.preventDefault();
    setFocusIdx(next);
    tileRefs.current[next]?.focus();
  };

  const pick = (id: BlobSkin) => {
    if (unlocked.includes(id)) {
      setSkin(id);
      return;
    }
    const cost = SKIN_COST[id];
    if (crystals >= cost) {
      addCrystals(-cost);
      unlockSkin(id);
      setSkin(id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} ariaLabel="Blob customizer" testId="customizer">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-cream">Goo Customizer</h2>
        <span ref={gemRef} className="flex items-center gap-1 font-display text-sm text-blob-blue">
          <Gem className="size-4" strokeWidth={2.5} aria-hidden /> {crystals}
          <span className="sr-only"> crystals available</span>
        </span>
      </div>
      <p className="mt-1 font-ui text-xs text-fg-subtle">
        Spend crystals collected on the climb to unlock new goo.
      </p>

      {/* Empty state — no crystals AND nothing unlocked beyond the starter skin: nudge the
          player toward the loop that earns unlocks rather than showing only locked tiles. */}
      {crystals === 0 && unlocked.length <= 1 && (
        <p className="mt-3 rounded-lg border border-border/60 border-dashed bg-bg/40 px-3 py-2 text-center font-ui text-xs text-fg-muted">
          💎 Collect crystals on your climb to unlock new goo.
        </p>
      )}

      {/* biome-ignore lint/a11y/useSemanticElements: grid wrapper for roving-tabindex skin tiles (children are buttons) */}
      <div
        className="mt-4 grid grid-cols-2 gap-3"
        role="grid"
        aria-label="Goo skins"
        onKeyDown={onGridKey}
      >
        {SKINS.map((s, i) => {
          const isUnlocked = unlocked.includes(s.id);
          const isEquipped = equipped === s.id;
          const cost = SKIN_COST[s.id];
          const affordable = crystals >= cost;
          return (
            <button
              key={s.id}
              ref={(el) => {
                tileRefs.current[i] = el;
              }}
              type="button"
              tabIndex={i === focusIdx ? 0 : -1}
              onFocus={() => setFocusIdx(i)}
              onClick={() => pick(s.id)}
              disabled={!isUnlocked && !affordable}
              aria-pressed={isEquipped}
              aria-label={`${s.name} — ${
                isEquipped
                  ? "equipped"
                  : isUnlocked
                    ? "equip"
                    : affordable
                      ? `unlock for ${cost} crystals`
                      : `locked, needs ${cost} crystals`
              }`}
              className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors ${
                isEquipped
                  ? "border-accent bg-accent/10"
                  : "border-border bg-surface hover:border-border-strong"
              } ${!isUnlocked && !affordable ? "opacity-50" : ""}`}
            >
              {/* Wet-goo preview swatch: a radial gradient + glossy highlight that reads as
                  a 3D goo droplet (not a flat disc), tinted to the skin — cheaper than 4
                  live WebGL canvases on mobile but conveys the gooey material per skin.
                  Highlight + shade derive from palette tokens (no raw hex, brand gate). */}
              <span
                aria-hidden
                className="size-12 rounded-full shadow-[var(--shadow-sm)]"
                style={{
                  background: `radial-gradient(circle at 35% 28%, ${palette.goo.wet} 0%, ${palette.blob[s.id]} 42%, ${mixHex(palette.blob[s.id], palette.blob.ink, 0.4)} 100%)`,
                }}
              />
              <span aria-hidden className="font-display text-sm font-bold text-cream">
                {s.name}
              </span>
              {isEquipped ? (
                <span
                  aria-hidden
                  className="flex items-center gap-1 font-ui text-[11px] font-bold text-accent"
                >
                  <Check className="size-3" /> Equipped
                </span>
              ) : isUnlocked ? (
                <span aria-hidden className="font-ui text-[11px] font-semibold text-fg-subtle">
                  Equip
                </span>
              ) : (
                <span aria-hidden className="flex w-full flex-col items-center gap-1">
                  <span
                    className={`flex items-center gap-1 font-ui text-[11px] font-bold ${
                      affordable ? "text-blob-blue" : "text-fg-subtle"
                    }`}
                  >
                    {affordable ? <Gem className="size-3" /> : <Lock className="size-3" />} {cost}
                  </span>
                  {affordable ? (
                    <span className="font-ui text-[10px] font-semibold text-blob-blue">Unlock</span>
                  ) : (
                    <>
                      {/* "need N more" + how close they are to affording it. */}
                      <span className="font-ui text-[10px] text-fg-subtle">
                        need {cost - crystals} more
                      </span>
                      <span className="h-1 w-full overflow-hidden rounded-full bg-bg/70">
                        <span
                          className="block h-full rounded-full bg-blob-blue/70"
                          // Clamp both ends: negative crystals (debug/state bugs) → 0%, not
                          // a negative width.
                          style={{
                            width: `${Math.max(0, Math.min(100, (crystals / cost) * 100))}%`,
                          }}
                        />
                      </span>
                    </>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Button cta size="lg" onClick={() => onOpenChange(false)} className="mt-5 w-full">
        Done
      </Button>
    </Dialog>
  );
}
