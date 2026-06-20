/**
 * Shared set of collected crystal INDICES (position in the world store's `crystals` array).
 * CrystalField owns collection and records each gathered crystal's index here; TreasureChests
 * reads it so a collected treasure doesn't leave a ghost chest hovering at the empty spot. Reset
 * on a new run (the crystals array identity changes). Dev/runtime bridge — no DOM, no three.
 */
const collected = new Set<number>();

/** Mark a crystal (by its index in the world store's crystals array) as collected. */
export function markCrystalCollected(index: number): void {
  collected.add(index);
}

/** Whether a crystal index has already been collected. */
export function isCrystalCollected(index: number): boolean {
  return collected.has(index);
}

/** Clear all collected indices — called on a world reset so a new run starts fresh. */
export function resetCollectedCrystals(): void {
  collected.clear();
}
