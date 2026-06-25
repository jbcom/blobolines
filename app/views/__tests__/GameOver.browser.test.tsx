import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { dailySeedPhrase } from "@/sim/daily";
import { DEFAULT_PROGRESS, useGameStore, useWorldStore } from "@/state";
import { GameOver } from "../GameOver";

// The GameOver card derives "today" via dailySeedPhrase(new Date()) at the UI edge, so a daily
// fixture's stored attempts must use the SAME phrase the component will compute right now.
const todayPhrase = dailySeedPhrase(new Date());
const dailyScore = (score: number) => ({
  score,
  height: 0,
  crystals: 0,
  maxCombo: 0,
  date: "2026-06-20",
  seedPhrase: todayPhrase,
  difficulty: "ready",
});

function seedDenseDailyGameOverState() {
  useWorldStore.setState({ seed: 12345, seedPhrase: todayPhrase, difficulty: "ready" });
  useGameStore.setState((s) => ({
    dailyRun: true,
    run: {
      ...s.run,
      height: 2500,
      crystals: 40,
      maxCombo: 12,
      recordDelta: 250,
      score: 65000,
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
      ...s.progress,
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
  }));
}

beforeEach(() => {
  useGameStore.setState({
    phase: "gameover",
    run: {
      height: 80,
      crystals: 3,
      combo: 0,
      maxCombo: 5,
      recordDelta: 0,
      score: 1200,
      stylePoints: 0,
      scoreDelta: 0,
      unlockedAchievements: [],
      streakExtended: 0,
    },
    progress: {
      ...DEFAULT_PROGRESS,
      bestHeight: 134,
      bestScore: 5000,
      crystals: 42,
      unlockedAchievements: [], // start clean so the unlock card is deterministic
    },
  });
});
afterEach(() => {
  cleanup();
  useGameStore.setState({ phase: "menu", customizerIntent: false, dailyRun: false });
});

test("shows the run recap: score headline, altitude, max combo, crystals run + lifetime, short-by delta", async () => {
  const screen = await render(<GameOver />);
  // Score headline + best-score sublabel (not a record this run).
  await expect.element(screen.getByText("1,200")).toBeInTheDocument();
  await expect.element(screen.getByText("best 5,000")).toBeInTheDocument();
  await expect.element(screen.getByText("80 m")).toBeInTheDocument();
  await expect.element(screen.getByText("Max combo")).toBeInTheDocument();
  // 42 lifetime crystals appears as the crystals sublabel.
  await expect.element(screen.getByText("42 lifetime")).toBeInTheDocument();
  // 134 best - 80 height = 54m short.
  await expect.element(screen.getByText("54 m short")).toBeInTheDocument();
  // Delta-vs-best progress bar present.
  await expect
    .element(screen.getByRole("progressbar", { name: /fraction of best/i }))
    .toBeInTheDocument();
  // Share button present.
  await expect.element(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  // A single post-run goal gives the next climb a concrete target.
  await expect.element(screen.getByTestId("next-climb-goal")).toBeInTheDocument();
  await expect.element(screen.getByText("Next climb")).toBeInTheDocument();
  await expect.element(screen.getByText("Unbreakable")).toBeInTheDocument();
  await expect.element(screen.getByText("5 / 8 clean combo")).toBeInTheDocument();
  // Crystals → next-skin progress + customize jump (default Mango is unlocked; Berry is next).
  await expect.element(screen.getByText(/Customize/)).toBeInTheDocument();
});

test("dense small-phone results start at the top while replay actions stay reachable", async () => {
  seedDenseDailyGameOverState();

  const screen = await render(
    <div
      data-testid="phone-shell"
      style={{ position: "relative", width: "320px", height: "700px", overflow: "hidden" }}
    >
      <GameOver />
    </div>,
  );

  await expect.element(screen.getByText("New record!")).toBeVisible();
  await expect.element(screen.getByText("65,000")).toBeVisible();
  await expect.element(screen.getByText(/Achievements unlocked/i)).toBeInTheDocument();

  const shellBox = screen.getByTestId("phone-shell").element().getBoundingClientRect();
  const results = screen.getByTestId("gameover-results").element() as HTMLElement;
  const actions = screen.getByTestId("gameover-actions").element();
  const climbAgain = screen.getByRole("button", { name: /Climb again/i }).element();
  const share = screen.getByRole("button", { name: /Share/i }).element();
  const backToMenu = screen.getByRole("button", { name: /Back to menu/i }).element();

  expect(results.scrollTop).toBe(0);
  expect(results.scrollHeight).toBeGreaterThan(results.clientHeight);
  expect(document.activeElement).toBe(climbAgain);

  for (const element of [
    screen.getByText("New record!").element(),
    climbAgain,
    share,
    backToMenu,
  ]) {
    const box = element.getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(shellBox.top);
    expect(box.bottom).toBeLessThanOrEqual(shellBox.bottom);
    expect(box.left).toBeGreaterThanOrEqual(shellBox.left);
    expect(box.right).toBeLessThanOrEqual(shellBox.right);
  }

  expect(actions.getBoundingClientRect().bottom).toBeLessThanOrEqual(shellBox.bottom);
});

test("the post-run goal pivots to combo when that is the nearest useful target", async () => {
  useGameStore.setState((s) => ({
    run: { ...s.run, maxCombo: 4 },
    progress: {
      ...s.progress,
      bestHeight: 120,
      bestScore: 1000,
      unlockedAchievements: ["height-100"],
    },
  }));

  const screen = await render(<GameOver />);
  await expect.element(screen.getByTestId("next-climb-goal")).toBeInTheDocument();
  await expect.element(screen.getByText("On a Roll")).toBeInTheDocument();
  await expect.element(screen.getByText("4 / 5 clean combo")).toBeInTheDocument();
  await expect
    .element(screen.getByRole("progressbar", { name: /progress toward on a roll/i }))
    .toBeInTheDocument();
});

test("tapping Customize requests the customizer and returns to menu", async () => {
  const screen = await render(<GameOver />);
  await screen.getByText(/Customize/).click();
  expect(useGameStore.getState().customizerIntent).toBe(true);
  expect(useGameStore.getState().phase).toBe("menu");
});

test("celebrates newly-unlocked achievements + persists them", async () => {
  // beforeEach: bestHeight 134 (→ Cloud Niner / height-100) + run maxCombo 5 (→ On a Roll).
  useGameStore.setState((s) => ({
    run: {
      ...s.run,
      unlockedAchievements: ["height-100", "combo-5"],
    },
    progress: {
      ...s.progress,
      unlockedAchievements: ["height-100", "combo-5"],
    },
  }));
  const screen = await render(<GameOver />);
  await expect.element(screen.getByText(/Achievements? unlocked/i)).toBeInTheDocument();
  await expect.element(screen.getByText("Cloud Niner")).toBeInTheDocument();
  await expect.element(screen.getByText("On a Roll")).toBeInTheDocument();
  // They were persisted to progress (so they won't re-celebrate next time).
  const ids = useGameStore.getState().progress.unlockedAchievements;
  expect(ids).toEqual(expect.arrayContaining(["height-100", "combo-5"]));
});

test("does not show the achievement card when nothing new is unlocked", async () => {
  // Pre-unlock everything this run would earn, so there's nothing fresh.
  useGameStore.setState((s) => ({
    run: { ...s.run, unlockedAchievements: [] },
    progress: { ...s.progress, unlockedAchievements: ["height-100", "combo-5"] },
  }));
  const screen = await render(<GameOver />);
  await expect.element(screen.getByText(/Achievements? unlocked/i).query()).not.toBeInTheDocument();
});

test("a DAILY run shows the shareable daily tag (date + hash)", async () => {
  useWorldStore.setState({ seed: 12345, seedPhrase: "blobolines-daily-2026-06-17" });
  useGameStore.setState({ dailyRun: true });
  const screen = await render(<GameOver />);
  // The tag reads "Daily <YYYY-MM-DD> · <hash>" — assert the label + date shape are present.
  await expect.element(screen.getByText(/Daily \d{4}-\d{2}-\d{2} · /)).toBeInTheDocument();
});

test("a normal run shows its replay seed without the daily tag", async () => {
  useWorldStore.setState({ seed: 12345, seedPhrase: "bouncy-bright-blob" });
  useGameStore.setState({ dailyRun: false });
  const screen = await render(<GameOver />);
  await expect.element(screen.getByText(/Daily \d{4}-\d{2}-\d{2}/).query()).not.toBeInTheDocument();
  await expect.element(screen.getByText("Seed bouncy-bright-blob")).toBeInTheDocument();
});

test("a DAILY run shows the daily streak badge", async () => {
  // The streak badge renders inside the daily "Today's tower" section, which needs a high score on
  // today's daily seed (the module-level todayPhrase matches what the card computes now).
  useWorldStore.setState({ seed: 1, seedPhrase: todayPhrase });
  useGameStore.setState((s) => ({
    dailyRun: true,
    progress: { ...s.progress, dailyStreak: 5, highScores: [dailyScore(1000)] },
  }));
  const screen = await render(<GameOver />);
  await expect.element(screen.getByTestId("daily-streak")).toBeInTheDocument();
  await expect.element(screen.getByText(/5-day streak/)).toBeInTheDocument();
});

test("a run that EXTENDED the streak celebrates it instead of showing the plain count", async () => {
  // run.streakExtended > 0 means this run grew the streak (yesterday → today) → the card shows the
  // celebratory "Streak extended to N!" beat rather than the calm "N-day streak" line.
  useWorldStore.setState({ seed: 1, seedPhrase: todayPhrase });
  useGameStore.setState((s) => ({
    dailyRun: true,
    run: { ...s.run, streakExtended: 5 },
    progress: { ...s.progress, dailyStreak: 5, highScores: [dailyScore(1000)] },
  }));
  const screen = await render(<GameOver />);
  await expect.element(screen.getByText(/Streak extended to 5!/)).toBeInTheDocument();
  // The calm count line is NOT shown when celebrating an extension.
  await expect.element(screen.getByText(/^5-day streak$/).query()).not.toBeInTheDocument();
});

test("a normal run shows NO daily streak badge", async () => {
  useWorldStore.setState({ seed: 12345, seedPhrase: "bouncy-bright-blob" });
  useGameStore.setState((s) => ({ dailyRun: false, progress: { ...s.progress, dailyStreak: 5 } }));
  const screen = await render(<GameOver />);
  await expect.element(screen.getByTestId("daily-streak").query()).not.toBeInTheDocument();
});

test("the seed line is a labelled copy-seed button that copies the seed + confirms", async () => {
  useWorldStore.setState({ seed: 12345, seedPhrase: "bouncy-bright-blob" });
  useGameStore.setState({ dailyRun: false });
  // Stub the clipboard so the copy resolves deterministically (real clipboard.writeText is
  // permission-gated in headless) — then we can assert both the WRITTEN value and the confirmation.
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });

  const screen = await render(<GameOver />);
  const copyBtn = screen.getByRole("button", { name: /copy seed bouncy-bright-blob/i });
  await expect.element(copyBtn).toBeInTheDocument();
  await expect.element(screen.getByText("Seed bouncy-bright-blob")).toBeInTheDocument();

  await copyBtn.click();
  expect(writeText).toHaveBeenCalledWith("bouncy-bright-blob"); // copies the SEED phrase
  await expect.element(screen.getByText("Seed copied!")).toBeInTheDocument(); // flips to confirm
  // The accessible name updates too, so a screen reader announces the copied state (not the stale
  // "Copy seed…").
  await expect
    .element(screen.getByRole("button", { name: /seed copied to clipboard/i }))
    .toBeInTheDocument();

  vi.unstubAllGlobals();
});

