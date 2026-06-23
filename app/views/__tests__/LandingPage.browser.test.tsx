import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { useGameStore, useWorldStore } from "@/state";
import { LandingPage } from "../LandingPage";

afterEach(() => {
  cleanup();
  useGameStore.setState({ phase: "menu", dailyRun: false });
  useWorldStore.getState().reset(1, "ready");
});

// The landing page is its OWN page (split out of the game canvas). It must carry the menu (Play
// CTA) and own its purple backdrop WITHOUT mounting any WebGL — these checks lock that contract so
// the page can't silently regress back into a canvas-dependent phase overlay.

test("renders the menu Play CTA (TitleScreen is hosted by the landing page)", async () => {
  const screen = await render(<LandingPage />);
  await expect.element(screen.getByRole("button", { name: /^Play/ })).toBeInTheDocument();
});

test("owns its purple backdrop and mounts no WebGL canvas", async () => {
  const screen = await render(<LandingPage />);
  // No <canvas> — the landing page is pure DOM so a low-end phone pays no renderer cost here.
  expect(screen.container.querySelector("canvas")).toBeNull();
  // The root carries the themed background surface (bg-bg → the designed plum `--bg`).
  const root = screen.container.firstElementChild as HTMLElement;
  expect(root.className).toContain("bg-bg");
});
