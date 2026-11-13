// Extração do número de referência a partir do texto da etiqueta -- mesma lógica do
// referencia.py original.

const CODIGO = String.raw`\d[\d.\-/ ]{2,24}\d`;
const RE_CODIGO = new RegExp(CODIGO, "g");
const RE_APOS_ROTULO = new RegExp(
  String.raw`(?:REF(?:ER[EÊ]NCIA)?|REFER|ARTIGO|ART|MOD(?:ELO)?)\s*[.:;#°ºN\-]*\s*(${CODIGO})`,
  "gi",
);
const RE_ROTULO_COM_LETRAS = new RegExp(
  String.raw`(?:REF(?:ER[EÊ]NCIA)?)\s*[.:;#°º\-]*\s*([A-Z]{0,3}\s?\d[\w.\-/]{2,24})`,
  "gi",
);
const RE_ROTULO_NOME = /(?:REF(?:ER[EÊ]NCIA)?|MODELO|ARTIGO)\s*[.:;#°º\-]+\s*([A-Za-zÀ-ú][A-Za-zÀ-ú0-9 .\-/]{1,30})/i;
const RE_ROTULO_SO = /^(REF\w*|ARTIGO|MODELO)[\s.:]*$/i;
const RE_DATA = /^\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}$/;

function limpar(cod: string): string {
  const semEspacos = cod.replace(/\s*([.\-/])\s*/g, "$1");
  return semEspacos.replace(/\s+/g, " ").trim().replace(/^[ .\-/]+|[ .\-/]+$/g, "");
}

function digitos(cod: string): number {
  return [...cod].filter((c) => c >= "0" && c <= "9").length;
}

function pareceCodigoDeBarras(cod: string): boolean {
  const puro = cod.replace(/\D/g, "");
  return puro === cod && [8, 12, 13, 14].includes(puro.length);
}

export function extrairReferencia(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const linhas = texto.replace(/\r/g, "\n").replace(/[()]/g, " ");

  for (const padrao of [RE_APOS_ROTULO, RE_ROTULO_COM_LETRAS]) {
    padrao.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = padrao.exec(linhas))) {
      const cod = limpar(m[1]);
      if (digitos(cod) >= 4 && !pareceCodigoDeBarras(cod)) return cod.toUpperCase();
    }
  }

  const mNome = RE_ROTULO_NOME.exec(linhas);
  if (mNome) {
    const nome = mNome[1].split(/\s{2,}|\n/)[0].trim().replace(/^[ .\-/]+|[ .\-/]+$/g, "");
    if (nome.length >= 2) return nome.toUpperCase();
  }

  const partes = linhas.split("\n").map((p) => p.trim()).filter(Boolean);
  for (let i = 0; i < partes.length - 1; i++) {
    if (RE_ROTULO_SO.test(partes[i])) {
      RE_CODIGO.lastIndex = 0;
      const m = RE_CODIGO.exec(partes[i + 1]);
      if (m) {
        const cod = limpar(m[0]);
        if (digitos(cod) >= 4 && !pareceCodigoDeBarras(cod)) return cod.toUpperCase();
      }
    }
  }

  const candidatos: Array<[number, string]> = [];
  RE_CODIGO.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_CODIGO.exec(linhas))) {
    const cod = limpar(m[0]);
    if (digitos(cod) < 4 || pareceCodigoDeBarras(cod)) continue;
    if (RE_DATA.test(cod)) continue;
    const peso = digitos(cod) + (/[.\-]/.test(cod) ? 3 : 0);
    candidatos.push([peso, cod]);
  }
  if (candidatos.length) {
    candidatos.sort((a, b) => a[0] - b[0]);
    return candidatos[candidatos.length - 1][1].toUpperCase();
  }
  return null;
}

/** Chave de agrupamento: ignora pontuação ('123.456' == '123-456'). */
export function chaveReferencia(ref: string | null | undefined): string {
  return (ref || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Remove caracteres proibidos em nomes de pasta (Windows/Mac/Linux). */
export function nomeSeguro(texto: string): string {
  // eslint-disable-next-line no-control-regex
  const limpo = texto.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").trim().replace(/[. ]+$/, "");
  return limpo || "SEM_NOME";
}
