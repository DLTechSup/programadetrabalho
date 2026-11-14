// Copia para public/ os arquivos usados no navegador (inclusive no GitHub Pages):
// o worker do pdf.js e o dicionário de português (VERO, LGPL-3.0 ou MPL-2.0).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
mkdirSync("public/dicionario", { recursive: true });

// Extensão .js para ser servido com o tipo JavaScript em qualquer hospedagem.
copyFileSync(require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs"), "public/pdf.worker.min.js");

const dicionario = join(process.cwd(), "node_modules", "dictionary-pt");
copyFileSync(join(dicionario, "index.aff"), "public/dicionario/pt-BR.aff");
copyFileSync(join(dicionario, "index.dic"), "public/dicionario/pt-BR.dic");
copyFileSync(join(dicionario, "license"), "public/dicionario/LICENSE.txt");
