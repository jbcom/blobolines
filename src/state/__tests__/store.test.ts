import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PROGRESS,
  DEFAULT_SETTINGS,
  equippedSkinColor,
  SKIN_COST,
  useGameStore,
} from "../store";

beforeEach(() => {
  useGameStore.setState({
    phase: "menu",
    settings: { ...DEFAULT_SETTINGS },
    progress: { ...DEFAULT_PROGRESS },
    run: {
      height: 0,
      crystals: 0,
      combo: 0,
      maxCombo: 0,
      recordDelta: 0,
      score: 0,
      scoreDelta: 0,
    },
  });
});

describe("useGameStore", () => {
  it("starts in menu phase", () => {
    expect(useGameStore.getState().phase).toBe("menu");
  });

  it("setPhase transitions phase", () => {
    useGameStore.getState().setPhase("playing");
    expect(useGameStore.getState().phase).toBe("playing");
  });

  it("updateSettings patches only provided keys", () => {
    useGameStore.getState().updateSettings({ masterVolume: 0.5 });
    const { settings } = useGameStore.getState();
    expect(settings.masterVolume).toBe(0.5);
    expect(settings.musicEnabled).toBe(DEFAULT_SETTINGS.musicEnabled);
  });

  it("addCrystals adds to both run and progress", () => {
    useGameStore.getState().addCrystals(10);
    const s = useGameStore.getState();
    expect(s.run.crystals).toBe(10);
    expect(s.progress.crystals).toBe(10);
  });

  it("resetRun clears run crystals without touching progress", () => {
    useGameStore.getState().addCrystals(5);
    useGameStore.getState().resetRun();
    const s = useGameStore.getState();
    expect(s.run.crystals).toBe(0);
    expect(s.progress.crystals).toBe(5);
  });

  it("dailyRun flag toggles (default false) for the daily-challenge framing", () => {
    expect(useGameStore.getState().dailyRun).toBe(false);
    useGameStore.getState().setDailyRun(true);
    expect(useGameStore.getState().dailyRun).toBe(true);
    useGameStore.getState().setDailyRun(false);
    expect(useGameStore.getState().dailyRun).toBe(false);
  });

  it("commitBestHeight only updates when new height is higher", () => {
    useGameStore.getState().commitBestHeight(100);
    expect(useGameStore.getState().progress.bestHeight).toBe(100);
    useGameStore.getState().commitBestHeight(50);
    expect(useGameStore.getState().progress.bestHeight).toBe(100);
  });

  it("commitBestHeight floors to int", () => {
    useGameStore.getState().commitBestHeight(123.9);
    expect(useGameStore.getState().progress.bestHeight).toBe(123);
  });

  it("commitBestHeight computes + records a composite score (height + crystals + combo)", () => {
    const s = useGameStore.getState();
    s.addCrystals(4);
    s.setRun({ maxCombo: 5 });
    s.commitBestHeight(120);
    const after = useGameStore.getState();
    expect(after.run.score).toBeGreaterThan(120); // more than height alone (crystals + combo)
    expect(after.progress.bestScore).toBe(after.run.score);
    expect(after.run.scoreDelta).toBe(after.run.score); // first run: whole score is the delta
  });

  it("a higher SCORE sets a record even when height is LOWER (separate records)", () => {
    const s = useGameStore.getState();
    // First run: tall, no crystals/combo.
    s.commitBestHeight(200);
    const firstScore = useGameStore.getState().progress.bestScore;
    // Second run: shorter height but loaded with crystals → can beat the score.
    s.resetRun();
    s.addCrystals(20);
    s.setRun({ maxCombo: 8 });
    s.commitBestHeight(150);
    const after = useGameStore.getState();
    expect(after.progress.bestHeight).toBe(200); // height best unchanged (150 < 200)
    expect(after.run.recordDelta).toBe(0); // not a height record
    expect(after.run.score).toBeGreaterThan(firstScore); // but a score record
    expect(after.run.scoreDelta).toBeGreaterThan(0);
    expect(after.progress.bestScore).toBe(after.run.score);
  });

  it("resetProgress wipes best height, crystals, unlocks and skin to defaults", () => {
    const s = useGameStore.getState();
    s.commitBestHeight(200);
    s.addCrystals(50);
    s.unlockSkin("slime");
    s.setSkin("slime");
    s.resetProgress();
    const p = useGameStore.getState().progress;
    expect(p.bestHeight).toBe(0);
    expect(p.crystals).toBe(0);
    expect(p.unlockedSkins).toEqual(["blue"]);
    expect(p.skin).toBe("blue");
  });

  it("setSkin changes equipped skin", () => {
    useGameStore.getState().setSkin("slime");
    expect(useGameStore.getState().progress.skin).toBe("slime");
  });

  it("unlockSkin adds skin without duplicates", () => {
    useGameStore.getState().unlockSkin("ghost");
    useGameStore.getState().unlockSkin("ghost");
    const skins = useGameStore.getState().progress.unlockedSkins;
    expect(skins.filter((s) => s === "ghost").length).toBe(1);
  });

  it("SKIN_COST blue is free", () => {
    expect(SKIN_COST.blue).toBe(0);
  });

  it("equippedSkinColor returns token hex", () => {
    const color = equippedSkinColor(useGameStore.getState());
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
