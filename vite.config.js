import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  plugins: [tailwindcss(), react()],
  // Use / in dev, /throwdown_hub/ only when building for GitHub Pages
  base: command === "build" ? "/throwdown_hub/" : "/",
}));