import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { useGameStore } from "@/state";
import { MilestoneBanner } from "../MilestoneBanner";

// Edge-triggered 100m celebration: it must fire once when the blob crosses a new 100m
// band while playing, and stay silent below the first milestone.
beforeEach(() => {
  useGameStore.setState({ phase: "playing", run: { ...useGameStore.getState().run, height: 0 } });
});
afterEach(() => {
  cleanup();
  useGameStore.setState({ phase: "menu" });
});

test("pops the milestone banner when the blob crosses 100m", async () => {
  const screen = await render(<MilestoneBanner />);
  // Below the first milestone: nothing shown.
  await expect.element(screen.getByText("New height!").query()).not.toBeInTheDocument();

  // Cross 100m → the banner appears with the milestone value.
  useGameStore.setState((s) => ({ run: { ...s.run, height: 104 } }));
  await expect.element(screen.getByText("New height!")).toBeInTheDocument();
  await expect.element(screen.getByText("100")).toBeInTheDocument();
});

test("does not celebrate before the first 100m", async () => {
  const screen = await render(<MilestoneBanner />);
  useGameStore.setState((s) => ({ run: { ...s.run, height: 80 } }));
  await expect.element(screen.getByText("New height!").query()).not.toBeInTheDocument();
});

test("escalates the banner LABEL at a high milestone tier (2000m → Mega height!)", async () => {
  const screen = await render(<MilestoneBanner />);
  // Cross a top-tier milestone (2000m). The banner must read the ESCALATED label, not the base one —
  // the visual matching the audio stinger's mega tier.
  useGameStore.setState((s) => ({ run: { ...s.run, height: 2010 } }));
  await expect.element(screen.getByText("Mega height!")).toBeInTheDocument();
  await expect.element(screen.getByText("2000")).toBeInTheDocument();
  // The base-tier label must NOT show for a top-tier crossing.
  await expect.element(screen.getByText("New height!").query()).not.toBeInTheDocument();
});
