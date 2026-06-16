import { WorldProvider } from "koota/react";
import { gameWorld } from "@/ecs/world";
import { ErrorBoundary } from "./ErrorBoundary";
import { Game } from "./Game";

export function App() {
  return (
    <ErrorBoundary source="App">
      <WorldProvider world={gameWorld}>
        <Game />
      </WorldProvider>
    </ErrorBoundary>
  );
}
