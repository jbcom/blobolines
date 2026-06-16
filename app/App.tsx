import { Suspense, useEffect } from "react";
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
      <Suspense fallback={<LoadingScreen />}>
        <Game />
      </Suspense>
    </ErrorBoundary>
  );
}
