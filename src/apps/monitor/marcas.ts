// Lista de marcas conhecidas e seus apelidos, com detecção tolerante a erro de leitura (OCR) --
// mesma lógica do marcas.py original (inclui um port do difflib.SequenceMatcher.ratio() do
// Python, usado pra achar a marca mesmo com pequenos erros de leitura).

export const MARCAS_PADRAO: Record<string, string[]> = {
  "Beira Rio": ["Beira Rio", "BeiraRio"],
  Dakota: ["Dakota"],
  "Via Jupiter": ["Via Jupiter", "ViaJupiter"],
  "BR Sport": ["BR Sport", "BRSport"],
  "Via Marte": ["Via Marte"],
  "Via Uno": ["Via Uno"],
  Vizzano: ["Vizzano"],
  Molekinha: ["Molekinha"],
  Moleca: ["Moleca"],
  Modare: ["Modare"],
  Ramarim: ["Ramarim"],
  Bottero: ["Bottero"],
  Piccadilly: ["Piccadilly"],
  Usaflex: ["Usaflex"],
  Comfortflex: ["Comfortflex"],
  Campesi: ["Campesi"],
  Azaleia: ["Azaleia"],
  Olympikus: ["Olympikus"],
  Grendha: ["Grendha"],
  Ipanema: ["Ipanema"],
  Rider: ["Rider"],
  Kidy: ["Kidy"],
  Pegada: ["Pegada"],
  Democrata: ["Democrata"],
  "Cravo e Canela": ["Cravo e Canela"],
  Arezzo: ["Arezzo"],
  Schutz: ["Schutz"],
  Actvitta: ["Actvitta", "Actvita"],
  "Bebecê": ["Bebecê", "Bebece"],
  "Maria's Shoes": ["Maria's Shoes", "Marias Shoes", "Maria Shoes"],
  Santinelli: ["Santinelli"],
  "Renata Mello": ["Renata Mello"],
  "Di Valentini": ["Di Valentini", "Divalentini"],
  "Três Marias": ["Três Marias", "Tres Marias"],
  Kolosh: ["Kolosh"],
  Mizuno: ["Mizuno"],
  Stir: ["Stir"],
  "Sport Fire": ["Sport Fire"],
  Improviso: ["Improviso"],
  Adrun: ["Adrun"],
  Molekinho: ["Molekinho"],
};

/** MAIÚSCULO, sem acento e só letras/números. */
export function compactar(texto: string): string {
  const semAcento = texto.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  return semAcento.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function carregarMarcas(textoArquivo?: string | null): Record<string, string[]> {
  const marcas: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(MARCAS_PADRAO)) marcas[k] = [...v];
  if (textoArquivo) {
    for (let linha of textoArquivo.split(/\r?\n/)) {
      linha = linha.trim();
      if (!linha || linha.startsWith("#")) continue;
      const nomes = linha.split("|").map((p) => p.trim()).filter(Boolean);
      if (!nomes.length) continue;
      marcas[nomes[0]] = marcas[nomes[0]] || [];
      marcas[nomes[0]].push(...nomes);
    }
  }
  return marcas;
}

/** Acha a marca no texto do OCR (tolera pequenos erros de leitura). */
export function detectarMarca(texto: string, marcas: Record<string, string[]>): string | null {
  const alvo = compactar(texto);
  if (!alvo) return null;
  let melhor: string | null = null;
  let melhorNota = 0;
  for (const [marca, apelidos] of Object.entries(marcas)) {
    for (const apelido of apelidos) {
      const a = compactar(apelido);
      if (!a) continue;
      let nota: number;
      if (alvo.includes(a)) {
        nota = 1.0 + a.length / 100; // acerto exato; apelido maior desempata
      } else if (a.length >= 6) {
        nota = melhorJanela(a, alvo);
        if (nota < 0.85) continue;
      } else {
        continue;
      }
      if (nota > melhorNota) {
        melhor = marca;
        melhorNota = nota;
      }
    }
  }
  return melhor;
}

function melhorJanela(a: string, alvo: string): number {
  const n = a.length;
  let melhor = 0;
  for (const tam of [n - 1, n, n + 1]) {
    const limite = Math.max(1, alvo.length - tam + 1);
    for (let i = 0; i < limite; i++) {
      const r = sequenceRatio(a, alvo.slice(i, i + tam));
      if (r > melhor) melhor = r;
    }
  }
  return melhor;
}

/** Port do difflib.SequenceMatcher(None, a, b).ratio() do Python (sem heurística de "autojunk",
 * irrelevante aqui porque as strings envolvidas são sempre curtas). */
export function sequenceRatio(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const matches = totalMatchingBlocks(a, b);
  return (2 * matches) / (a.length + b.length);
}

function totalMatchingBlocks(a: string, b: string): number {
  const b2j = new Map<string, number[]>();
  for (let j = 0; j < b.length; j++) {
    const c = b[j];
    let arr = b2j.get(c);
    if (!arr) { arr = []; b2j.set(c, arr); }
    arr.push(j);
  }
  let total = 0;
  const pilha: Array<[number, number, number, number]> = [[0, a.length, 0, b.length]];
  while (pilha.length) {
    const [aLo, aHi, bLo, bHi] = pilha.pop()!;
    const [i, j, k] = melhorCorrespondencia(a, aLo, aHi, bLo, bHi, b2j);
    if (k > 0) {
      total += k;
      if (aLo < i && bLo < j) pilha.push([aLo, i, bLo, j]);
      if (i + k < aHi && j + k < bHi) pilha.push([i + k, aHi, j + k, bHi]);
    }
  }
  return total;
}

function melhorCorrespondencia(
  a: string, aLo: number, aHi: number, bLo: number, bHi: number, b2j: Map<string, number[]>,
): [number, number, number] {
  let bestI = aLo, bestJ = bLo, bestSize = 0;
  let j2len = new Map<number, number>();
  for (let i = aLo; i < aHi; i++) {
    const novoJ2len = new Map<number, number>();
    const indices = b2j.get(a[i]);
    if (indices) {
      for (const j of indices) {
        if (j < bLo) continue;
        if (j >= bHi) break;
        const k = (j2len.get(j - 1) || 0) + 1;
        novoJ2len.set(j, k);
        if (k > bestSize) { bestI = i - k + 1; bestJ = j - k + 1; bestSize = k; }
      }
    }
    j2len = novoJ2len;
  }
  return [bestI, bestJ, bestSize];
}
