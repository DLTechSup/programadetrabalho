// Leitura de texto das fotos (OCR) com tesseract.js -- porta ocr.py, trocando RapidOCR/Tesseract
// nativo por um OCR 100% em JS/WASM (sem instalar nada à parte no Windows do usuário).
// Simplificação consciente em relação ao original: só tenta a foto como veio (redimensionada se
// muito grande); o Python original também tentava uma versão em preto-e-branco com mais
// contraste e duas rotações -- aqui ficou de fora para manter o build simples e leve.
const { nativeImage } = require("electron");

const LIMITE_LADO = 2000;

let motorPromise = null;

async function criarMotor() {
  if (motorPromise) return motorPromise;
  motorPromise = (async () => {
    const { createWorker } = require("tesseract.js");
    const worker = await createWorker("por+eng");
    return {
      async ler(buf) {
        const { data } = await worker.recognize(buf);
        return data.text || "";
      },
      async encerrar() {
        await worker.terminate();
      },
    };
  })();
  return motorPromise;
}

function redimensionarSePreciso(buf) {
  const img = nativeImage.createFromBuffer(buf);
  const { width, height } = img.getSize();
  const maior = Math.max(width, height);
  if (maior <= LIMITE_LADO || maior === 0) return buf;
  const fator = LIMITE_LADO / maior;
  const redimensionada = img.resize({ width: Math.round(width * fator), height: Math.round(height * fator), quality: "good" });
  return redimensionada.toPNG();
}

/** Lê o texto de uma foto (bytes). Mais barato que criar um motor por chamada: reusa o worker. */
async function lerFoto(dados) {
  const motor = await criarMotor();
  const preparada = redimensionarSePreciso(Buffer.isBuffer(dados) ? dados : Buffer.from(dados));
  return motor.ler(preparada);
}

async function encerrarMotor() {
  if (!motorPromise) return;
  try {
    const motor = await motorPromise;
    await motor.encerrar();
  } catch { /* ok */ }
  motorPromise = null;
}

module.exports = { lerFoto, encerrarMotor };
