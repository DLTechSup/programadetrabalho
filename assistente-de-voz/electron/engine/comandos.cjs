// Interpretador de comandos em português: transforma a frase falada em uma "intenção".
// É baseado em regras (offline, sem custo e previsível). Cada regra tem exemplos em EXEMPLOS.
const { normalizar, extrairNumero, numeroOuOrdinal, similaridade } = require("./texto.cjs");

const ABRIR = "(?:abre|abra|abrir|abri|inicia|inicie|iniciar|executa|execute|executar|roda|rode|rodar|lanca|lance|chama|chame|carrega|carregue|liga|ligue|me abre|me abra)";
const FECHAR = "(?:fecha|feche|fechar|encerra|encerre|encerrar|finaliza|finalize|finalizar|termina|termine|sai d[eao]|sair d[eao]|mata|mate|matar)";
const IR = "(?:vai|va|ir|volta|volte|voltar|muda|mude|mudar|troca|troque|trocar|foca|foque|focar|traz|traga|trazer|mostra|mostre|mostrar|ativa|ative)";
const ART = "(?:o |a |os |as |um |uma )?";
const PROCURAR = "(?:procura|procure|procurar|pesquisa|pesquise|pesquisar|busca|busque|buscar|acha|ache|achar|encontra|encontre|encontrar|localiza|localize|localizar)";
const REF = "(?:referencia|referencias|ref|modelo|codigo|cod)";

const NAVEGADORES = [
  [/\b(?:google chrome|chrome|cromio)\b/, "chrome"],
  [/\b(?:microsoft edge|edge|ejs)\b/, "edge"],
  [/\b(?:mozilla firefox|firefox|mozilla)\b/, "firefox"],
  [/\bbrave\b/, "brave"],
  [/\bopera\b/, "opera"],
];
const RE_NAV_CALDA = /\b(?:no|do|pelo|na|em|com|pela|usando o|usando) (?:o )?(?:google chrome|chrome|microsoft edge|edge|mozilla firefox|firefox|mozilla|brave|opera)\b/g;

function detectarNavegador(n) {
  for (const [re, nome] of NAVEGADORES) if (re.test(n)) return nome;
  return null;
}