test("daily run, first attempt → 'first climb' standing", async () => {
  useWorldStore.setState({ seed: 12345, seedPhrase: todayPhrase });
  // Only this run's entry on today's seed → first attempt.
  useGameStore.setState((s) => ({
    dailyRun: true,
    run: { ...s.run, score: 1200 },
    progress: { ...s.progress, highScores: [dailyScore(1200)] },
  }));
  const screen = await render(<GameOver />);
  await expect.element(screen.getByText("Today's tower", { exact: true })).toBeInTheDocument();
  await expect.element(screen.getByText(/first climb on today's tower/i)).toBeInTheDocument();
});

test("daily run, a worse repeat attempt → ranked '#N of M'", async () => {
  useWorldStore.setState({ seed: 12345, seedPhrase: todayPhrase });
  useGameStore.setState((s) => ({
    dailyRun: true,
    run: { ...s.run, score: 1000 },
    // Two prior better runs + this one (1000) → rank #3 of 3.
    progress: {
      ...s.progress,
      highScores: [dailyScore(2500), dailyScore(1800), dailyScore(1000)],
    },
  }));
  const screen = await render(<GameOver />);
  await expect.element(screen.getByText("#3 of 3 attempts today")).toBeInTheDocument();
});

test("daily run, a new personal daily best → celebratory standing", async () => {
  useWorldStore.setState({ seed: 12345, seedPhrase: todayPhrase });
  useGameStore.setState((s) => ({
    dailyRun: true,
    run: { ...s.run, score: 3000 },
    progress: {
      ...s.progress,
      highScores: [dailyScore(900), dailyScore(1500), dailyScore(3000)],
    },
  }));
  const screen = await render(<GameOver />);
  await expect.element(screen.getByText(/Best on today's tower yet!/i)).toBeInTheDocument();
});

test("a normal (non-daily) run does NOT show the daily standing section", async () => {
  useWorldStore.setState({ seed: 12345, seedPhrase: "bouncy-bright-blob" });
  useGameStore.setState((s) => ({
    dailyRun: false,
    progress: { ...s.progress, highScores: [dailyScore(2500)] },
  }));
  const screen = await render(<GameOver />);
  await expect.element(screen.getByText("Today's tower").query()).not.toBeInTheDocument();
});

test("celebrates a height record instead of a short-by delta", async () => {
  useGameStore.setState({
    run: {
      height: 150,
      crystals: 1,
      combo: 0,
      maxCombo: 2,
      recordDelta: 16,
      score: 1600,
      stylePoints: 0,
      scoreDelta: 0,
      unlockedAchievements: [],
      streakExtended: 0,
    },
    progress: { ...useGameStore.getState().progress, bestHeight: 150, bestScore: 9000 },
  });
  const screen = await render(<GameOver />);
  await expect.element(screen.getByText("New record!")).toBeInTheDocument();
  // recordDelta 16 → "+16 m over best".
  await expect.element(screen.getByText("+16 m over best")).toBeInTheDocument();
});

test("celebrates a SCORE record even without a height record", async () => {
  // Shorter run (height below best) but a new best score from crystals/combo → still a record.
  useGameStore.setState({
    run: {
      height: 90,
      crystals: 8,
      combo: 0,
      maxCombo: 7,
      recordDelta: 0,
      score: 7200,
      stylePoints: 0,
      scoreDelta: 450,
      unlockedAchievements: [],
      streakExtended: 0,
    },
    progress: { ...useGameStore.getState().progress, bestHeight: 134, bestScore: 7200 },
  });
  const screen = await render(<GameOver />);
  await expect.element(screen.getByText("New record!")).toBeInTheDocument();
  // scoreDelta 450 → "+450 over best" on the score headline.
  await expect.element(screen.getByText("+450 over best")).toBeInTheDocument();
});
