// Copia os arquivos WebAssembly do onnxruntime (usado pelo Whisper) para public/ort,
// para o app funcionar offline (sem baixar de CDN).
const fs = require("node:fs");
const path = require("node:path");
const origem = path.join(__dirname, "..", "node_modules", "onnxruntime-web", "dist");
const destino = path.join(__dirname, "..", "public", "ort");
fs.mkdirSync(destino, { recursive: true });
let n = 0;
for (const f of fs.readdirSync(origem)) {
  if (/^ort-wasm-simd-threaded(\.jsep)?\.(wasm|mjs)$/.test(f)) {
    fs.copyFileSync(path.join(origem, f), path.join(destino, f));
    n++;
  }
}
console.log(`onnxruntime: ${n} arquivos copiados para public/ort`);
if (!n) process.exit(1);
