import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { CrystalCounter } from "../CrystalCounter";
import { LaunchInput } from "../LaunchInput";

// a11y guards for the gameplay HUD. The 3D canvas is aria-hidden, so the DOM HUD is the
// accessible surface — these controls/readouts must carry programmatic names + roles.

// Unmount between tests so the full-screen LaunchInput region doesn't linger across the
// shared browser document and cause duplicate role matches.
afterEach(() => cleanup());

test("LaunchInput exposes the gameplay control as a labelled application region", async () => {
  const screen = await render(<LaunchInput />);
  await expect
    .element(screen.getByRole("application", { name: /drag back to aim/i }))
    .toBeInTheDocument();
});

test("CrystalCounter is a polite live region announcing via visible text content", async () => {
  const screen = await render(<CrystalCounter />);
  // role=status + aria-live=polite; the value lives in the region's TEXT (reliable to
  // announce), not in a mutating aria-label. The sr-only "crystals" gives it context.
  const status = screen.getByRole("status");
  await expect.element(status).toBeInTheDocument();
  await expect.element(status).toHaveAttribute("aria-live", "polite");
  await expect.element(status).not.toHaveAttribute("aria-label");
  await expect.element(status).toHaveTextContent(/crystals/);
});
