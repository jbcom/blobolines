import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 320, height: 700 },
  isMobile: true,
  hasTouch: true,
});

test("dense game over keeps the score summary and replay actions visible on a 320px phone", async ({
  page,
}) => {
  await page.goto("/?dev");

  await page.evaluate(async () => {
    const store = await import("/src/state/store.ts");
    const world = await import("/src/state/worldStore.ts");
    const daily = await import("/src/sim/daily/daily.ts");
    const today = daily.dailySeedPhrase(new Date());
    const dailyScore = (score: number) => ({
      score,
      height: 0,
      crystals: 0,
      maxCombo: 0,
      date: "2026-06-24",
      seedPhrase: today,
      difficulty: "ready",
    });

    world.useWorldStore.setState({ seed: 12345, seedPhrase: today, difficulty: "ready" });
    store.useGameStore.setState({
      phase: "gameover",
      dailyRun: true,
      settings: { ...store.DEFAULT_SETTINGS, haptics: true },
      run: {
        height: 2500,
        crystals: 40,
        combo: 0,
        maxCombo: 12,
        recordDelta: 250,
        score: 65000,
        stylePoints: 0,
        scoreDelta: 15000,
        unlockedAchievements: [
          "height-100",
          "height-250",
          "height-500",
          "height-1000",
          "height-2000",
          "combo-5",
          "combo-8",
          "combo-12",
          "crystals-run-25",
          "score-10k",
          "score-25k",
          "daily-streak-3",
          "daily-streak-7",
        ],
        streakExtended: 7,
      },
      progress: {
        ...store.DEFAULT_PROGRESS,
        bestHeight: 2500,
        bestScore: 65000,
        crystals: 395,
        dailyStreak: 7,
        lastDailyKey: "2026-06-24",
        unlockedSkins: ["blue", "slime"],
        unlockedAchievements: [
          "height-100",
          "height-250",
          "height-500",
          "height-1000",
          "height-2000",
          "combo-5",
          "combo-8",
          "combo-12",
          "crystals-run-25",
          "score-10k",
          "score-25k",
          "daily-streak-3",
          "daily-streak-7",
        ],
        highScores: [dailyScore(3000), dailyScore(12000), dailyScore(65000)],
        dailyBests: {
          "2026-06-18": 5000,
          "2026-06-19": 9000,
          "2026-06-20": 12000,
          "2026-06-21": 18000,
          "2026-06-22": 22000,
          "2026-06-23": 35000,
          "2026-06-24": 65000,
        },
      },
    });
  });

  await expect(page.getByRole("dialog", { name: "New record!" })).toBeVisible();
  await expect(page.getByText("65,000")).toBeVisible();
  await expect(page.getByText(/Achievements unlocked/i)).toBeAttached();

  const climbAgain = page.getByRole("button", { name: /Climb again/i });
  const share = page.getByRole("button", { name: /Share/i });
  const backToMenu = page.getByRole("button", { name: /Back to menu/i });

  await expect(climbAgain).toBeVisible();
  await expect(share).toBeVisible();
  await expect(backToMenu).toBeVisible();

  const metrics = await page.evaluate(() => {
    const box = (selector: string) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
    };
    const buttonBox = (label: string) => {
      const el = Array.from(document.querySelectorAll("button")).find((button) =>
        button.textContent?.toLowerCase().includes(label),
      );
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
    };
    const results = document.querySelector<HTMLElement>('[data-testid="gameover-results"]');
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      docWidth: document.documentElement.scrollWidth,
      resultsScrollTop: results?.scrollTop ?? -1,
      resultsScrollable: (results?.scrollHeight ?? 0) > (results?.clientHeight ?? 0),
      title: box("#gameover-title"),
      score: box('[aria-label="Run height as a fraction of best"]'),
      actions: box('[data-testid="gameover-actions"]'),
      climbAgain: buttonBox("climb again"),
      share: buttonBox("share"),
      backToMenu: buttonBox("back to menu"),
    };
  });

  expect(metrics.resultsScrollTop).toBe(0);
  expect(metrics.resultsScrollable).toBe(true);
  expect(metrics.docWidth).toBeLessThanOrEqual(metrics.viewport.width);

  for (const box of [
    metrics.title,
    metrics.score,
    metrics.actions,
    metrics.climbAgain,
    metrics.share,
    metrics.backToMenu,
  ]) {
    expect(box).not.toBeNull();
    expect(box?.top).toBeGreaterThanOrEqual(0);
    expect(box?.bottom).toBeLessThanOrEqual(metrics.viewport.height);
    expect(box?.left).toBeGreaterThanOrEqual(0);
    expect(box?.right).toBeLessThanOrEqual(metrics.viewport.width);
  }
});
