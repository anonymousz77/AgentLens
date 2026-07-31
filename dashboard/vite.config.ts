import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    // `--mode demo` (Vercel static build) emits a local ./dist; every other
    // mode keeps the default ../dist/dashboard consumed by the CLI static server.
    outDir: mode === "demo" ? "dist" : "../dist/dashboard",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:4319",
    },
  },
}));
