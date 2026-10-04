import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base "./" é essencial: o Electron serve o index.html pelo protocolo app://.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 4000, commonjsOptions: { include: [/electron\/engine\/.*\.cjs$/, /node_modules/], transformMixedEsModules: true } },
  worker: { format: "es" },
  test: { include: ["tests/**/*.test.ts"] },
});
