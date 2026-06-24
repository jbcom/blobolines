import { afterEach, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { DEFAULT_SETTINGS, useGameStore } from "@/state";
import { SettingsModal } from "../SettingsModal";

afterEach(() => {
  useGameStore.setState({ settings: { ...DEFAULT_SETTINGS } });
  delete document.documentElement.dataset.highContrast;
});

// Guards the settings modal renders open with its controls (same Dialog-animation
// regression class as the customizer).
test("SettingsModal renders open with its controls", async () => {
  const screen = await render(<SettingsModal open onOpenChange={() => {}} />);

  await expect.element(screen.getByTestId("settings")).toBeVisible();
  // Heading role disambiguates from the Radix sr-only Title/Description (also "Settings").
  await expect.element(screen.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect.element(screen.getByText("Master volume")).toBeVisible();
  // exact: disambiguate the "Music" toggle label from the "Music volume" slider row.
  await expect.element(screen.getByText("Music", { exact: true })).toBeVisible();
});

// a11y: the Radix Slider/Switch controls must carry programmatic accessible names
// (the visible <span> labels aren't tied to the controls otherwise).
test("SettingsModal controls have accessible names", async () => {
  const screen = await render(<SettingsModal open onOpenChange={() => {}} />);
  await expect.element(screen.getByTestId("settings")).toBeVisible();
  await expect.element(screen.getByRole("slider", { name: "Master volume" })).toBeInTheDocument();
  await expect.element(screen.getByRole("slider", { name: "SFX volume" })).toBeInTheDocument();
  // The three independent mix buses each get a slider.
  await expect.element(screen.getByRole("slider", { name: "Music volume" })).toBeInTheDocument();
  await expect.element(screen.getByRole("slider", { name: "Ambience volume" })).toBeInTheDocument();
  await expect.element(screen.getByRole("slider", { name: "Charge speed" })).toBeInTheDocument();
  await expect.element(screen.getByRole("switch", { name: "Music" })).toBeInTheDocument();
  await expect.element(screen.getByRole("switch", { name: "Reduce motion" })).toBeInTheDocument();
  await expect.element(screen.getByRole("switch", { name: "High contrast" })).toBeInTheDocument();
  // Haptics switch is intentionally gated to touch devices, so it's not asserted here.
});

// Short/landscape safety: the dialog caps to the safe viewport height and the inner panel
// scrolls internally, so a tall modal never overflows off a short screen.
test("dialog caps its height and scrolls its panel internally", async () => {
  const screen = await render(<SettingsModal open onOpenChange={() => {}} />);
  await expect.element(screen.getByTestId("settings")).toBeVisible();
  const content = screen.getByTestId("settings").element();
  // Content carries an inline max-height cap (the calc against the safe insets).
  expect((content as HTMLElement).style.maxHeight).toMatch(/calc\(/);
  // The inner panel is the scroll container (overflow-y auto).
  const panel = content.querySelector(".overflow-y-auto");
  expect(panel).toBeTruthy();
});

test("Graphics quality picker pins the tier in settings", async () => {
  const screen = await render(<SettingsModal open onOpenChange={() => {}} />);
  await expect.element(screen.getByTestId("settings")).toBeVisible();
  // Default is "auto".
  expect(useGameStore.getState().settings.qualityPref).toBe("auto");
  // Pin Low, then High — the setting follows each tap, and the active segment is aria-pressed.
  const low = screen.getByRole("button", { name: "Graphics quality: Low" });
  await low.click();
  expect(useGameStore.getState().settings.qualityPref).toBe("low");
  await expect.element(low).toHaveAttribute("aria-pressed", "true");
  const high = screen.getByRole("button", { name: "Graphics quality: High" });
  await high.click();
  expect(useGameStore.getState().settings.qualityPref).toBe("high");
});

test("Reduce motion switch updates the app setting", async () => {
  const screen = await render(<SettingsModal open onOpenChange={() => {}} />);
  const reduceMotion = screen.getByRole("switch", { name: "Reduce motion" });
  expect(useGameStore.getState().settings.reducedMotion).toBe(false);
  await reduceMotion.click();
  expect(useGameStore.getState().settings.reducedMotion).toBe(true);
  await expect.element(reduceMotion).toHaveAttribute("aria-checked", "true");
});

test("High contrast switch updates the app setting", async () => {
  const screen = await render(<SettingsModal open onOpenChange={() => {}} />);
  const highContrast = screen.getByRole("switch", { name: "High contrast" });
  expect(useGameStore.getState().settings.highContrast).toBe(false);
  await highContrast.click();
  expect(useGameStore.getState().settings.highContrast).toBe(true);
  await expect.element(highContrast).toHaveAttribute("aria-checked", "true");
});

test("Reset progress requires a two-step confirm", async () => {
  const screen = await render(<SettingsModal open onOpenChange={() => {}} />);
  const btn = screen.getByRole("button", { name: "Reset" });
  await expect.element(btn).toBeInTheDocument();
  await btn.click();
  // After the first tap it arms — the label flips to a confirm prompt.
  await expect.element(screen.getByRole("button", { name: /tap to confirm/i })).toBeInTheDocument();
});
