import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { LaunchInput } from "../LaunchInput";

afterEach(() => cleanup());

// At rest (no drag → charge 0) the launch surface shows neither the power bar nor the
// max-charge flourish. The "MAX!" flourish + edge glow only appear under a near-full
// charge, which is driven by a live drag gesture (exercised in e2e, not here).
test("renders the launch surface with no power UI at rest", async () => {
  const screen = await render(<LaunchInput />);
  await expect
    .element(screen.getByRole("application", { name: /drag back to aim/i }))
    .toBeInTheDocument();
  await expect.element(screen.getByText("Max!").query()).not.toBeInTheDocument();
  await expect.element(screen.getByRole("progressbar").query()).not.toBeInTheDocument();
});
