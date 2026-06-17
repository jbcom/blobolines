import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { activatePowerup, resetPowerups } from "@/state";
import { PowerUpBadges } from "../PowerUpBadges";

afterEach(() => {
  cleanup();
  resetPowerups();
});

test("shows no badges when no power-up is active", async () => {
  resetPowerups();
  const screen = await render(<PowerUpBadges />);
  await expect.element(screen.getByText("Magnet").query()).not.toBeInTheDocument();
  await expect.element(screen.getByText("Thrust").query()).not.toBeInTheDocument();
});

test("mounts the magnet badge with its countdown bar when active", async () => {
  activatePowerup("magnet");
  const screen = await render(<PowerUpBadges />);
  await expect.element(screen.getByText("Magnet")).toBeInTheDocument();
});

test("mounts the slow-mo badge when the bullet-time buff is active", async () => {
  activatePowerup("slowmo");
  const screen = await render(<PowerUpBadges />);
  await expect.element(screen.getByText("Slow-Mo")).toBeInTheDocument();
});

test("mounts the score-doubler badge when the 2× buff is active", async () => {
  activatePowerup("doubler");
  const screen = await render(<PowerUpBadges />);
  await expect.element(screen.getByText("2× Score")).toBeInTheDocument();
});
