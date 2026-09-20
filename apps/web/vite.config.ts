import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 5173,
    proxy: {
      // Everything under /api goes to the Bun daemon during development.
      "/api": { target: "http://127.0.0.1:4747", changeOrigin: true },
    },
  },
  build: {
    // The server serves this directory in production / compiled builds.
    outDir: "../server/public",
    emptyOutDir: true,
  },
});
