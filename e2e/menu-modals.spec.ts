import { expect, test } from "@playwright/test";

const DENSE_PROGRESS = {
  bestHeight: 1840,
  bestScore: 61230,
  crystals: 120,
  skin: "blue",
  unlockedSkins: ["blue"],
  tutorialSeen: true,
  steerTutorialSeen: true,
  unlockedAchievements: ["height-100", "combo-5"],
  dailyStreak: 2,
  lastDailyKey: "2026-06-23",
  dailyBests: {
    "2026-06-18": 9000,
    "2026-06-19": 11000,
    "2026-06-21": 18000,
    "2026-06-23": 24000,
  },
  highScores: Array.from({ length: 10 }, (_, i) => ({
    score: 65000 - i * 4200,
    height: 1800 - i * 110,
    crystals: 42 - i,
    maxCombo: Math.max(2, 12 - i),
    date: `2026-06-${String(24 - i).padStart(2, "0")}T12:00:00.000Z`,
    seedPhrase: `metty-golden-pebble-${i + 1}`,
    difficulty: ["ready", "medium", "hard", "blobmare"][i % 4],
  })),
};

const MOBILE_SETTINGS = {
  masterVolume: 0.8,
  sfxVolume: 0.9,
  musicVolume: 0.8,
  ambientVolume: 0.7,
  musicEnabled: true,
  chargeSensitivity: 1,
  haptics: true,
  reducedMotion: false,
  highContrast: false,
  qualityPref: "auto",
};

test.use({
  viewport: { width: 320, height: 700 },
  isMobile: true,
  hasTouch: true,
});

test("dense menu modals keep Done visible on a 320px phone", async ({ page }) => {
  await page.addInitScript(
    ({ progress, settings }) => {
      localStorage.setItem("CapacitorStorage.blobolines.progress", JSON.stringify(progress));
      localStorage.setItem("CapacitorStorage.blobolines.settings", JSON.stringify(settings));
    },
    { progress: DENSE_PROGRESS, settings: MOBILE_SETTINGS },
  );

  await page.goto("/?dev");
  await page.getByRole("button", { name: "Play", exact: true }).waitFor();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expectDoneInsideViewport(page, "settings");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Achievements", exact: true }).click();
  await page.getByRole("tab", { name: "Leaderboard" }).click();
  await expectDoneInsideViewport(page, "achievements-modal");
});

async function expectDoneInsideViewport(page: import("@playwright/test").Page, testId: string) {
  const dialog = page.getByTestId(testId);
  await expect(dialog).toBeVisible();
  const done = dialog.getByRole("button", { name: "Done" });
  await expect(done).toBeVisible();

  const doneBox = await done.boundingBox();
  expect(doneBox).not.toBeNull();
  expect(doneBox?.x).toBeGreaterThanOrEqual(0);
  expect((doneBox?.x ?? 0) + (doneBox?.width ?? 0)).toBeLessThanOrEqual(320);
  expect(doneBox?.y).toBeGreaterThanOrEqual(0);
  expect((doneBox?.y ?? 0) + (doneBox?.height ?? 0)).toBeLessThanOrEqual(700);

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(320);
}
