import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { DEFAULT_PROGRESS, useGameStore } from "@/state";
import { BlobCustomizer } from "../BlobCustomizer";

beforeEach(() => {
  // Reset the full progress object (not a merge) so state can't leak between tests.
  useGameStore.setState({ progress: { ...DEFAULT_PROGRESS } });
});
afterEach(() => cleanup());

test("a locked, unaffordable tile shows how many more crystals are needed", async () => {
  // Berry costs 15; with 10 the player needs 5 more.
  useGameStore.setState((s) => ({ progress: { ...s.progress, crystals: 10 } }));
  const screen = await render(<BlobCustomizer open onOpenChange={() => {}} />);
  await expect.element(screen.getByText("need 5 more")).toBeInTheDocument();
});

test("a locked but affordable tile shows an Unlock affordance", async () => {
  useGameStore.setState((s) => ({ progress: { ...s.progress, crystals: 100 } }));
  const screen = await render(<BlobCustomizer open onOpenChange={() => {}} />);
  // At least one locked tile is now affordable → shows "Unlock".
  await expect.element(screen.getByText("Unlock").first()).toBeInTheDocument();
});

test("the aurora reward skin renders as an achievement-gated Earn tile (Faithful)", async () => {
  // Aurora is earned by the 7-day Faithful streak, never bought — its tile must show the Earn path
  // with the gating achievement's title, not a crystal price (even with crystals to spare).
  useGameStore.setState((s) => ({ progress: { ...s.progress, crystals: 9999 } }));
  const screen = await render(<BlobCustomizer open onOpenChange={() => {}} />);
  await expect.element(screen.getByText("Aurora")).toBeInTheDocument();
  await expect.element(screen.getByText("Faithful")).toBeInTheDocument();
});

test("an UNLOCKED aurora tile equips on tap (no crystal price)", async () => {
  useGameStore.setState((s) => ({
    progress: { ...s.progress, unlockedSkins: [...s.progress.unlockedSkins, "aurora"] },
  }));
  const screen = await render(<BlobCustomizer open onOpenChange={() => {}} />);
  await screen.getByLabelText(/^Aurora — equip$/).click();
  expect(useGameStore.getState().progress.skin).toBe("aurora");
});
