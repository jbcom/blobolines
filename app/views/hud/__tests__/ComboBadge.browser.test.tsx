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

test("escalates to the top 'BLAZING' tier at 10× (the raised combo ceiling)", async () => {
  useGameStore.setState((s) => ({ run: { ...s.run, combo: 11 } }));
  const screen = await render(<ComboBadge />);
  await expect.element(screen.getByText("BLAZING", { exact: true })).toBeInTheDocument();
});
