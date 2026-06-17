import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { clearRouteLandingFeedback, reportRouteLandingFeedback } from "@/state";
import { RouteLandingToast } from "../RouteLandingToast";

afterEach(() => {
  cleanup();
  clearRouteLandingFeedback();
});

test("shows route landing grade and style bonus, then clears", async () => {
  const screen = await render(<RouteLandingToast />);

  reportRouteLandingFeedback({
    quality: 0.93,
    bonus: 58,
    miss: 0.2,
    halfFootprint: 4,
    sourceMode: "canted",
    targetType: "moving",
  });

  await expect.element(screen.getByText("Perfect route")).toBeInTheDocument();
  await expect.element(screen.getByRole("status")).toHaveTextContent(/canted to moving/i);
  await expect.element(screen.getByRole("status")).toHaveTextContent(/\+58 style/i);

  await vi.waitFor(
    () => {
      expect(screen.getByText("Perfect route").query()).not.toBeInTheDocument();
    },
    { timeout: 2200, interval: 50 },
  );
});
