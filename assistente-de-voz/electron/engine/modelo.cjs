// Download do modelo de voz (Whisper) para a pasta de dados do programa. Roda uma vez; depois funciona offline.
const fs = require("node:fs");
const path = require("node:path");

const REPOS = { tiny: "Xenova/whisper-tiny", base: "Xenova/whisper-base", small: "Xenova/whisper-small" };
const ONNX_NECESSARIOS = ["onnx/encoder_model_quantized.onnx", "onnx/decoder_model_merged_quantized.onnx"];

const pastaDoModelo = (base, chave) => path.join(base, `whisper-${chave}`);

function modeloPronto(base, chave) {
  const dir = pastaDoModelo(base, chave);
  return ["config.json", "tokenizer.json", "preprocessor_config.json", ...ONNX_NECESSARIOS].every((f) => fs.existsSync(path.join(dir, f))) && !fs.existsSync(path.join(dir, ".incompleto"));
}

/** Decide quais arquivos do repositório são necessários (tudo que não é ONNX + os 2 ONNX quantizados). */
function arquivosNecessarios(siblings) {
  const nomes = siblings.map((s) => ({ nome: s.rfilename, tamanho: s.size || 0 }));
  return nomes.filter((f) => (f.nome.startsWith("onnx/") ? ONNX_NECESSARIOS.includes(f.nome) : !/^(README|\.gitattributes|flax_|tf_|pytorch_|model\.safetensors|.*\.(md|h5|msgpack|bin|ot|safetensors))/i.test(path.basename(f.nome)) && !f.nome.includes("/")));
}

/**
 * Baixa o modelo. `fetchFn` é o fetch do Electron (usa o proxy do Windows) ou o do Node.
 * `onProgresso({baixado, total, arquivo})`.
 */
async function baixarModelo(base, chave, { fetchFn = fetch, onProgresso = () => {}, cancelado = () => false } = {}) {
  const repo = REPOS[chave];
  if (!repo) throw new Error("Modelo desconhecido.");
  const dir = pastaDoModelo(base, chave);
  fs.mkdirSync(path.join(dir, "onnx"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".incompleto"), "");
  const resp = await fetchFn(`https://huggingface.co/api/models/${repo}?blobs=true`);
  if (!resp.ok) throw new Error(`Não consegui consultar o modelo (${resp.status}). Verifique a internet.`);
  const info = await resp.json();
  const arquivos = arquivosNecessarios(info.siblings || []);
  if (!ONNX_NECESSARIOS.every((o) => arquivos.some((a) => a.nome === o))) throw new Error("O repositório do modelo não tem os arquivos esperados.");
  const total = arquivos.reduce((s, a) => s + a.tamanho, 0);
  let baixado = 0;
  for (const a of arquivos) {
    if (cancelado()) throw new Error("Download cancelado.");
    const destino = path.join(dir, a.nome);
    if (fs.existsSync(destino) && (!a.tamanho || fs.statSync(destino).size === a.tamanho)) {
      baixado += a.tamanho;
      onProgresso({ baixado, total, arquivo: a.nome });
      continue;
    }
    const r = await fetchFn(`https://huggingface.co/${repo}/resolve/main/${a.nome}`);
    if (!r.ok || !r.body) throw new Error(`Falha ao baixar ${a.nome} (${r.status}).`);
    const tmp = `${destino}.part`;
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    const saida = fs.createWriteStream(tmp);
    const leitor = r.body.getReader();
    try {
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        if (cancelado()) throw new Error("Download cancelado.");
        await new Promise((ok, erro) => saida.write(value, (e) => (e ? erro(e) : ok())));
        baixado += value.length;
        onProgresso({ baixado, total, arquivo: a.nome });
      }
    } finally {
      await new Promise((ok) => saida.end(ok));
    }
    fs.renameSync(tmp, destino);
  }
  fs.rmSync(path.join(dir, ".incompleto"), { force: true });
  return dir;
}

module.exports = { REPOS, modeloPronto, pastaDoModelo, baixarModelo, arquivosNecessarios, ONNX_NECESSARIOS };
