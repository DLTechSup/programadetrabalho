/** "Analista de Dados Sênior" -> "analista-de-dados-senior" */
export function slugificar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function nomeArquivo(cargo: string, extensao: "pdf" | "docx"): string {
  return `curriculo-${slugificar(cargo) || "ajustado"}.${extensao}`;
}

export function nomeArquivoPdf(cargo: string): string {
  const slug = slugificar(cargo);
  return `curriculo-${slug || "ajustado"}.pdf`;
}
