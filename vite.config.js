import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Builds the entire app (JS + CSS) inlined into a single self-contained
// dist/index.html. No CDN, no external assets, works offline, and can be
// opened directly or served by any static host (GitHub Pages).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    target: "es2018",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});
