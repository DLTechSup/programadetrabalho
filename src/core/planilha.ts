import * as XLSX from "xlsx";
import type { Linha, Planilha, Valor } from "./nucleo";

/** Lê .xls (formato que o Bling exporta) ou .xlsx a partir dos bytes do arquivo. */
export function lerPlanilha(dados: ArrayBuffer | Uint8Array): Planilha {
  let livro: XLSX.WorkBook;
  try {
    livro = XLSX.read(dados, { type: "array", cellDates: true });
  } catch {
    throw new Error(
      "Não consegui abrir este arquivo. Verifique se é uma planilha Excel (.xls ou .xlsx) exportada do Bling.",
    );
  }
  const nomeAba = livro.SheetNames[0];
  if (!nomeAba) throw new Error("A planilha não tem nenhuma aba.");

  const aoa = XLSX.utils.sheet_to_json<Valor[]>(livro.Sheets[nomeAba], {
    header: 1,
    defval: null,
    raw: true,
  });
  if (aoa.length === 0) throw new Error("A planilha está vazia.");

  // Cabeçalhos: vazios viram "Unnamed: n" e repetidos ganham sufixo ".n" (como o pandas).
  const usados = new Map<string, number>();
  const colunas = aoa[0].map((h, idx) => {
    let nome = h === null || h === undefined || String(h).trim() === "" ? `Unnamed: ${idx}` : String(h);
    const vezes = usados.get(nome) ?? 0;
    usados.set(nome, vezes + 1);
    if (vezes > 0) nome = `${nome}.${vezes}`;
    return nome;
  });

  const linhas: Linha[] = aoa.slice(1).map((celulas) => {
    const linha: Linha = {};
    colunas.forEach((c, i) => {
      const v = celulas[i];
      linha[c] = v === undefined || v === "" ? null : v;
    });
    return linha;
  });

  // descarta linhas totalmente vazias no final (sobras da exportação)
  while (linhas.length && colunas.every((c) => linhas[linhas.length - 1][c] === null)) linhas.pop();

  return { colunas, linhas };
}

/** Gera os bytes de um .xlsx pronto para importar no Bling. */
export function gerarXlsx(planilha: Planilha): Uint8Array {
  const aoa: Valor[][] = [
    planilha.colunas,
    ...planilha.linhas.map((l) => planilha.colunas.map((c) => (l[c] === undefined ? null : l[c]))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  ws["!cols"] = planilha.colunas.map((c) => ({ wch: Math.min(Math.max(c.length + 2, 12), 40) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Produtos");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
}
