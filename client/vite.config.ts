import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync } from "fs";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8")
);

const padTwo = (value: number) => String(value).padStart(2, "0");

const buildTimestampLabel = (() => {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = padTwo(now.getMonth() + 1);
  const day = padTwo(now.getDate());
  const hours = padTwo(now.getHours());
  const minutes = padTwo(now.getMinutes());
  return `${year}${month}${day}.${hours}${minutes}`;
})();

// Keep the visible build label stable across localhost and hosted builds.
// Deployment-specific ids like Vercel's `dpl_*` make the UI differ in production.
const buildIdSource = process.env.APP_BUILD_ID || buildTimestampLabel;

const normalizedBuildId = String(buildIdSource || "")
  .trim()
  .replace(/[^a-zA-Z0-9.-]+/g, "")
  .slice(0, 12) || buildTimestampLabel;
const buildCreatedAt = new Date().toISOString();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true,
        silenceDeprecations: [
          "legacy-js-api",
          "color-functions",
          "global-builtin",
          "import",
        ],
      },
    },
  },
  plugins: [
    react(),
    {
      name: "emit-build-version",
      apply: "build",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify(
            {
              version: packageJson.version || "0.0.0",
              buildId: normalizedBuildId,
              builtAt: buildCreatedAt,
            },
            null,
            2
          ),
        });
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version || "0.0.0"),
    __APP_BUILD_ID__: JSON.stringify(normalizedBuildId),
  },
}));
