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
