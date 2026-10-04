/**
 * Camada de plataforma: no app instalado (Electron) usa os diálogos nativos e
 * grava o banco de cores em disco; no navegador (modo desenvolvimento) cai
 * num equivalente simples, o que permite testar a interface sem o Electron.
 */
export interface ArquivoAberto {
  nome: string;
  caminho?: string;
  dados: Uint8Array;
}

export interface ArquivoScan {
  nome: string;
  marca: string; // 1º nível de pasta
  referencia: string; // 2º nível de pasta
  caminho: string;
  ler(): Promise<Uint8Array>;
}

export interface PastaEscolhida {
  nome: string;
  arquivos: ArquivoScan[];
}

export interface Plataforma {
  nome: "electron" | "web";
  escolherPasta(): Promise<PastaEscolhida | null>;
  abrirArquivo(): Promise<ArquivoAberto | null>;
  salvarArquivo(nomeSugerido: string, dados: Uint8Array): Promise<string | null>;
  carregarCores(): Promise<string | null>;
  salvarCores(json: string): Promise<void>;
  caminhoCores(): Promise<string>;
  exportarCores(json: string): Promise<string | null>;
  importarCores(): Promise<string | null>;
  mostrarNaPasta(caminho: string): Promise<void>;
  versao(): Promise<string>;
}

interface PastaBruta {
  nome: string;
  arquivos: Array<{ nome: string; marca: string; referencia: string; caminho: string }>;
}

declare global {
  interface Window {
    api?: Omit<Plataforma, "nome" | "escolherPasta"> & {
      escolherPasta(): Promise<PastaBruta | null>;
      lerDaPasta(caminho: string): Promise<Uint8Array>;
    };
  }
}

function baixar(nome: string, dados: BlobPart, tipo: string): void {
  const url = URL.createObjectURL(new Blob([dados], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escolherArquivo(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

const CHAVE_CORES = "bling.cores";

const web: Plataforma = {
  nome: "web",
  escolherPasta() {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.setAttribute("webkitdirectory", "");
      input.onchange = () => {
        const arquivos: ArquivoScan[] = [];
        let raiz = "";
        for (const f of Array.from(input.files ?? [])) {
          const partes = f.webkitRelativePath.split("/");
          raiz = partes[0];
          if (!/\.xlsx?$/i.test(f.name) || f.name.startsWith("~$")) continue;
          arquivos.push({
            nome: f.name, caminho: f.webkitRelativePath,
            marca: partes.length > 2 ? partes[1] : "", referencia: partes.length > 3 ? partes[2] : "",
            ler: async () => new Uint8Array(await f.arrayBuffer()),
          });
        }
        resolve(raiz ? { nome: raiz, arquivos } : null);
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  },
  async abrirArquivo() {
    const f = await escolherArquivo(".xls,.xlsx");
    return f ? { nome: f.name, dados: new Uint8Array(await f.arrayBuffer()) } : null;
  },
  async salvarArquivo(nome, dados) {
    baixar(nome, dados as BlobPart, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return nome;
  },
  async carregarCores() {
    try {
      return localStorage.getItem(CHAVE_CORES);
    } catch {
      return null;
    }
  },
  async salvarCores(json) {
    try {
      localStorage.setItem(CHAVE_CORES, json);
    } catch {
      /* sem armazenamento: segue sem persistir */
    }
  },
  async caminhoCores() {
    return "(armazenamento do navegador)";
  },
  async exportarCores(json) {
    baixar("cores_bling.json", json, "application/json");
    return "cores_bling.json";
  },
  async importarCores() {
    const f = await escolherArquivo(".json");
    return f ? f.text() : null;
  },
  async mostrarNaPasta() {},
  async versao() {
    return "dev";
  },
};

function daPastaBruta(api: NonNullable<Window["api"]>): Plataforma["escolherPasta"] {
  return async () => {
    const r = await api.escolherPasta();
    if (!r) return null;
    return { nome: r.nome, arquivos: r.arquivos.map((a) => ({ ...a, ler: () => api.lerDaPasta(a.caminho) })) };
  };
}

export const plataforma: Plataforma = window.api
  ? { ...window.api, nome: "electron", escolherPasta: daPastaBruta(window.api) }
  : web;
