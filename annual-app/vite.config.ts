import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const appDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: appDir,
  base: "/annual/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(appDir, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: path.resolve(appDir, "../annual"),
    // Legacy Vercel builders may still package pre-build hashed assets.
    // Keep those files available until Vercel finishes packaging the build.
    emptyOutDir: process.env.VERCEL !== "1",
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
