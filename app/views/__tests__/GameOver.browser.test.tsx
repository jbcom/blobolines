import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { useGameStore, useWorldStore } from "@/state";
import { GameOver } from "../GameOver";

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
  // Crystals → next-skin progress + customize jump (default slime is unlocked; blue is next).
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
    },
    progress: { ...useGameStore.getState().progress, bestHeight: 134, bestScore: 7200 },
  });
  const screen = await render(<GameOver />);
  await expect.element(screen.getByText("New record!")).toBeInTheDocument();
  // scoreDelta 450 → "+450 over best" on the score headline.
  await expect.element(screen.getByText("+450 over best")).toBeInTheDocument();
});
