import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { useGameStore } from "@/state";
import { BlobCustomizer } from "../BlobCustomizer";

beforeEach(() => {
  useGameStore.setState({
    progress: {
      ...useGameStore.getState().progress,
      crystals: 0,
      unlockedSkins: ["slime"],
    },
  });
});
afterEach(() => cleanup());

test("shows the empty-state nudge when no crystals and nothing unlocked yet", async () => {
  const screen = await render(<BlobCustomizer open onOpenChange={() => {}} />);
  await expect.element(screen.getByText(/Collect crystals on your climb/i)).toBeInTheDocument();
});

test("hides the empty-state nudge once the player has crystals", async () => {
  useGameStore.setState((s) => ({ progress: { ...s.progress, crystals: 20 } }));
  const screen = await render(<BlobCustomizer open onOpenChange={() => {}} />);
  await expect
    .element(screen.getByText(/Collect crystals on your climb/i).query())
    .not.toBeInTheDocument();
});
