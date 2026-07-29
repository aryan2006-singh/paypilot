import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Standard "dist" output — what Vercel expects zero-config for a Vite
// project, and what app/main.py also looks for when running the all-in-one
// FastAPI-served mode (see FRONTEND_DIST there). One build artifact, two
// possible ways to serve it.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/chat": "http://127.0.0.1:8010",
      "/health": "http://127.0.0.1:8010",
      "/api": "http://127.0.0.1:8010",
    },
  },
});
