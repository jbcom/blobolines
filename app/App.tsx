import { MotionConfig } from "motion/react";
import { Suspense, useEffect } from "react";
import { applyDeviceScale } from "@/platform";
import { applyQuality, setQualityPref } from "@/render/qualityBridge";
import { attachPersistence, hydrateStore, useGameStore } from "@/state";
import { ErrorBoundary } from "./ErrorBoundary";
import { Game } from "./Game";
import { LoadingScreen } from "./views";

export function syncReducedMotionDataset(
  reducedMotion: boolean,
  root: HTMLElement | null = typeof document !== "undefined" ? document.documentElement : null,
): () => void {
  if (!root) return () => {};
  root.dataset.reducedMotion = reducedMotion ? "true" : "false";
  return () => {
    delete root.dataset.reducedMotion;
  };
}

export function syncHighContrastDataset(
  highContrast: boolean,
  root: HTMLElement | null = typeof document !== "undefined" ? document.documentElement : null,
): () => void {
  if (!root) return () => {};
  root.dataset.highContrast = highContrast ? "true" : "false";
  return () => {
    delete root.dataset.highContrast;
  };
}

export function App() {
  // "always" forces reduced motion in-app (the settings toggle); "user" defers to the OS
  // prefers-reduced-motion. Lives here (not main.tsx) so it's reactive to the store.
  const reducedMotion = useGameStore((s) => s.settings.reducedMotion);
  const highContrast = useGameStore((s) => s.settings.highContrast);
  // The player's render-quality preference ("auto" or a pinned tier). Synced to the render
  // bridge below so changing it in Settings re-resolves the active tier immediately.
  const qualityPref = useGameStore((s) => s.settings.qualityPref);

  useEffect(() => {
    void hydrateStore();
    const detach = attachPersistence();
    // Device-aware UI scale → --ui-scale CSS var (phones never above baseline), rebinds on
    // resize/orientation. Works on web + the Capacitor webview without a native dep.
    const scale = applyDeviceScale();
    // Resolve the render quality tier from the device class — gates the heavy effects (high-
    // tier-only) so mid/low devices never pay for them.
    applyQuality();
    return () => {
      detach();
      scale.detach();
    };
  }, []);

  // Push the player's quality preference into the render bridge (re-resolves the tier). Runs on
  // mount + whenever the setting changes; the persisted value from hydrateStore flows through here.
  useEffect(() => {
    setQualityPref(qualityPref);
  }, [qualityPref]);

  useEffect(() => {
    return syncReducedMotionDataset(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    return syncHighContrastDataset(highContrast);
  }, [highContrast]);

  return (
    <ErrorBoundary source="App">
      <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
        <Suspense fallback={<LoadingScreen />}>
          <Game />
        </Suspense>
      </MotionConfig>
    </ErrorBoundary>
  );
}
