// Configurações do assistente (arquivo JSON em %APPDATA%), com valores padrão e validação.
const fs = require("node:fs");
const path = require("node:path");

const PADRAO = {
  versao: 3,
  modoEscuta: "direto", // nome: só reage depois do nome | atalho: só quando aperta o atalho | direto: toda frase é um comando
  atalhoFalar: "Control+Shift+Space",
  silencioMs: 550, // quanto silêncio indica que a frase terminou (menor = mais rápido, mas pode cortar pausas)
  nomeAtivacao: "Jarvis",
  variantes: [], // outras formas que o reconhecedor costuma escrever o nome
  pastaRaiz: "",
  ignorar: ["Nova pasta"],
  aliases: [], // [{ falas: ["zap web"], tipo: "programa"|"caminho"|"url", destino: "..." }]
  falarRespostas: false,
  janelaConversaSeg: 12, // depois de um comando, continua ouvindo sem precisar da palavra de ativação
  escutaAposAtivarSeg: 15,
  modelo: "base", // tiny | base | small
  microfoneId: "",
  filtrosDoNavegador: false, // cancelamento de ruído/eco do Chrome: pode cortar sílabas (principalmente com celular como microfone)
  sensibilidade: 5, // 1..10
  iniciarComWindows: false,
  minimizarParaBandeja: true,
};

const num = (v, min, max, pad) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : pad);

function validar(c) {
  const o = { ...PADRAO, ...(c || {}) };
  // arquivos de versões antigas: as respostas faladas passam a vir desligadas (o foco agora é rapidez)
  if (c && (c.versao || 1) < 2) o.falarRespostas = false;
  // v3: o padrão passa a ser o modo direto (microfone sempre ligado; quem controla o silêncio é o mudo do microfone)
  if (c && (c.versao || 1) < 3) o.modoEscuta = "direto";
  o.versao = 3;
  o.modoEscuta = ["nome", "atalho", "direto"].includes(o.modoEscuta) ? o.modoEscuta : PADRAO.modoEscuta;
  o.atalhoFalar = String(o.atalhoFalar || PADRAO.atalhoFalar).trim().slice(0, 40) || PADRAO.atalhoFalar;
  o.silencioMs = num(o.silencioMs, 250, 1500, PADRAO.silencioMs);
  o.nomeAtivacao = String(o.nomeAtivacao || PADRAO.nomeAtivacao).trim().slice(0, 30) || PADRAO.nomeAtivacao;
  o.variantes = Array.isArray(o.variantes) ? o.variantes.map(String).map((x) => x.trim()).filter(Boolean).slice(0, 20) : [];
  o.pastaRaiz = String(o.pastaRaiz || "");
  o.ignorar = Array.isArray(o.ignorar) ? o.ignorar.map(String).filter(Boolean) : PADRAO.ignorar;
  o.aliases = Array.isArray(o.aliases)
    ? o.aliases
        .filter((a) => a && Array.isArray(a.falas) && a.falas.length && ["programa", "caminho", "url"].includes(a.tipo) && a.destino)
        .map((a) => ({ falas: a.falas.map(String).filter(Boolean), tipo: a.tipo, destino: String(a.destino) }))
    : [];
  o.falarRespostas = !!o.falarRespostas;
  o.janelaConversaSeg = num(o.janelaConversaSeg, 0, 60, PADRAO.janelaConversaSeg);
  o.escutaAposAtivarSeg = num(o.escutaAposAtivarSeg, 3, 60, PADRAO.escutaAposAtivarSeg);
  o.modelo = ["tiny", "base", "small"].includes(o.modelo) ? o.modelo : PADRAO.modelo;
  o.microfoneId = String(o.microfoneId || "");
  o.filtrosDoNavegador = !!o.filtrosDoNavegador;
  o.sensibilidade = num(o.sensibilidade, 1, 10, PADRAO.sensibilidade);
  o.iniciarComWindows = !!o.iniciarComWindows;
  o.minimizarParaBandeja = !!o.minimizarParaBandeja;
  return o;
}

/** Guarda a configuração em `arquivo`. Escrita atômica (nunca deixa o arquivo pela metade). */
function criarConfig(arquivo, { fs: fsx = fs } = {}) {
  let atual = validar(null);
  try {
    atual = validar(JSON.parse(fsx.readFileSync(arquivo, "utf-8")));
  } catch {
    /* primeira execução ou arquivo corrompido: usa o padrão */
  }
  return {
    get: () => atual,
    set(parcial) {
      atual = validar({ ...atual, ...parcial });
      fsx.mkdirSync(path.dirname(arquivo), { recursive: true });
      const tmp = `${arquivo}.tmp`;
      fsx.writeFileSync(tmp, JSON.stringify(atual, null, 2));
      fsx.renameSync(tmp, arquivo);
      return atual;
    },
  };
}

module.exports = { criarConfig, validar, PADRAO };
