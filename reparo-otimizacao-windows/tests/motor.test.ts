import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const req = createRequire(import.meta.url);
const fsutil = req("../electron/engine/fsutil.cjs");
const { escanearDisco, tipoDe } = req("../electron/engine/scanner.cjs");
const limpeza = req("../electron/engine/limpeza.cjs");
const { TAREFAS } = req("../electron/engine/tarefas.cjs");
const { validar } = req("../electron/engine/executor.cjs");
const { classificar } = req("../electron/engine/inicializacao.cjs");
const psmod = req("../electron/engine/ps.cjs");
const sistema = req("../electron/engine/sistema.cjs");
const catalogo = req("../electron/engine/catalogo.json");

let raiz: string;
const escrever = (rel: string, bytes: number) => {
  const p = path.join(raiz, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, Buffer.alloc(bytes, 1));
  return p;
};
const envFalso = () => ({ UNIDADE: raiz, WINDIR: path.join(raiz, "Windows"), USERS: path.join(raiz, "Users"), PROGRAMDATA: path.join(raiz, "ProgramData") });

beforeAll(() => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), "reparo-"));
});
afterAll(() => fs.rmSync(raiz, { recursive: true, force: true }));

describe("catálogo", () => {
  it("toda tarefa do catálogo tem implementação e vice-versa", () => {
    expect(Object.keys(TAREFAS).sort()).toEqual(catalogo.tarefas.map((t: { id: string }) => t.id).sort());
  });
  it("toda limpeza do catálogo tem categoria e vice-versa", () => {
    expect(Object.keys(limpeza.CATEGORIAS).sort()).toEqual(catalogo.limpeza.map((t: { id: string }) => t.id).sort());
  });
  it("sintomas e categorias referenciados existem", () => {
    const sint = new Set(catalogo.sintomas.map((s: { id: string }) => s.id));
    const cats = new Set(catalogo.categorias.map((s: { id: string }) => s.id));
    for (const t of catalogo.tarefas) {
      expect(cats.has(t.categoria), t.id).toBe(true);
      for (const s of t.sintomas) expect(sint.has(s), `${t.id}:${s}`).toBe(true);
    }
    for (const l of catalogo.limpeza) for (const s of l.sintomas) expect(sint.has(s), `${l.id}:${s}`).toBe(true);
  });
  it("itens de risco alto nunca vêm marcados por padrão", () => {
    for (const l of catalogo.limpeza) if (l.risco === "alto") expect(l.padrao).toBe(false);
  });
});

describe("executor.validar", () => {
  it("rejeita ids desconhecidos e caminhos arbitrários", () => {
    expect(() => validar(["rm -rf"])).toThrow();
    expect(() => validar(["limpar:../../Windows"])).toThrow();
    expect(() => validar([42])).toThrow();
  });
  it("ordena limpezas antes das tarefas e as longas por último", () => {
    expect(validar(["sfc", "dns_limpar", "limpar:temp_usuario"])).toEqual(["limpar:temp_usuario", "dns_limpar", "sfc"]);
  });
  it("remove duplicados", () => {
    expect(validar(["dns_limpar", "dns_limpar"])).toEqual(["dns_limpar"]);
  });
});

describe("fsutil", () => {
  it("expande curingas e ignora o que não existe", async () => {
    escrever("Users/ana/AppData/Local/Temp/a.tmp", 10);
    escrever("Users/beto/AppData/Local/Temp/b.tmp", 10);
    const r = await fsutil.expandir([path.join(raiz, "Users"), "*", "AppData", "Local", "Temp"]);
    expect(r.map((x: string) => path.relative(raiz, x).split(path.sep)[1]).sort()).toEqual(["ana", "beto"]);
    expect(await fsutil.expandir([raiz, "naoexiste", "*"])).toEqual([]);
  });
  it("curinga em nome de arquivo (thumbcache_*.db) não casa com outros", async () => {
    escrever("Users/ana/AppData/Local/Microsoft/Windows/Explorer/thumbcache_256.db", 5);
    escrever("Users/ana/AppData/Local/Microsoft/Windows/Explorer/iconcache_256.db", 5);
    const r = await fsutil.expandir([raiz, "Users", "*", "AppData", "Local", "Microsoft", "Windows", "Explorer", "thumbcache_*.db"]);
    expect(r.map((x: string) => path.basename(x))).toEqual(["thumbcache_256.db"]);
  });
  it("recusa apagar a raiz do disco", async () => {
    expect(fsutil.caminhoApagavel(path.parse(raiz).root)).toBe(false);
    expect(fsutil.caminhoApagavel("")).toBe(false);
    expect(fsutil.caminhoApagavel("relativo")).toBe(true); // resolve para dentro do cwd, nunca para a raiz
    const r = await fsutil.apagarArvore(path.parse(raiz).root);
    expect(r).toEqual({ liberado: 0, ignorados: 0 });
  });
  it("apaga o conteúdo e mantém a pasta; não segue links simbólicos", async () => {
    const pasta = path.join(raiz, "limpar-aqui");
    const fora = path.join(raiz, "fora");
    fs.mkdirSync(fora);
    fs.writeFileSync(path.join(fora, "importante.txt"), "nao apague");
    escrever("limpar-aqui/x/y/z.bin", 1000);
    escrever("limpar-aqui/w.bin", 500);
    fs.symlinkSync(fora, path.join(pasta, "link"));
    const r = await fsutil.apagarConteudo(pasta);
    expect(r.liberado).toBe(1500);
    expect(fs.existsSync(pasta)).toBe(true);
    expect(fs.readdirSync(pasta)).toEqual([]);
    expect(fs.readFileSync(path.join(fora, "importante.txt"), "utf8")).toBe("nao apague");
  });
});

