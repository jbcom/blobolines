import { Dialog } from "@app/components/ui";
import { Check, Gem, Lock } from "lucide-react";
import type { BlobSkin } from "@/core/types";
import { SKIN_COST, useGameStore } from "@/state";
import { palette } from "@/styles/tokens";

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
        <span className="flex items-center gap-1 font-display text-sm text-blob-blue">
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

      <div className="mt-4 grid grid-cols-2 gap-3">
        {SKINS.map((s) => {
          const isUnlocked = unlocked.includes(s.id);
          const isEquipped = equipped === s.id;
          const cost = SKIN_COST[s.id];
          const affordable = crystals >= cost;
          return (
            <button
              key={s.id}
              type="button"
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
              <span
                aria-hidden
                className="size-12 rounded-full shadow-[var(--shadow-sm)]"
                style={{ backgroundColor: palette.blob[s.id] }}
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
                <span
                  aria-hidden
                  className="flex items-center gap-1 font-ui text-[11px] font-bold text-blob-blue"
                >
                  {affordable ? <Gem className="size-3" /> : <Lock className="size-3" />} {cost}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="mt-5 w-full rounded-xl bg-accent py-2.5 font-display font-bold uppercase tracking-wider text-bg"
      >
        Done
      </button>
    </Dialog>
  );
}
