import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Netlify serves the site from the root of its own domain, so the base stays
// "/". (GitHub Pages would need "/woow/" - that is the one thing that has to
// change if the deploy target ever moves back.)
export default defineConfig({
  plugins: [react()],
  base: "/",
});
