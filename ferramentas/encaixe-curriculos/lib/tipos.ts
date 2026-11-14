export const CATEGORIAS = ["tecnica", "ferramenta", "comportamental", "certificacao_idioma"] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  tecnica: "Técnicas",
  ferramenta: "Ferramentas",
  comportamental: "Comportamentais",
  certificacao_idioma: "Certificações e idiomas",
};

export interface PalavraChave {
  termo: string;
  variantes: string[];
  categoria: Categoria;
  obrigatorio: boolean;
}

export interface AnaliseVaga {
  cargo: string;
  palavras_chave: PalavraChave[];
}

export interface ResultadoMatch {
  score: number;
  encontradas: PalavraChave[];
  faltando: PalavraChave[];
}

export interface LacunaConfirmada {
  termo: string;
  descricao: string;
}

export interface AvisoRevisao {
  tipo: "termo" | "numero";
  valor: string;
  trecho: string;
}

export interface ResultadoReescrita {
  curriculo: string;
  mudancas: string[];
  avisos: AvisoRevisao[];
}
