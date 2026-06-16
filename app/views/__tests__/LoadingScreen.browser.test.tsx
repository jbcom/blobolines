import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { LoadingScreen } from "../LoadingScreen";

afterEach(() => cleanup());

test("renders a determinate loading progressbar that advances", async () => {
  const screen = await render(<LoadingScreen />);
  const bar = screen.getByRole("progressbar", { name: /loading/i });
  await expect.element(bar).toBeInTheDocument();
  // It eases upward each frame and never claims completion (stays < 100 until unmount).
  await expect
    .poll(() => Number(bar.element().getAttribute("aria-valuenow")), { timeout: 2000 })
    .toBeGreaterThan(10);
  expect(Number(bar.element().getAttribute("aria-valuenow"))).toBeLessThan(100);
});