describe("limpeza", () => {
  it("escaneia e limpa as categorias de temporários", async () => {
    const env = envFalso();
    escrever("Users/ana/AppData/Local/Temp/1.tmp", 2000);
    escrever("Windows/Temp/sub/2.tmp", 3000);
    escrever("Users/ana/AppData/Local/Google/Chrome/User Data/Default/Cache/data_0", 4000);
    escrever("Users/ana/AppData/Local/Google/Chrome/User Data/Default/Login Data", 777); // não pode ser apagado
    const antes = await limpeza.escanearLimpeza(env, { ids: ["temp_usuario", "temp_windows", "cache_navegadores"] });
    const por = Object.fromEntries(antes.map((i: { id: string; bytes: number }) => [i.id, i.bytes]));
    expect(por.temp_windows).toBe(3000);
    expect(por.cache_navegadores).toBe(4000);
    expect(por.temp_usuario).toBeGreaterThanOrEqual(2000);

    const ctx = { env, ps: async () => "", executar: async () => ({ ok: true, code: 0, stdout: "", stderr: "" }) };
    const r = await limpeza.limparCategoria("cache_navegadores", ctx);
    expect(r.liberado).toBe(4000);
    expect(fs.existsSync(path.join(raiz, "Users/ana/AppData/Local/Google/Chrome/User Data/Default/Login Data"))).toBe(true);
    expect((await limpeza.limparCategoria("temp_windows", ctx)).liberado).toBe(3000);
    expect(fs.existsSync(path.join(raiz, "Windows/Temp"))).toBe(true);
  });
  it("categoria desconhecida lança erro", async () => {
    await expect(limpeza.limparCategoria("xyz", { env: envFalso() })).rejects.toThrow();
  });
  it("categoria que roda comando (componentes) não mede e chama o programa certo", async () => {
    const chamadas: string[][] = [];
    const ctx = { env: envFalso(), ps: async () => "", executar: async (a: string, args: string[]) => (chamadas.push([a, ...args]), { ok: true, code: 0, stdout: "", stderr: "" }) };
    const r = await limpeza.limparCategoria("componentes", ctx);
    expect(r.liberado).toBeNull();
    expect(chamadas[0]).toEqual(["Dism.exe", "/Online", "/Cleanup-Image", "/StartComponentCleanup"]);
  });
});

