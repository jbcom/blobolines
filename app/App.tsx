import { WorldProvider } from "koota/react";
import { MotionConfig } from "motion/react";
import { Suspense, useEffect } from "react";
import { gameWorld } from "@/ecs/world";
import { attachPersistence, hydrateStore, useGameStore } from "@/state";
import { ErrorBoundary } from "./ErrorBoundary";
import { Game } from "./Game";
import { LoadingScreen } from "./views";

export function App() {
  // "always" forces reduced motion in-app (the settings toggle); "user" defers to the OS
  // prefers-reduced-motion. Lives here (not main.tsx) so it's reactive to the store.
  const reducedMotion = useGameStore((s) => s.settings.reducedMotion);

  useEffect(() => {
    void hydrateStore();
    const detach = attachPersistence();
    return detach;
  }, []);

  return (
    <ErrorBoundary source="App">
      <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
        <WorldProvider world={gameWorld}>
          <Suspense fallback={<LoadingScreen />}>
            <Game />
          </Suspense>
        </WorldProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
