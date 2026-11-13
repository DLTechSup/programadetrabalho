// Regras de referência por marca (ex.: cortar o código da cor no final) -- mesma lógica do
// regras_ref.py original. O arquivo editável (regras_referencia.txt) é lido/gravado pelo
// processo principal do Electron; aqui só a lógica pura de aplicar as regras.
import { compactar } from "./marcas";

export const MODELO_REGRAS_REFERENCIA = `# REGRAS DE REFERENCIA POR MARCA
# Serve para cortar do FINAL da referencia o que e so a cor (voce nao usa).
# Formato, uma por linha:   MARCA | padrao do que cortar no final
#   N = um numero    L = uma letra    qualquer outro sinal vale como esta
# Exemplos:
#   PEGADA | -NN      corta '-01' no final:   133 161-01  ->  133 161
#   MODARE | .NNN     corta '.106' no final:  7226.106   ->  7226
# A referencia completa que veio na etiqueta continua aparecendo na lista (como observacao).
# Linhas que comecam com # sao ignoradas. Sem regra para a marca = a referencia fica completa.

PEGADA | -NN
`;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Converte o padrão em regex: N = número, L = letra, o resto vale literal (ex.: -NN). */
function padraoParaRegex(padrao: string): RegExp {
  let fonte = "";
  for (const c of padrao.trim()) {
    fonte += c === "N" ? "\\d" : c === "L" ? "[A-Za-z]" : escapeRegExp(c);
  }
  return new RegExp(fonte + "\\s*$");
}

export class RegrasReferencia {
  private regras: Record<string, RegExp>;

  constructor(regras: Record<string, RegExp> = {}) {
    this.regras = regras;
  }

  static carregarDeTexto(texto: string): RegrasReferencia {
    const regras: Record<string, RegExp> = {};
    for (let linha of texto.split(/\r?\n/)) {
      linha = linha.trim();
      if (!linha || linha.startsWith("#") || !linha.includes("|")) continue;
      const [marcaBruta, padraoBruto] = linha.split("|", 2);
      const marca = marcaBruta.trim();
      const padrao = padraoBruto?.trim();
      if (marca && padrao) regras[compactar(marca)] = padraoParaRegex(padrao);
    }
    return new RegrasReferencia(regras);
  }

  /** (referência para usar, referência completa se foi cortada senão ''). */
  aplicar(marca: string | null | undefined, referencia: string): [string, string] {
    const rx = this.regras[compactar(marca || "")];
    if (!rx) return [referencia, ""];
    const cortada = referencia.replace(rx, "").trim().replace(/^[ .\-/]+|[ .\-/]+$/g, "");
    if (cortada && cortada !== referencia) return [cortada, referencia];
    return [referencia, ""];
  }
}
