// Configuração (config.json na pasta de dados do app) e o arquivo editável de regras de
// referência (regras_referencia.txt) -- porta config.py + o lado "arquivo" de regras_ref.py.
const fs = require("node:fs");
const path = require("node:path");
const { RegrasReferencia, MODELO_REGRAS_REFERENCIA } = require("./logica-pura.cjs");

const CAMPOS_VALIDOS = [
  "pastaBase", "grupos", "esperaLegendaSeg", "pegarAntigas", "todasDoGrupoB",
  "tentarEscondidas", "notificar", "som",
];

const CONFIG_PADRAO = {
  pastaBase: "",
  grupos: [], // [{nome, tipo: "A"|"B"|"I"}]
  esperaLegendaSeg: 120,
  pegarAntigas: false,
  todasDoGrupoB: true,
  tentarEscondidas: true,
  notificar: true,
  som: true,
};

function caminhoConfig(pastaDados) {
  return path.join(pastaDados, "monitor-config.json");
}

function carregarConfig(pastaDados) {
  try {
    const d = JSON.parse(fs.readFileSync(caminhoConfig(pastaDados), "utf-8"));
    const filtrado = Object.fromEntries(Object.entries(d).filter(([k]) => CAMPOS_VALIDOS.includes(k)));
    return { ...CONFIG_PADRAO, ...filtrado };
  } catch {
    return { ...CONFIG_PADRAO };
  }
}

function salvarConfig(pastaDados, config) {
  fs.mkdirSync(pastaDados, { recursive: true });
  fs.writeFileSync(caminhoConfig(pastaDados), JSON.stringify(config, null, 2), "utf-8");
}

function carregarRegrasReferencia(pastaDados) {
  const arq = path.join(pastaDados, "regras_referencia.txt");
  if (!fs.existsSync(arq)) {
    try { fs.mkdirSync(pastaDados, { recursive: true }); fs.writeFileSync(arq, MODELO_REGRAS_REFERENCIA, "utf-8"); } catch { /* ok */ }
  }
  let texto = MODELO_REGRAS_REFERENCIA;
  try { texto = fs.readFileSync(arq, "utf-8"); } catch { /* ok */ }
  return RegrasReferencia.carregarDeTexto(texto);
}

function carregarMarcasDoArquivo(pastaDados) {
  const arq = path.join(pastaDados, "marcas.txt");
  try { return fs.readFileSync(arq, "utf-8"); } catch { return null; }
}

module.exports = { CONFIG_PADRAO, carregarConfig, salvarConfig, carregarRegrasReferencia, carregarMarcasDoArquivo };
