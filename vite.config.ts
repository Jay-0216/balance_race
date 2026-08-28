import fs from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * GitHub Pages serves a project site from a subfolder
 * (jay-0216.github.io/balance_race/),
 * so every asset URL has to be prefixed with it - a base of "/" there loads a
 * white page and 404s in the console. A custom domain serves from the root
 * instead, and the presence of public/CNAME is exactly the thing that says so.
 * Deriving the base from that file means there is one switch, not two that can
 * disagree.
 */
const custom = fs.existsSync(new URL("./public/CNAME", import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: custom ? "/" : "/balance_race/",
});
