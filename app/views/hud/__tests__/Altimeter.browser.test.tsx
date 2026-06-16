import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { useGameStore } from "@/state";
import { Altimeter } from "../Altimeter";

beforeEach(() => {
  useGameStore.setState({
    phase: "playing",
    run: { ...useGameStore.getState().run, height: 0 },
    progress: { ...useGameStore.getState().progress, bestHeight: 50 },
  });
});
afterEach(() => {
  cleanup();
  useGameStore.setState({ phase: "menu" });
});

test("fires the NEW BEST flourish once the run passes the prior best", async () => {
  const screen = await render(<Altimeter />);
  // Below the prior best (50): no flourish.
  await expect.element(screen.getByText("New best!").query()).not.toBeInTheDocument();

  // Cross 50 → the flourish appears.
  useGameStore.setState((s) => ({ run: { ...s.run, height: 51 } }));
  await expect.element(screen.getByText("New best!")).toBeInTheDocument();
});
