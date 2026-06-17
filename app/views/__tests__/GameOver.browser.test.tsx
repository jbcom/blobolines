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
      scoreDelta: 0,
    },
    progress: {
      ...useGameStore.getState().progress,
      bestHeight: 134,
      bestScore: 5000,
      crystals: 42,
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
  // Crystals → next-skin progress + customize jump (42 lifetime, slime costs 15 → unlocked
  // already in DEFAULT? No: default unlockedSkins is ["blue"], so slime (15) is next).
  await expect.element(screen.getByText(/Customize/)).toBeInTheDocument();
});

test("tapping Customize requests the customizer and returns to menu", async () => {
  const screen = await render(<GameOver />);
  await screen.getByText(/Customize/).click();
  expect(useGameStore.getState().customizerIntent).toBe(true);
  expect(useGameStore.getState().phase).toBe("menu");
});

test("a DAILY run shows the shareable daily tag (date + hash); a normal run doesn't", async () => {
  useWorldStore.setState({ seed: 12345 });
  useGameStore.setState({ dailyRun: true });
  const daily = await render(<GameOver />);
  // The tag reads "Daily <YYYY-MM-DD> · <hash>" — assert the label + date shape are present.
  await expect.element(daily.getByText(/Daily \d{4}-\d{2}-\d{2} · /)).toBeInTheDocument();
  cleanup();

  // A normal (non-daily) run must NOT show the daily tag.
  useGameStore.setState({ dailyRun: false });
  const normal = await render(<GameOver />);
  await expect.element(normal.getByText(/Daily \d{4}-\d{2}-\d{2}/).query()).not.toBeInTheDocument();
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
      scoreDelta: 450,
    },
    progress: { ...useGameStore.getState().progress, bestHeight: 134, bestScore: 7200 },
  });
  const screen = await render(<GameOver />);
  await expect.element(screen.getByText("New record!")).toBeInTheDocument();
  // scoreDelta 450 → "+450 over best" on the score headline.
  await expect.element(screen.getByText("+450 over best")).toBeInTheDocument();
});
