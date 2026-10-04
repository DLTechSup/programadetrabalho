import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base "./" é essencial: o Electron carrega o index.html direto do disco (file://).
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  test: { include: ["tests/**/*.test.ts"] },
});
