/**
 * DOM UI overlay root. Sits above the canvas (pointer-events none by default; child
 * controls opt back in). Hosts the title identity now; HUD, menus, and modals mount
 * here as their packages land. Reads game state via the store bridge — never touches
 * three objects directly.
 */
export function HudOverlay() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-end pb-[calc(var(--safe-bottom)+2rem)]">
      <h1 className="font-display text-hero font-bold tracking-tight text-cream drop-shadow-[0_4px_0_rgba(0,0,0,0.45)]">
        Blobolines
      </h1>
      <p className="mt-1 font-ui text-base text-fg-muted">
        Bounce a gooey blob up endless trampolines.
      </p>
    </div>
  );
}