/** pega as últimas k palavras do texto original (preserva maiúsculas/acentos de um nome). */
function caudaOriginal(raw, k) {
  const toks = String(raw).split(/\s+/).filter((t) => normalizar(t));
  return toks.slice(Math.max(0, toks.length - k)).join(" ").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

const LIMPAR_INICIO = /^(?:por favor |pode |poderia |podia |voce pode |vc pode |quero que voce |eu quero |quero |gostaria de |preciso que voce |preciso |me |ai |entao |agora |so |vamos |bora |ok |certo |jarvis |e |hey |ei )+/;
const LIMPAR_FIM = /(?: por favor| pra mim| para mim| agora| ai| obrigado| obrigada| valeu| ta| ne)+$/;

function limpar(n) {
  let t = n;
  for (let i = 0; i < 3; i++) t = t.replace(LIMPAR_INICIO, "").replace(LIMPAR_FIM, "").trim();
  return t;
}

// Palavras de comando que o reconhecedor costuma errar um pouco ("pasto", "past" -> "pasta").
const VOCAB = ["abre", "abra", "abrir", "fecha", "feche", "fechar", "pasta", "pastas", "marca", "referencia", "arquivo", "arquivos", "volume", "aba", "abas", "janela", "pesquisa", "pesquisar", "procura", "procurar", "lista", "volta", "troca", "minimiza", "maximiza", "proxima", "anterior", "mostra", "aumenta", "abaixa", "navegador", "programa", "site"];
const OK_SOLTAS = new Set(["a", "o", "as", "os", "de", "da", "do", "no", "na", "em", "um", "uma", "e", "que", "para", "pra", "por", "com", "se", "me", "te", "vai", "va", "ir", "ali", "ai", "la"]);

/** Corrige só a palavra do verbo (1ª) e o substantivo logo depois ("abre a pasto") — nunca nomes de marcas/programas. */
function corrigirFrase(n) {
  const t = n.split(" ");
  const alvo = new Set([0]);
  for (let i = 1; i < Math.min(t.length, 3); i++) if (OK_SOLTAS.has(t[i - 1]) || VOCAB.includes(t[i - 1])) alvo.add(i);
  for (const i of alvo) {
    const w = t[i];
    if (!w || w.length < 3 || /\d/.test(w) || VOCAB.includes(w) || OK_SOLTAS.has(w)) continue;
    let melhor = null;
    for (const v of VOCAB) {
      const s = similaridade(w, v);
      if (s >= 0.88 && (!melhor || s > melhor.s)) melhor = { v, s };
    }
    if (melhor) t[i] = melhor.v;
  }
  return t.join(" ");
}

const TIPOS_SITE = /\b(?:google|internet|web|youtube|navegador|net)\b/;

/**
 * Interpreta a frase. Devolve { tipo, ... } ou { tipo: "desconhecido", texto }.
 * `raw` é o texto como o reconhecedor devolveu (para preservar nomes próprios).
 */
function interpretar(raw) {
  const n0 = normalizar(raw);
  const n = corrigirFrase(limpar(n0));
  if (!n) return { tipo: "vazio" };
  const nav = detectarNavegador(n);
  const nn = n.replace(RE_NAV_CALDA, " ").replace(/\s+/g, " ").trim(); // sem "no chrome" (para as regras do navegador)
  let m;

  // ---------- meta
  if ((m = n.match(/(?:seu nome (?:agora )?e|teu nome (?:agora )?e|seu novo nome e|(?:vou|vamos|quero) te chamar de|te chamar de|passa a se chamar|passe a se chamar|(?:muda|mude|troca|troque|altera|altere)(?: o)? (?:seu|teu) nome (?:para|pra|por)|(?:voce|vc) (?:agora )?(?:se )?chama|agora (?:voce|vc) (?:se )?chama|seu nome passa a ser|nome de ativacao e)\s*(.*)$/))) {
    const cauda = m[1].trim();
    const k = cauda ? cauda.split(" ").length : 0;
    return { tipo: "renomear", nome: k ? caudaOriginal(raw, k) : "" };
  }
  if (/^(?:cancela|cancelar|cancele|esquece|esqueca|deixa(?: pra la)?|nao|para|pare|parar|chega|nenhum|nenhuma|deixa quieto)$/.test(n)) return { tipo: "cancelar" };
  if (/^(?:pode )?(?:dormir|descansar|ficar quiet[oa]|silencio|modo (?:de )?espera|ate logo|ate mais|tchau|obrigad[oa]|era so isso|so isso|e so|nada nao|valeu|pode ir)$/.test(n)) return { tipo: "dormir" };
  if (/^(?:para de ouvir|pare de ouvir|desliga(?:r)? (?:o )?microfone|pausa(?:r)? (?:a )?escuta|ignora(?:r)? tudo)$/.test(n)) return { tipo: "pausar_escuta" };
  if (/^(?:ajuda|me ajuda|comandos|o que (?:voce )?(?:sabe|pode) fazer|quais (?:sao )?(?:os )?comandos|lista de comandos)$/.test(n)) return { tipo: "ajuda" };
  if (/^(?:repete|repita|fala de novo|diz de novo|como|hein|nao entendi)$/.test(n)) return { tipo: "repetir" };
  if (/(?:que horas sao|qual (?:e )?a hora|me diz as horas|horas)/.test(n) && n.split(" ").length <= 6) return { tipo: "hora" };

  // ---------- volume e mídia
  if (/\b(?:desmuta(?:r)?|desmute|volta(?:r)? o som|ativa(?:r)? o som|reativa(?:r)? o som|tira(?:r)? do mudo|liga(?:r)? o som|ligue o som)\b/.test(n)) return { tipo: "volume", op: "som" };
  if (/\b(?:mudo|silencia(?:r)?|silencie|muta(?:r)?|mute|tira(?:r)? o som|sem som|desliga(?:r)? o som|desligue o som)\b/.test(n)) return { tipo: "volume", op: "mudo" };
  const SOBE = "(?:aumenta|aumente|aumentar|sobe|suba|subir|levanta|levante|eleva|mais alto|mais forte|aumenta|alto)";
  const DESCE = "(?:abaixa|abaixe|abaixar|diminui|diminua|diminuir|reduz|reduza|reduzir|desce|desca|descer|mais baixo|mais fraco|baixa|baixe|baixar|baixo)";
  const delta = (t) => (/\b(?:pouco|pouquinho|leve)\b/.test(t) ? 5 : /\b(?:bastante|muito)\b/.test(t) ? 25 : (extrairNumero(t) ?? 10));
  if (new RegExp(`\\b${SOBE}\\b.*\\b(?:volume|som)\\b|\\b(?:volume|som)\\b.*\\b${SOBE}\\b|^(?:mais alto|mais forte)$`).test(n)) return { tipo: "volume", op: "mais", delta: delta(n) };
  if (new RegExp(`\\b${DESCE}\\b.*\\b(?:volume|som)\\b|\\b(?:volume|som)\\b.*\\b${DESCE}\\b|^(?:mais baixo|mais fraco)$`).test(n)) return { tipo: "volume", op: "menos", delta: delta(n) };
  if ((m = n.match(/\bvolume (?:(?:em|no|para|pra|a|de|ao) )?(.+)$/)) || (m = n.match(/(?:coloca|colocar|poe|ponha|deixa|deixe|bota|ajusta|ajuste|define|defina|muda|mude)(?: o)? (?:volume|som)(?: (?:em|no|para|pra|a|ao))? ?(.+)$/))) {
    const t = m[1];
    let v = null;
    if (/\b(?:maximo|maxima|tudo|total)\b/.test(t)) v = 100;
    else if (/\b(?:metade|meio)\b/.test(t)) v = 50;
    else if (/\bminimo|minima\b/.test(t)) v = 5;
    else v = extrairNumero(t);
    if (v != null && v >= 0 && v <= 100 && !/\b(?:mais|menos)\b/.test(t)) return { tipo: "volume", op: "definir", valor: v };
  }
  if (/^(?:pausa(?:r)?|pause|da pause|para)(?: a| o)?(?: musica| video| som| tudo)?$/.test(n) || /^(?:pausa(?:r)?|pause)(?: a| o)? (?:musica|video)$/.test(n)) return { tipo: "midia", op: "pausar" };
  if (/^(?:toca|toque|tocar|play|continua(?:r)?|continue|retoma(?:r)?|despausa(?:r)?)(?: a| o)?(?: musica| video)?$/.test(n)) return { tipo: "midia", op: "tocar" };
  if (/(?:proxima|avanca|pula|pular)(?: a)? (?:musica|faixa|video)|proxima faixa/.test(n)) return { tipo: "midia", op: "proxima" };
  if (/(?:musica|faixa) anterior|(?:anterior|volta(?:r)?)(?: a)? (?:musica|faixa)/.test(n)) return { tipo: "midia", op: "anterior" };

  // ---------- navegador: abas
  if (/\b(?:aba|abas|guia|guias)\b/.test(nn)) {
    if ((m = nn.match(/(?:nova (?:aba|guia)|abre(?:r)? uma (?:nova )?(?:aba|guia)|abra uma (?:nova )?(?:aba|guia))(?: (?:com|no|em|do|da|de) (?:o |a )?(?:site |pagina )?(.+))?$/))) return { tipo: "aba", op: "nova", url: m[1] || "", navegador: nav };
    if (/(?:fecha|feche|fechar)(?: (?:essa|esta|a))? (?:aba|guia)(?: atual)?$/.test(nn)) return { tipo: "aba", op: "fechar", navegador: nav };
    if (/(?:reabre|reabrir|reabra|restaura|restaurar|abre de novo|abrir de novo|volta com|recupera|recuperar)(?: a)?(?: ultima)? (?:aba|guia)(?: fechada)?/.test(nn)) return { tipo: "aba", op: "reabrir", navegador: nav };
    if ((m = nn.match(new RegExp(`(?:${IR}|abre|abrir|procura|procure|acha|ache|seleciona|selecione)(?: para| pra| na| a| no| em| ate)? ?(?:a |o )?(?:aba|guia) (?:do |da |de |dos |das |com |chamada |chamado |que tem )(.+)$`)))) return { tipo: "aba", op: "nome", nome: m[1], navegador: nav };
    if (/(?:aba|guia) (?:anterior|de tras|passada)|(?:anterior|de tras) (?:aba|guia)|volta(?:r)? (?:a |para a |pra )?(?:aba|guia)$/.test(nn)) return { tipo: "aba", op: "anterior", navegador: nav };
    if (/(?:proxima|seguinte|avanca|da frente)(?: a)? ?(?:aba|guia)|(?:aba|guia) (?:seguinte|proxima|da frente)|(?:muda|mude|troca|troque|passa|passe|vai|va) (?:de|para a|pra) (?:aba|guia)$|^(?:muda|troca) de aba/.test(nn)) return { tipo: "aba", op: "proxima", navegador: nav };
    const ord = nn.match(/\b(ultima)\b/) ? 9 : numeroOuOrdinal(nn.replace(/\b(?:aba|abas|guia|guias)\b/g, " "));
    if (ord != null && ord >= 1 && ord <= 9) return { tipo: "aba", op: "numero", n: ord, navegador: nav };
  }
  if (/^(?:recarrega|recarregue|recarregar|atualiza|atualize|atualizar|da refresh)(?: a| o)?(?: pagina| site)?$/.test(nn)) return { tipo: "nav", op: "recarregar", navegador: nav };
  if (/^(?:volta|voltar|volte|retorna|retornar)(?: a| para a| pra)? pagina(?: anterior)?$|^pagina anterior$/.test(nn)) return { tipo: "nav", op: "voltar", navegador: nav };
  if (/^(?:avanca|avancar|avance)(?: a| para a| pra)? pagina$|^(?:pagina seguinte|proxima pagina)$/.test(nn)) return { tipo: "nav", op: "avancar", navegador: nav };
  if (/(?:janela|guia|aba) (?:anonima|privada|incognito)|modo (?:anonimo|privado)|incognito/.test(nn)) return { tipo: "nav", op: "anonima", navegador: nav };
  if (/^(?:abre(?:r)? )?(?:uma )?nova janela$|(?:abre|abrir|abra) (?:uma )?nova janela/.test(nn) && nav) return { tipo: "nav", op: "nova_janela", navegador: nav };
  if (/tela cheia/.test(nn)) return { tipo: "nav", op: "tela_cheia", navegador: nav };

  // ---------- pastas, marcas, referências e arquivos
  const marcaRef = (marca, ref) => ({ tipo: "abrir_marca", marca: marca.trim(), ref: (ref || "").trim() });
  if ((m = n.match(new RegExp(`^${ABRIR}|^(?:mostra|mostrar|vai para|va para|entra n[ao]|entre n[ao]|acessa|acesse) `)) ) !== null) {
    const resto = n.replace(new RegExp(`^(?:${ABRIR.slice(3, -1)}|mostra|mostrar|vai para|va para|entra n[ao]|entre n[ao]|acessa|acesse) ?`), "").replace(/^(?:a |o |as |os )/, "");
    // "referência X [da marca Y]"
    if ((m = resto.match(new RegExp(`^${REF} (.+?)(?: (?:da|na|de|do|no|dentro da|dentro de|dentro do) (?:marca |pasta )?(.+))?$`)))) {
      return { tipo: "abrir_ref", ref: m[1].trim(), marca: (m[2] || "").trim() };
    }
    // "marca X [referência Y]"  /  "pasta da marca X ..."
    if ((m = resto.match(new RegExp(`^(?:pasta )?(?:da |de |do )?marca (.+?)(?: ${REF} (.+))?$`)))) return marcaRef(m[1], m[2]);
    // "X referência Y"
    if ((m = resto.match(new RegExp(`^(.+?) ${REF} (.+)$`))) && !/\b(?:arquivo|arquivos)\b/.test(m[1])) return marcaRef(m[1], m[2]);
  }
  if ((m = n.match(new RegExp(`^${PROCURAR}(?: (?:pela|pelo|por|a|o))?(?: ${REF}| arquivo| pasta)? (.+?) (?:na|no|dentro da|dentro do|dentro de|em|da|do) (?:pasta |marca |pasta da marca )?(.+)$`)))) {
    const explicito = /\b(?:pasta|marca)\b/.test(n.slice(n.indexOf(m[1]) + m[1].length));
    if (TIPOS_SITE.test(m[2])) return { tipo: "pesquisar", termo: m[1].trim(), destino: m[2].includes("youtube") ? "youtube" : "web", navegador: nav };
    if (explicito || /\d/.test(m[1])) return { tipo: "pesquisar_em", termo: m[1].trim(), onde: m[2].trim() };
  }
  if ((m = n.match(new RegExp(`^${PROCURAR}(?: (?:pela|pelo|por|a|o))? ${REF} (.+)$`)))) return { tipo: "pesquisar", termo: m[1].trim(), destino: "pasta" };
  if (new RegExp(`^(?:lista|listar|liste|mostra|mostrar|mostre|quais sao|quais|le|ler|fala|diz|me diz)(?: os| as| todos os| todas as)? (?:arquivos?|fotos?|imagens|planilhas?|itens|conteudo)(?: (?:da|do|dessa|desta|nessa|nesta|dentro).*)?$`).test(n)) return { tipo: "listar_arquivos" };
  if ((m = n.match(new RegExp(`^${ABRIR}(?: o| a)? (?:arquivo|pdf|planilha|foto|imagem|documento|video|excel|word) (.+)$`)))) return { tipo: "abrir_arquivo", nome: m[1].trim() };
  if ((m = n.match(new RegExp(`^(?:${ABRIR.slice(3, -1)}|mostra|mostrar|vai para|va para)(?: a| o)? (?:pasta|diretorio|unidade|disco|drive) (?:de |do |da )?(.+)$`)))) return { tipo: "abrir_pasta", nome: m[1].trim() };
  if (/(?:volta|voltar|sobe|subir|sai)(?: uma| para a| pra)? pasta(?: acima| anterior| de cima)?$|^pasta (?:acima|anterior)$/.test(n)) return { tipo: "pasta_acima" };
  if ((m = n.match(/^(?:a |o )?(?:pasta|diretorio) (?:de |do |da )?(.+)$/)) && !/^(?:acima|anterior|atual)$/.test(m[1])) return { tipo: "abrir_pasta", nome: m[1].trim() };
  if (new RegExp(`^${FECHAR}(?: (?:essa|esta|a|todas as|todas|as))? ?(?:pasta|pastas|explorador|janelas de pasta)(?: atual)?$`).test(n)) return { tipo: "fechar_pasta", todas: /\btodas?\b|\bpastas\b/.test(n) };

  // ---------- pesquisa na web / sites
  if ((m = nn.match(/^(?:pesquisa|pesquise|pesquisar|procura|procure|procurar|busca|busque|buscar|googla|pergunta ao google)(?: (?:no |na |pelo )?(?:google|internet|web|youtube|navegador))? ?(?:por |sobre |a respeito de |pelo |no youtube )?(.+)$/))) {
    const destino = /youtube/.test(nn) ? "youtube" : TIPOS_SITE.test(nn.slice(0, nn.length - m[1].length)) || nav ? "web" : null;
    return { tipo: "pesquisar", termo: m[1].trim(), destino, navegador: nav };
  }
  if ((m = nn.match(new RegExp(`^(?:${ABRIR.slice(3, -1)}|vai para|va para|acessa|acesse|entra n[ao]|entre n[ao]|navega para)(?: o| a)? (?:site|pagina|endereco|link) (?:do |da |de )?(.+)$`)))) return { tipo: "abrir_site", site: m[1].trim(), navegador: nav };

  // ---------- janelas
  if (/^(?:troca|trocar|muda|mudar|alterna|alternar|passa|passar|vai)(?: de| para a| pra| a| para)? (?:proxima )?janela(?: seguinte| proxima)?$|^proxima janela$|^alt tab$/.test(n)) return { tipo: "janela", op: "trocar" };
  if (/(?:mostra|mostrar|mostre|vai para|va para|volta para|ir para)(?: a)? (?:area de trabalho|desktop)|minimiza(?:r)? tudo/.test(n)) return { tipo: "janela", op: "area_trabalho" };
  if (new RegExp(`^${FECHAR}(?: (?:essa|esta|a))? janela(?: atual)?$`).test(n)) return { tipo: "janela", op: "fechar_atual" };
  if (/(?:o que (?:esta|tem) abert[oa]|quais (?:programas|janelas) (?:estao )?abert[oa]s|lista(?:r)? (?:as )?janelas)/.test(n)) return { tipo: "janela", op: "listar" };
  if ((m = n.match(/^(minimiza|minimize|minimizar|maximiza|maximize|maximizar|restaura|restaure|restaurar)(?: (?:essa|esta|a|o))?(?: janela)?(?: (?:do |da |de )?(.+))?$/))) {
    const op = m[1].startsWith("mini") ? "minimizar" : m[1].startsWith("maxi") ? "maximizar" : "restaurar";
    return { tipo: "janela", op, nome: (m[2] || "").replace(/^(?:o |a )/, "").trim() };
  }

  // ---------- programas
  if ((m = n.match(new RegExp(`^${FECHAR} ${ART}(?:programa |aplicativo |app |janela )?(?:do |da |de )?(.+)$`)))) {
    return { tipo: "fechar_programa", nome: m[1].trim(), forcar: /\b(?:mata|mate|matar|forca|forcar)\b/.test(n) };
  }
  if ((m = n.match(new RegExp(`^${ABRIR} ${ART}(?:programa |aplicativo |app |site )?(.+)$`)))) return { tipo: "abrir", alvo: m[1].trim(), navegador: nav };
  if ((m = n.match(new RegExp(`^${IR}(?: para| pra| pro| na| no| ao| a| o)? ?(?:o |a )?(?:janela |programa |aplicativo |app )?(?:do |da |de )?(.+)$`))) && !/^(?:pasta|marca|aba|guia|referencia|area|pagina)/.test(m[1])) {
    return { tipo: "janela", op: "focar", nome: m[1].trim() };
  }
  return { tipo: "desconhecido", texto: n };
}

/** Escolha numa lista: "dois", "o segundo", "último". Devolve índice (0-based) ou null. */
function interpretarEscolha(raw, total) {
  const n = normalizar(raw);
  if (/\bultim[oa]\b/.test(n)) return total - 1;
  const v = numeroOuOrdinal(n);
  if (v != null && v >= 1 && v <= total) return v - 1;
  return null;
}

function ehSim(raw) {
  return /^(?:sim|isso|isso mesmo|pode|pode sim|claro|certo|correto|confirmo|confirma|confirmado|positivo|uhum|aham|ta|ta bom|ok|beleza|manda|faz|fazer|bora)$/.test(normalizar(raw));
}
function ehNao(raw) {
  return /^(?:nao|nao quero|negativo|cancela|cancelar|deixa|esquece|para|pare|nada)$/.test(normalizar(raw));
}

/** Exemplos por categoria: alimentam a tela "Comandos" e a ajuda falada. */
const EXEMPLOS = [
  { titulo: "Marcas e referências", itens: ["Abre a marca Beira Rio", "Abre a marca Beira Rio, referência 8506 ponto 209", "Abre a referência 8506.209 da Beira Rio", "Pesquisa a referência 8367", "Lista os arquivos", "Abre o arquivo ficha", "Volta uma pasta", "Fecha as pastas"] },
  { titulo: "Programas", itens: ["Abre o WhatsApp", "Abre o zap web", "Abre o Excel", "Fecha o Chrome", "Fecha o WhatsApp", "Mata o Excel (fecha à força)"] },
  { titulo: "Navegador (Chrome, Edge, Firefox)", itens: ["Próxima aba", "Aba anterior", "Vai para a aba 3", "Vai para a aba do YouTube", "Nova aba", "Fecha a aba", "Reabre a aba", "Recarrega a página", "Pesquisa no Google preço do dólar", "Abre o site globo.com", "Janela anônima"] },
  { titulo: "Janelas", itens: ["Troca de janela", "Vai para o Excel", "Minimiza essa janela", "Maximiza o Chrome", "Mostra a área de trabalho", "O que está aberto?"] },
  { titulo: "Volume e mídia", itens: ["Aumenta o volume", "Abaixa o volume", "Volume em 30", "Volume no máximo", "Mudo", "Liga o som", "Pausa", "Próxima música"] },
  { titulo: "O próprio assistente", itens: ["Seu nome agora é Assistente", "Pode dormir", "Cancela", "Ajuda"] },
];

module.exports = { corrigirFrase, interpretar, interpretarEscolha, ehSim, ehNao, detectarNavegador, EXEMPLOS };
