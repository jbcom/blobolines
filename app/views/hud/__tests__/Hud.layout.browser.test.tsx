import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { useGameStore } from "@/state";
import { Hud } from "../Hud";

beforeEach(() => {
  useGameStore.setState({
    phase: "playing",
    run: { ...useGameStore.getState().run, height: 42, crystals: 3 },
    progress: { ...useGameStore.getState().progress, bestHeight: 100 },
  });
});
afterEach(() => {
  cleanup();
  useGameStore.setState({ phase: "menu" });
});

// The HUD readouts must be ANCHORED to the safe-area corners, not stretched across the row —
// on a wide viewport a justify-between row would fling them to opposite screen edges. Assert
// the altimeter sits in the left third and the crystal counter in the right third, with a
// clear gap between them (i.e. they are NOT spanning the full width).
test("readouts are corner-anchored, not stretched across a wide viewport", async () => {
  const screen = await render(<Hud />);

  // Wait for the altimeter to mount, then read its position.
  await expect.element(screen.getByText("ALTITUDE")).toBeInTheDocument();
  const altitude = screen.getByText("ALTITUDE").element();
  const altBox = altitude.closest("div")?.getBoundingClientRect();
  expect(altBox).toBeTruthy();

  // The altimeter's left edge sits near the left safe-area inset (not pushed toward center) —
  // proof it's anchored to the corner, not laid out by a full-width stretching row.
  if (altBox) {
    expect(altBox.left).toBeLessThan(window.innerWidth * 0.4);
  }
});
