import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { DEFAULT_PROGRESS, useGameStore } from "@/state";
import { BlobCustomizer } from "../BlobCustomizer";

beforeEach(() => {
  // Unlock everything so every tile is focusable (locked-unaffordable tiles are disabled).
  useGameStore.setState({
    progress: {
      ...DEFAULT_PROGRESS,
      crystals: 999,
      unlockedSkins: ["blue", "slime", "ghost", "ink"],
    },
  });
});
afterEach(() => cleanup());

// Mobile is touch-first; this keyboard grid nav is a small desktop/a11y secondary. It uses
// roving tabindex (one tile in the tab order) + arrow keys to move focus across the 2×2 grid.
test("roving tabindex: exactly one skin tile is tabbable at a time", async () => {
  const screen = await render(<BlobCustomizer open onOpenChange={() => {}} />);
  const grid = screen.getByRole("grid", { name: /goo skins/i });
  await expect.element(grid).toBeInTheDocument();
  const tiles = grid.element().querySelectorAll('[role="grid"] button, button');
  const tabbable = [...grid.element().querySelectorAll("button")].filter(
    (b) => b.getAttribute("tabindex") === "0",
  );
  expect(tabbable.length).toBe(1);
  expect(tiles.length).toBeGreaterThanOrEqual(4);
});

test("ArrowRight moves the roving focus to the next tile", async () => {
  const screen = await render(<BlobCustomizer open onOpenChange={() => {}} />);
  const grid = screen.getByRole("grid", { name: /goo skins/i });
  const btns = [...grid.element().querySelectorAll("button")] as HTMLButtonElement[];
  btns[0].focus();
  expect(document.activeElement).toBe(btns[0]);
  grid.element().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  // Focus moved to the second tile immediately (native focus).
  expect(document.activeElement).toBe(btns[1]);
  // The roving tabindex follows on the next React render.
  await expect.poll(() => btns[1].getAttribute("tabindex")).toBe("0");
  expect(btns[0].getAttribute("tabindex")).toBe("-1");
});
