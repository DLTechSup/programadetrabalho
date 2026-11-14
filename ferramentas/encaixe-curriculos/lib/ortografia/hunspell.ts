/**
 * Verificador ortográfico compatível com dicionários Hunspell (usado com o
 * dicionário VERO de português do Brasil).
 *
 * Em vez de expandir todas as formas das palavras (milhões, lento no navegador),
 * confere cada palavra retirando prefixos e sufixos, como o Hunspell faz.
 * Carrega em poucas centenas de milissegundos.
 */

interface Regra {
  flag: string;
  retirar: string;
  acrescentar: string;
  continuacao: string;
  condicao: RegExp | null;
  cruzada: boolean;
}

function lerCondicao(cond: string, sufixo: boolean): RegExp | null {
  if (cond === "." || cond === "") return null;
  try {
    return new RegExp(sufixo ? `${cond}$` : `^${cond}`, "u");
  } catch {
    return null;
  }
}

export class VerificadorHunspell {
  private radicais = new Map<string, string>();
  private sufixos = new Map<string, Regra[]>();
  private prefixos = new Map<string, Regra[]>();
  private porContinuacao = new Map<string, Regra[]>();
  private maiorSufixo = 0;
  private maiorPrefixo = 0;
  private proibida = "";
  readonly trocasComuns: Array<[string, string]> = [];

  constructor(aff: string, dic: string) {
    this.lerAff(aff);
    this.lerDic(dic);
  }

  private lerAff(aff: string) {
    const cruzada = new Map<string, boolean>();
    for (const linha of aff.split(/\r?\n/)) {
      if (!linha || linha.startsWith("#")) continue;
      const partes = linha.trim().split(/\s+/);
      const tipo = partes[0];
      if (tipo === "FORBIDDENWORD") this.proibida = partes[1] ?? "";
      else if (tipo === "REP" && partes.length === 3) this.trocasComuns.push([partes[1], partes[2]]);
      else if (tipo === "SFX" || tipo === "PFX") {
        const flag = partes[1];
        if (partes.length === 4 && /^[YN]$/.test(partes[2])) {
          cruzada.set(`${tipo}${flag}`, partes[2] === "Y");
          continue;
        }
        if (partes.length < 5) continue;
        const [acrescentarBruto, continuacao = ""] = partes[3].split("/");
        const regra: Regra = {
          flag,
          retirar: partes[2] === "0" ? "" : partes[2],
          acrescentar: acrescentarBruto === "0" ? "" : acrescentarBruto,
          continuacao,
          condicao: lerCondicao(partes[4], tipo === "SFX"),
          cruzada: cruzada.get(`${tipo}${flag}`) ?? false,
        };
        const indice = tipo === "SFX" ? this.sufixos : this.prefixos;
        const lista = indice.get(regra.acrescentar) ?? [];
        lista.push(regra);
        indice.set(regra.acrescentar, lista);
        if (tipo === "SFX") {
          this.maiorSufixo = Math.max(this.maiorSufixo, regra.acrescentar.length);
          for (const f of continuacao) {
            const l = this.porContinuacao.get(f) ?? [];
            l.push(regra);
            this.porContinuacao.set(f, l);
          }
        } else {
          this.maiorPrefixo = Math.max(this.maiorPrefixo, regra.acrescentar.length);
        }
      }
    }
  }

  private lerDic(dic: string) {
    const linhas = dic.split(/\r?\n/);
    for (let i = 1; i < linhas.length; i++) {
      const linha = linhas[i];
      if (!linha) continue;
      const fim = linha.search(/[\t ]/);
      const entrada = fim === -1 ? linha : linha.slice(0, fim);
      const barra = entrada.indexOf("/");
      const palavra = barra === -1 ? entrada : entrada.slice(0, barra);
      const flags = barra === -1 ? "" : entrada.slice(barra + 1);
      this.radicais.set(palavra, (this.radicais.get(palavra) ?? "") + flags + "|");
    }
  }

  private temFlag(radical: string, flag: string): boolean {
    const f = this.radicais.get(radical);
    return !!f && f.includes(flag) && !(this.proibida && f.includes(this.proibida));
  }

  private existeSimples(palavra: string): boolean {
    const f = this.radicais.get(palavra);
    return f !== undefined && !(this.proibida && f.includes(this.proibida));
  }

