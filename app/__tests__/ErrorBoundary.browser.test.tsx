import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { ErrorBoundary } from "../ErrorBoundary";

afterEach(() => cleanup());

function Boom({ message }: { message: string }): never {
  throw new Error(message);
}

test("shows a branded tap-to-retry fallback when a child crashes", async () => {
  // Silence the expected React error log for this intentional throw.
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const screen = await render(
    <ErrorBoundary source="test">
      <Boom message="kaboom" />
    </ErrorBoundary>,
  );
  await expect.element(screen.getByText("A blob went splat.")).toBeInTheDocument();
  await expect.element(screen.getByText("Tap to retry")).toBeInTheDocument();
  await expect.element(screen.getByText("kaboom")).toBeInTheDocument();
  spy.mockRestore();
});

test("shows a friendly graphics message for WebGL/WASM failures", async () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const screen = await render(
    <ErrorBoundary source="test">
      <Boom message="WebGL context lost" />
    </ErrorBoundary>,
  );
  await expect.element(screen.getByText(/graphics engine couldn't start/i)).toBeInTheDocument();
  spy.mockRestore();
});
