import { WorldProvider } from "koota/react";
import { Suspense, useEffect } from "react";
import { gameWorld } from "@/ecs/world";
import { attachPersistence, hydrateStore } from "@/state";
import { ErrorBoundary } from "./ErrorBoundary";
import { Game } from "./Game";
import { LoadingScreen } from "./views";

export function App() {
  useEffect(() => {
    void hydrateStore();
    const detach = attachPersistence();
    return detach;
  }, []);

  return (
    <ErrorBoundary source="App">
      <WorldProvider world={gameWorld}>
        <Suspense fallback={<LoadingScreen />}>
          <Game />
        </Suspense>
      </WorldProvider>
    </ErrorBoundary>
  );
}
