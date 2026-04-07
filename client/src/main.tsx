import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ensureFreshDeployedBuild } from "./lib/deploymentVersion";

const bootstrap = async () => {
  await ensureFreshDeployedBuild();
  createRoot(document.getElementById("root")!).render(<App />);
};

bootstrap();
