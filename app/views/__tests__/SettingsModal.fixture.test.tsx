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

// a11y: the Radix Slider/Switch controls must carry programmatic accessible names
// (the visible <span> labels aren't tied to the controls otherwise).
test("SettingsModal controls have accessible names", async () => {
  const screen = await render(<SettingsModal open onOpenChange={() => {}} />);
  await expect.element(screen.getByTestId("settings")).toBeVisible();
  await expect.element(screen.getByRole("slider", { name: "Master volume" })).toBeInTheDocument();
  await expect.element(screen.getByRole("slider", { name: "SFX volume" })).toBeInTheDocument();
  await expect
    .element(screen.getByRole("slider", { name: "Slingshot sensitivity" }))
    .toBeInTheDocument();
  await expect.element(screen.getByRole("switch", { name: "Music" })).toBeInTheDocument();
  await expect
    .element(screen.getByRole("switch", { name: "Haptics (mobile)" }))
    .toBeInTheDocument();
  await expect.element(screen.getByRole("switch", { name: "Reduce motion" })).toBeInTheDocument();
});
