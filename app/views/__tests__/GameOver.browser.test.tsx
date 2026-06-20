import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { dailySeedPhrase } from "@/sim/daily";
import { useGameStore, useWorldStore } from "@/state";
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
    },
    progress: {
      ...useGameStore.getState().progress,
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
  // Crystals → next-skin progress + customize jump (default Mango is unlocked; Berry is next).
  await expect.element(screen.getByText(/Customize/)).toBeInTheDocument();
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
    },
    progress: { ...useGameStore.getState().progress, bestHeight: 134, bestScore: 7200 },
  });
  const screen = await render(<GameOver />);
  await expect.element(screen.getByText("New record!")).toBeInTheDocument();
  // scoreDelta 450 → "+450 over best" on the score headline.
  await expect.element(screen.getByText("+450 over best")).toBeInTheDocument();
});
