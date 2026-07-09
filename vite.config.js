import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
