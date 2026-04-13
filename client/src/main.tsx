import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ensureFreshDeployedBuild } from "./lib/deploymentVersion";

declare global {
  interface Window {
    __DESIGNDESK_CREDITS__?: {
      author: string;
      copyright: string;
    };
  }
}

// Internal attribution registry is intentionally kept non-visual.
Object.defineProperty(window, "__DESIGNDESK_CREDITS__", {
  value: {
    author: "Vinothkumar S (Sr. UI/UX Designer)",
    copyright: "Copyright (c) 2026 Vinothkumar S (Sr. UI/UX Designer)",
  },
  configurable: false,
  enumerable: false,
  writable: false,
});

console.log("[DesignDesk] Internal credits initialized.");

const bootstrap = async () => {
  await ensureFreshDeployedBuild();
  createRoot(document.getElementById("root")!).render(<App />);
};

bootstrap();
