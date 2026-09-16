import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Which deploy this bundle came from. The API reports its own on the revision
  // poll; src/App.jsx reloads once when the two differ. Empty outside Vercel, and
  // an empty stamp never triggers a reload.
  define: {
    "import.meta.env.FERO_BUILD_ID": JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || "")
  },
  // The app fetches "./api/lift-log" with relative paths; in dev, proxy the
  // API to the local dev server (scripts/local-dev-server.mjs, port 3000).
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3000"
    }
  },
  build: {
    // Keep output layout predictable for the service worker phase.
    outDir: "dist",
    sourcemap: false
  }
});
