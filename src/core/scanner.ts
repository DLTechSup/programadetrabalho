/**
 * Scanner: aprende pares (marca, cor) -> abreviação a partir de planilhas JÁ PRONTAS.
 *
 * Numa planilha pronta cada variação tem:
 *   Código    = <Código Pai> + <ABREVIAÇÃO> + <Tamanho>      ex: VZ2024PT37
 *   Descrição = Cor:<cor>;Tamanho:<tamanho>                   ex: Cor:Preto;Tamanho:37
 * então abreviação = Código sem o prefixo (pai) e sem o sufixo (tamanho).
 */
import { limparNomeCor, limpo, type BancoCores, type Planilha } from "./nucleo";

export interface ParCor {
  marca: string; // maiúscula, como o banco de cores usa
  cor: string; // minúscula
  abrev: string;
}

export interface ParAgregado extends ParCor {
  ocorrencias: number;
  /** outras abreviações vistas para o mesmo marca+cor (conflito entre arquivos) */
  alternativas: string[];
}

export type StatusPar = "nova" | "igual" | "diferente";

const RE_DESC = /^cor\s*:\s*(.*?)\s*;\s*tamanho\s*:\s*(.+)$/i;
const RE_ABREV = /^[\p{L}0-9]{1,16}$/u;

/** Extrai os pares de UMA planilha. `marcaPasta` é o fallback quando a planilha não tem coluna Marca preenchida. */
export function extrairCores(planilha: Planilha, marcaPasta: string): ParCor[] {
  const linhas = planilha.linhas;

  // marca: a mesma que o app vai consultar depois (coluna Marca), senão o nome da pasta
  let marca = "";
  for (const l of linhas) {
    marca = limpo(l["Marca"]);
    if (marca) break;
  }
  marca = (marca || marcaPasta).trim().toUpperCase();

  // código do PAI: linha com Código e Descrição que não segue o padrão de variação
  const codigoPaiLinha =
    linhas.map((l) => ({ c: limpo(l["Código"]), d: limpo(l["Descrição"]) }))
      .find((x) => x.c && !RE_DESC.test(x.d))?.c ?? "";

  const saida: ParCor[] = [];
  for (const l of linhas) {
    const m = RE_DESC.exec(limpo(l["Descrição"]));
    if (!m) continue;
    const cor = limparNomeCor(m[1]).toLowerCase();
    const tamanho = m[2].trim();
    const codigo = limpo(l["Código"]);
    const pai = limpo(l["Código Pai"]) || codigoPaiLinha;
    if (!cor || !codigo || !pai) continue;
    if (!codigo.startsWith(pai) || !codigo.toUpperCase().endsWith(tamanho.toUpperCase())) continue;
    const abrev = codigo.slice(pai.length, codigo.length - tamanho.length).toUpperCase();
    if (!RE_ABREV.test(abrev) || !/\p{L}/u.test(abrev)) continue;
    saida.push({ marca, cor, abrev });
  }
  return saida;
}

/** Junta os pares de vários arquivos: para cada marca+cor fica a abreviação mais frequente. */
export class Agregador {
  private mapa = new Map<string, { marca: string; cor: string; contagem: Map<string, number> }>();

  adicionar(pares: ParCor[]): void {
    for (const p of pares) {
      const chave = `${p.marca}|${p.cor}`;
      let e = this.mapa.get(chave);
      if (!e) this.mapa.set(chave, (e = { marca: p.marca, cor: p.cor, contagem: new Map() }));
      e.contagem.set(p.abrev, (e.contagem.get(p.abrev) ?? 0) + 1);
    }
  }

  get tamanho(): number {
    return this.mapa.size;
  }

  resultado(): ParAgregado[] {
    return [...this.mapa.values()]
      .map((e) => {
        const ordenadas = [...e.contagem.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
        const total = ordenadas.reduce((s, [, n]) => s + n, 0);
        return {
          marca: e.marca, cor: e.cor, abrev: ordenadas[0][0], ocorrencias: total,
          alternativas: ordenadas.slice(1).map(([a]) => a),
        };
      })
      .sort((a, b) => (a.marca + a.cor < b.marca + b.cor ? -1 : 1));
  }
}

export function statusDoPar(banco: BancoCores, p: ParCor): StatusPar {
  const atual = banco.por_marca[`${p.marca}|${p.cor}`];
  if (atual === undefined) return "nova";
  return atual === p.abrev ? "igual" : "diferente";
}

export function abreviacaoAtual(banco: BancoCores, p: ParCor): string | null {
  return banco.por_marca[`${p.marca}|${p.cor}`] ?? null;
}

/**
 * Aplica os pares ao banco (mutando). `sobrescrever`: troca também as abreviações
 * que já existem e são diferentes. O genérico (qualquer marca) só ganha cores novas.
 */
export function aplicarAoBanco(banco: BancoCores, pares: ParCor[], sobrescrever: boolean): { novas: number; atualizadas: number } {
  let novas = 0;
  let atualizadas = 0;
  for (const p of pares) {
    const chave = `${p.marca}|${p.cor}`;
    const atual = banco.por_marca[chave];
    if (atual === undefined) {
      banco.por_marca[chave] = p.abrev;
      novas++;
    } else if (sobrescrever && atual !== p.abrev) {
      banco.por_marca[chave] = p.abrev;
      atualizadas++;
    }
    if (banco.generico[p.cor] === undefined) banco.generico[p.cor] = p.abrev;
  }
  return { novas, atualizadas };
}
