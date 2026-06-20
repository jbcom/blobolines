import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { useGameStore } from "@/state";
import { ComboBadge } from "../ComboBadge";

beforeEach(() => {
  useGameStore.setState({ run: { ...useGameStore.getState().run, combo: 0 } });
});
afterEach(() => cleanup());

test("stays hidden below a 2× streak", async () => {
  useGameStore.setState((s) => ({ run: { ...s.run, combo: 1 } }));
  const screen = await render(<ComboBadge />);
  await expect.element(screen.getByText(/clean combo/i).query()).not.toBeInTheDocument();
});

test("shows the gold 'Clean combo' tier on a small streak", async () => {
  useGameStore.setState((s) => ({ run: { ...s.run, combo: 3 } }));
  const screen = await render(<ComboBadge />);
  // exact match selects the visible label span, not the sr-only "Clean combo N times".
  await expect.element(screen.getByText("Clean combo", { exact: true })).toBeInTheDocument();
});

test("escalates to 'ON FIRE' at 5×", async () => {
  useGameStore.setState((s) => ({ run: { ...s.run, combo: 5 } }));
  const screen = await render(<ComboBadge />);
  await expect.element(screen.getByText("ON FIRE", { exact: true })).toBeInTheDocument();
});

test("the top 'BLAZING' tier kicks in EXACTLY at the 10× threshold, not at 9×", async () => {
  // 9× is still the prior "ON FIRE" tier; 10× is the BLAZING boundary (the new top tier the raised
  // combo ceiling unlocks). Test the exact boundary, not an interior value.
  useGameStore.setState((s) => ({ run: { ...s.run, combo: 9 } }));
  const below = await render(<ComboBadge />);
  await expect.element(below.getByText("ON FIRE", { exact: true })).toBeInTheDocument();
  await expect.element(below.getByText("BLAZING", { exact: true }).query()).not.toBeInTheDocument();
  cleanup();

  useGameStore.setState((s) => ({ run: { ...s.run, combo: 10 } }));
  const at = await render(<ComboBadge />);
  await expect.element(at.getByText("BLAZING", { exact: true })).toBeInTheDocument();
});
