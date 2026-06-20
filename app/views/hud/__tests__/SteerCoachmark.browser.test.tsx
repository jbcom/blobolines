import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { setAim, setBlobDiagnostics, useGameStore } from "@/state";
import { SteerCoachmark } from "../SteerCoachmark";

const airborne = (yes: boolean) =>
  setBlobDiagnostics({
    position: [0, yes ? 12 : 0, 0],
    velocity: [0, yes ? 8 : 0, 0],
    speed: yes ? 8 : 0,
    airborne: yes,
    expression: "idle",
    squash: 1,
    maxHeight: 12,
    groundY: 0,
  });

beforeEach(() => {
  setAim(null);
  airborne(false);
  useGameStore.setState({
    phase: "playing",
    // The steer cue is gated behind the launch cue (tutorialSeen) and its own unseen flag.
    progress: { ...useGameStore.getState().progress, tutorialSeen: true, steerTutorialSeen: false },
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setAim(null);
  airborne(false);
  useGameStore.setState({ phase: "menu" });
});

test("shows 'Drag to steer' the first time the blob is airborne (after the launch cue is done)", async () => {
  airborne(true);
  const screen = await render(<SteerCoachmark />);
  await expect.element(screen.getByText(/Drag to steer/i)).toBeInTheDocument();
});

test("stays hidden until the blob is actually airborne", async () => {
  airborne(false);
  const screen = await render(<SteerCoachmark />);
  await expect.element(screen.getByText(/Drag to steer/i).query()).not.toBeInTheDocument();
});

test("stays hidden if the launch cue hasn't been seen yet (teach launch first)", async () => {
  useGameStore.setState((s) => ({ progress: { ...s.progress, tutorialSeen: false } }));
  airborne(true);
  const screen = await render(<SteerCoachmark />);
  await expect.element(screen.getByText(/Drag to steer/i).query()).not.toBeInTheDocument();
});

test("stays hidden once the steer cue has been seen", async () => {
  useGameStore.setState((s) => ({ progress: { ...s.progress, steerTutorialSeen: true } }));
  airborne(true);
  const screen = await render(<SteerCoachmark />);
  await expect.element(screen.getByText(/Drag to steer/i).query()).not.toBeInTheDocument();
});

test("dismisses + persists the instant the player steers (a mid-air aim drag)", async () => {
  airborne(true);
  const screen = await render(<SteerCoachmark />);
  await expect.element(screen.getByText(/Drag to steer/i)).toBeInTheDocument();
  // A mid-air drag sets the aim → the steer cue's teach signal fires.
  setAim({ dir: [1, 0, 0], charge: 0 });
  await expect.element(screen.getByText(/Drag to steer/i).query()).not.toBeInTheDocument();
  expect(useGameStore.getState().progress.steerTutorialSeen).toBe(true);
});

test("landing WITHOUT steering does NOT persist — the cue re-arms for the next airborne moment", async () => {
  // A short first hop (launch then land without steering) must NOT mark the teach seen, or a player
  // whose first launch is a hop would be permanently denied the steering lesson.
  airborne(true);
  const screen = await render(<SteerCoachmark />);
  await expect.element(screen.getByText(/Drag to steer/i)).toBeInTheDocument();
  // Land without ever steering → the window ends, but the flag must stay unseen.
  airborne(false);
  await expect.element(screen.getByText(/Drag to steer/i).query()).not.toBeInTheDocument();
  expect(useGameStore.getState().progress.steerTutorialSeen).toBe(false); // NOT persisted
  // Go airborne again → the cue re-arms and shows once more (the teach wasn't burned).
  airborne(true);
  await expect.element(screen.getByText(/Drag to steer/i)).toBeInTheDocument();
});

test("auto-dismisses + persists after the timeout even if the player never steers (safety net)", async () => {
  // The 2.6s timeout is the safety net so the cue can't bleed into the descent. Keep the blob
  // airborne and aim null, advance fake time past the timeout, and assert it clears once.
  vi.useFakeTimers();
  airborne(true);
  const screen = await render(<SteerCoachmark />);
  await expect.element(screen.getByText(/Drag to steer/i)).toBeInTheDocument();
  // No steer input; the auto-dismiss timer (2600ms) fires on its own.
  vi.advanceTimersByTime(2700);
  await expect.element(screen.getByText(/Drag to steer/i).query()).not.toBeInTheDocument();
  expect(useGameStore.getState().progress.steerTutorialSeen).toBe(true);
});
