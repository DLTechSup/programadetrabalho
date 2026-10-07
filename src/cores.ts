/** Amostra visual aproximada da cor a partir do nome (só enfeite — não afeta nenhum dado). */
export const PALETA: Record<string, string> = {
  preto: "#1b1b20", black: "#1b1b20", nero: "#1b1b20", carvao: "#2c2f36",
  branco: "#f6f6f8", white: "#f6f6f8", off: "#efe9db", gelo: "#e3edf2", neve: "#f3f6f8", nuvem: "#e8edf3",
  cinza: "#9ba1ab", chumbo: "#565c68", grafite: "#454a54", prata: "#c4c9d1", gris: "#9ba1ab", rato: "#7b808a", iron: "#4b505a",
  dourado: "#d6a93d", ouro: "#d6a93d", gold: "#d6a93d", champagne: "#e6d0a4", champanhe: "#e6d0a4",
  bronze: "#a8743a", cobre: "#b8693d",
  caramelo: "#b97d3e", camel: "#b97d3e", tan: "#b88a56", mel: "#c8963e", conhaque: "#8c4a24", whisky: "#9a5a28", telha: "#b5573a", terracota: "#b5573a",
  cafe: "#5a3b27", expresso: "#4b3020", marrom: "#6b4430", chocolate: "#4f3223", cacau: "#5b3a29", castanho: "#6a4a33", tabaco: "#7a5232", mascavo: "#7b5a3c", avela: "#8a5a33", pinhao: "#8a6a4b", pecan: "#7d5a3d", cappuccino: "#a47e5b", capuccino: "#a47e5b", macchiato: "#b08f6e", cravo: "#7c4a35", canela: "#a1623a", toffee: "#b27a44", havana: "#6e4a2f",
  bege: "#dcc7a8", nude: "#e0bfa5", areia: "#e1cfa9", palha: "#e3d29b", nature: "#d8c6a6", natural: "#d8c6a6", arenito: "#d3b88e", ocre: "#c8963e",
  creme: "#f0e4c4", cream: "#f0e4c4", marfim: "#f1e6c9", baunilha: "#f3e5ba", vanilla: "#f3e5ba", algodao: "#f1ece0", cotton: "#f1ece0", linho: "#d9cdb4", perola: "#ece6dc",
  rosa: "#eb7ba0", rose: "#e8879f", pink: "#ee5c97", fucsia: "#d6338b", petala: "#f2b8c6", quartzo: "#f0b9c4", candy: "#f58fb3", azaleia: "#e0507f",
  vermelho: "#c92f3f", cherry: "#9e1b32", cereja: "#9e1b32", carmim: "#a3162f", vinho: "#6d1f35", ruby: "#a5133a", ameixa: "#5e2750", malbec: "#4c1d3d",
  laranja: "#f28b30", coral: "#f2765f", amarelo: "#f3cb3d", fluor: "#d6ee3a", limao: "#cde04a", lima: "#b4d34b",
  verde: "#4f8a5b", oliva: "#6e7a3a", olive: "#6e7a3a", militar: "#58603a", musgo: "#59663a", salvia: "#8aa58a", eucalipto: "#7fa598", manjericao: "#5f8a46", alecrim: "#68805a", menta: "#9fd8bd", travis: "#2e7d5b",
  azul: "#3b6fd0", royal: "#2850b8", marinho: "#1d2f5c", petroleo: "#1f4a57", jeans: "#4a6fa5", sky: "#7cc4ec", turquesa: "#27b0bd", piscina: "#32b8c9", atlantico: "#2a5f8f",
  roxo: "#7b5fc0", violeta: "#7b5fc0", lavanda: "#b9a6e0", lilas: "#bfa0dc",
  onca: "#b0813f", multi: "#9ca3af",
};

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Retorna um valor CSS de background (cor sólida ou degradê de duas cores) para o nome da cor. */
export function amostraCor(nome: string): string {
  const achadas: string[] = [];
  for (const palavra of normalizar(nome).split(/[^a-z]+/)) {
    const hex = PALETA[palavra];
    if (hex && !achadas.includes(hex)) achadas.push(hex);
    if (achadas.length === 2) break;
  }
  if (achadas.length === 0) return "repeating-linear-gradient(45deg, #d5d9e2 0 4px, #eceff5 4px 8px)";
  if (achadas.length === 1) return achadas[0];
  return `linear-gradient(135deg, ${achadas[0]} 50%, ${achadas[1]} 50%)`;
}
