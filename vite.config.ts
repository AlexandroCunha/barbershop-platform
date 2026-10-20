import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_TARGET = process.env.API_URL ?? "http://localhost:3100";

export default defineConfig({
  root: "client",
  plugins: [react()],
  build: {
    outDir: "../dist-client",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": API_TARGET,
      "/media": API_TARGET,
    },
  },
});