  /** Confere sufixos (inclusive dois sufixos encadeados). `exigir` limita aos cruzáveis com prefixo. */
  private porSufixo(palavra: string, flagPrefixo?: string): boolean {
    const max = Math.min(this.maiorSufixo, palavra.length - 1);
    for (let n = 0; n <= max; n++) {
      const regras = this.sufixos.get(palavra.slice(palavra.length - n));
      if (!regras) continue;
      const base = palavra.slice(0, palavra.length - n);
      for (const r of regras) {
        if (flagPrefixo && !r.cruzada) continue;
        const radical = base + r.retirar;
        if (r.condicao && !r.condicao.test(radical)) continue;
        if (this.temFlag(radical, r.flag) && (!flagPrefixo || this.temFlag(radical, flagPrefixo))) return true;
        if (flagPrefixo) continue;
        // Segundo sufixo: a regra r está na continuação de outra regra r1.
        for (const r1 of this.porContinuacao.get(r.flag) ?? []) {
          if (!radical.endsWith(r1.acrescentar)) continue;
          const radical1 = radical.slice(0, radical.length - r1.acrescentar.length) + r1.retirar;
          if (r1.condicao && !r1.condicao.test(radical1)) continue;
          if (this.temFlag(radical1, r1.flag)) return true;
        }
      }
    }
    return false;
  }

  private porPrefixo(palavra: string): boolean {
    const max = Math.min(this.maiorPrefixo, palavra.length - 1);
    for (let n = 1; n <= max; n++) {
      const regras = this.prefixos.get(palavra.slice(0, n));
      if (!regras) continue;
      for (const r of regras) {
        const radical = r.retirar + palavra.slice(n);
        if (r.condicao && !r.condicao.test(radical)) continue;
        if (this.temFlag(radical, r.flag)) return true;
        if (r.cruzada && this.porSufixo(radical, r.flag)) return true;
      }
    }
    return false;
  }

  private confere(palavra: string): boolean {
    return this.existeSimples(palavra) || this.porSufixo(palavra) || this.porPrefixo(palavra);
  }

  /** A palavra existe no dicionário (aceita inicial maiúscula e palavras todas em maiúsculas). */
  correta(palavra: string): boolean {
    if (this.confere(palavra)) return true;
    const minuscula = palavra.toLocaleLowerCase("pt-BR");
    if (minuscula !== palavra && this.confere(minuscula)) return true;
    return false;
  }

  /** Sugestões: trocas comuns do dicionário, acentos e erros de uma letra. */
  sugerir(palavra: string, limite = 3): string[] {
    const inicialMaiuscula = /^\p{Lu}/u.test(palavra);
    const base = palavra.toLocaleLowerCase("pt-BR");
    const candidatas: string[] = [];
    const vistas = new Set<string>([base]);
    const testar = (c: string) => {
      if (vistas.has(c) || candidatas.length >= limite * 4) return;
      vistas.add(c);
      if (c.includes(" ") ? c.split(" ").every((p) => this.confere(p)) : this.confere(c)) candidatas.push(c);
    };

    // 1. Acentos e cedilha (erro mais comum)
    const variantes: Record<string, string[]> = {
      a: ["á", "â", "ã", "à"], e: ["ê", "é"], i: ["í"], o: ["ó", "ô", "õ"], u: ["ú"], c: ["ç"],
      á: ["a", "â", "ã"], é: ["e", "ê"], ê: ["e", "é"], ó: ["o", "ô"], ô: ["o", "ó"], ç: ["c"],
    };
    for (let i = 0; i < base.length; i++) {
      for (const v of variantes[base[i]] ?? []) testar(base.slice(0, i) + v + base.slice(i + 1));
    }

    // 2. Trocas comuns do dicionário (REP): "ss" -> "ç", "excessão" -> "exceção"…
    for (const [de, para] of this.trocasComuns) {
      const deR = de.replace(/_/g, " ");
      const paraR = para.replace(/_/g, " ");
      let i = base.indexOf(deR);
      while (i !== -1) {
        testar(base.slice(0, i) + paraR + base.slice(i + deR.length));
        i = base.indexOf(deR, i + 1);
      }
    }

    // 3. Uma letra a mais, a menos, trocada ou invertida
    const letras = "abcdefghijlmnopqrstuvxzçáéíóúâêôãõ";
    for (let i = 0; i <= base.length; i++) {
      if (i < base.length) testar(base.slice(0, i) + base.slice(i + 1));
      if (i < base.length - 1) testar(base.slice(0, i) + base[i + 1] + base[i] + base.slice(i + 2));
      for (const l of letras) {
        if (i < base.length) testar(base.slice(0, i) + l + base.slice(i + 1));
        testar(base.slice(0, i) + l + base.slice(i));
      }
    }
    // Palavras grudadas ("porisso" -> "por isso"), só se não houver sugestão melhor.
    if (candidatas.length === 0) {
      for (let i = 2; i <= base.length - 2; i++) testar(`${base.slice(0, i)} ${base.slice(i)}`);
    }

    // Quase ninguém erra a primeira letra: prioriza sugestões que a mantêm (ordem estável).
    const primeira = base[0];
    return candidatas
      .map((c, i) => ({ c, i, peso: c[0] === primeira ? 0 : 1 }))
      .sort((x, y) => x.peso - y.peso || x.i - y.i)
      .map((x) => x.c)
      .slice(0, limite)
      .map((c) => (inicialMaiuscula ? c.charAt(0).toLocaleUpperCase("pt-BR") + c.slice(1) : c));
  }
}
