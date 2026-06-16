import { WorldProvider } from "koota/react";
import { useEffect } from "react";
import { gameWorld } from "@/ecs/world";
import { attachPersistence, hydrateStore } from "@/state";
import { ErrorBoundary } from "./ErrorBoundary";
import { Game } from "./Game";

export function App() {
  useEffect(() => {
    void hydrateStore();
    const detach = attachPersistence();
    return detach;
  }, []);

  return (
    <ErrorBoundary source="App">
      <WorldProvider world={gameWorld}>
        <Game />
      </WorldProvider>
    </ErrorBoundary>
  );
}
