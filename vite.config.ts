import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the repo at /woow/ ; local dev serves at /
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/woow/" : "/",
}));
