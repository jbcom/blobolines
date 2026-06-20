import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import { App } from "./App";
import { installTestBridge } from "./testBridge";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

// Expose the headless E2E control surface (dev-only) so Playwright can drive the game via
// store calls instead of synthetic harness clicks (which stall under CI's software GL).
installTestBridge();

// MotionConfig (reduced-motion) lives inside App so it can react to the in-app setting.
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
