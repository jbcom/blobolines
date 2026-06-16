import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { SettingsModal } from "../SettingsModal";

// Guards the settings modal renders open with its controls (same Dialog-animation
// regression class as the customizer).
test("SettingsModal renders open with its controls", async () => {
  const screen = await render(<SettingsModal open onOpenChange={() => {}} />);

  await expect.element(screen.getByTestId("settings")).toBeVisible();
  // Heading role disambiguates from the Radix sr-only Title/Description (also "Settings").
  await expect.element(screen.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect.element(screen.getByText("Master volume")).toBeVisible();
  await expect.element(screen.getByText("Music")).toBeVisible();
});