describe("scanner de disco", () => {
  it("soma tamanhos, acha os maiores arquivos e classifica por tipo", async () => {
    const base = fs.mkdtempSync(path.join(raiz, "scan-"));
    const w = (rel: string, n: number) => {
      const p = path.join(base, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, Buffer.alloc(n));
    };
    w("Users/ana/Videos/ferias.mp4", 3000);
    w("Users/ana/Downloads/setup.exe", 1000);
    w("Windows/System32/a.dll", 500);
    w("Windows/Temp/x.tmp", 250);
    const out = await escanearDisco(base, { tamanhoMinArquivo: 900 });
    expect(out.totalBytes).toBe(4750);
    expect(out.arquivos).toBe(4);
    expect(out.maiores.map((m: { nome: string }) => m.nome)).toEqual(["ferias.mp4", "setup.exe"]);
    expect(out.porTipo.videos.bytes).toBe(3000);
    expect(out.porTipo.programas.bytes).toBe(1500);
    const users = out.arvore.filhos.find((f: { nome: string }) => f.nome === "Users");
    expect(users.bytes).toBe(4000);
    expect(out.arvore.filhos[0].bytes).toBeGreaterThanOrEqual(out.arvore.filhos[1].bytes); // ordenado
  });
  it("ignora links simbólicos (sem loop nem contagem dupla)", async () => {
    const base = fs.mkdtempSync(path.join(raiz, "scan-"));
    fs.mkdirSync(path.join(base, "a"));
    fs.writeFileSync(path.join(base, "a", "f.bin"), Buffer.alloc(100));
    fs.symlinkSync(base, path.join(base, "a", "loop"));
    fs.symlinkSync(path.join(base, "a"), path.join(base, "copia"));
    const out = await escanearDisco(base);
    expect(out.totalBytes).toBe(100);
  });
  it("respeita o cancelamento e a poda de profundidade", async () => {
    const base = fs.mkdtempSync(path.join(raiz, "scan-"));
    fs.mkdirSync(path.join(base, "a/b/c/d/e"), { recursive: true });
    fs.writeFileSync(path.join(base, "a/b/c/d/e/f.bin"), Buffer.alloc(10));
    const raso = await escanearDisco(base, { profundidadeArvore: 2 });
    expect(raso.totalBytes).toBe(10);
    expect(raso.arvore.filhos[0].filhos[0].filhos).toEqual([]); // nível 2 não guarda filhos
    const cancelado = await escanearDisco(base, { cancelado: () => true });
    expect(cancelado.cancelado).toBe(true);
    expect(cancelado.totalBytes).toBe(0);
  });
  it("classifica extensões", () => {
    expect(tipoDe("Filme.MKV")).toBe("videos");
    expect(tipoDe("semextensao")).toBe("outros");
    expect(tipoDe("win.iso")).toBe("imagensDisco");
  });
  it("conta pastas sem permissão como erro, sem quebrar", async () => {
    const fsFalso = {
      promises: {
        readdir: async (d: string) => { if (d.endsWith("negado")) throw new Error("EPERM"); return [{ name: "negado", isSymbolicLink: () => false, isDirectory: () => true }]; },
        lstat: async () => { throw new Error("x"); },
      },
    };
    const out = await escanearDisco("/raiz", { fs: fsFalso });
    expect(out.erros).toBe(1);
  });
});

describe("inicialização", () => {
  it("sugere desligar apps ocasionais", () => {
    for (const n of ["Microsoft Teams", "Spotify", "Discord", "Steam", "AdobeAAMUpdater-1.0", "EpicGamesLauncher", "Skype"]) expect(classificar(n, "").sugerido, n).toBe(true);
  });
  it("nunca sugere segurança, drivers e fabricantes", () => {
    for (const n of ["SecurityHealth", "Windows Defender", "RtkAudUService", "NVIDIA Backend", "Avast Antivirus", "IgfxTray", "Synaptics Pointing Device", "ctfmon", "Dell SupportAssist"]) {
      const c = classificar(n, "");
      expect(c.sugerido, n).toBe(false);
      expect(c.essencial, n).toBe(true);
    }
  });
  it("não confunde palavras que só contêm 'ime' ou 'hp'", () => {
    expect(classificar("Runtime Helper", "").essencial).toBe(false);
  });
  it("OneDrive/Dropbox só são lembrados, nunca sugeridos", () => {
    expect(classificar("OneDrive", "").sugerido).toBe(false);
    expect(classificar("Dropbox", "").sugerido).toBe(false);
  });
});

describe("ps (execução segura)", () => {
  it("decodifica UTF-16 (sfc/chkdsk) e UTF-8", () => {
    expect(psmod.decodificar(Buffer.from("Verificação concluída\r\n", "utf16le"))).toBe("Verificação concluída\n");
    expect(psmod.decodificar(Buffer.from("olá", "utf8"))).toBe("olá");
  });
  it("embute dados com aspas e acentos sem quebrar o script", () => {
    const s = psmod.dadosPS("x", [{ nome: "O'Brien \"x\" ç" }]);
    const b64 = /FromBase64String\('([^']+)'\)/.exec(s)![1];
    expect(JSON.parse(Buffer.from(b64, "base64").toString("utf8"))[0].nome).toBe("O'Brien \"x\" ç");
  });
  it("limpa o ruído do erro CLIXML do PowerShell", () => {
    const e = '#< CLIXML <Objs><S S="Error">Falhou aqui_x000D__x000A_</S></Objs>';
    expect(psmod.limparErroPS(e)).toBe("Falhou aqui");
  });
  it("arr normaliza item único do ConvertTo-Json", () => {
    expect(psmod.arr(5)).toEqual([5]);
    expect(psmod.arr(null)).toEqual([]);
    expect(psmod.arr([1, 2])).toEqual([1, 2]);
  });
  it("fora do Windows devolve erro claro em vez de executar", async () => {
    if (process.platform === "win32") return;
    await expect(psmod.ps("1+1")).rejects.toThrow(/Windows/);
  });
});

describe("memória", () => {
  it("recusa encerrar processos do sistema", async () => {
    for (const n of ["svchost", "LSASS", "csrss", "explorer", "MsMpEng"]) await expect(sistema.encerrar(n, [1234])).rejects.toThrow(/sistema/);
  });
  it("recusa PIDs inválidos", async () => {
    await expect(sistema.encerrar("chrome", [0, 4, -1, "x"])).rejects.toThrow(/inválido/);
  });
});
