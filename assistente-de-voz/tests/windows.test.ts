import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const req = createRequire(import.meta.url);
const jan = req("../electron/engine/janelas.cjs");
const prog = req("../electron/engine/programas.cjs");
const ps = req("../electron/engine/ps.cjs");
const { criarConfig, validar } = req("../electron/engine/config.cjs");

describe("SendKeys", () => {
  it("escapa caracteres especiais ao digitar texto", () => {
    expect(jan.escaparSendKeys("a+b")).toBe("a{+}b");
    expect(jan.escaparSendKeys("(x)")).toBe("{(}x{)}");
    expect(jan.escaparSendKeys("100%")).toBe("100{%}");
    expect(jan.escaparSendKeys("^~{}[]")).toBe("{^}{~}{{}{}}{[}{]}");
    expect(jan.escaparSendKeys("youtube")).toBe("youtube");
  });
});

describe("programas: janelas abertas", () => {
  const janelas = [
    { hwnd: 1, pid: 10, titulo: "YouTube - Google Chrome", proc: "chrome", foco: true },
    { hwnd: 2, pid: 11, titulo: "Documento1 - Word", proc: "WINWORD", foco: false },
    { hwnd: 3, pid: 12, titulo: "WhatsApp", proc: "WhatsApp", foco: false },
    { hwnd: 4, pid: 13, titulo: "Calculadora", proc: "ApplicationFrameHost", foco: false },
    { hwnd: 5, pid: 14, titulo: "Pasta1 - Excel", proc: "EXCEL", foco: false },
  ];
  it("acha por processo, por título e por apelido", () => {
    const h = (f: string) => prog.acharJanelas(janelas, f).map((x: any) => x.janela.hwnd);
    expect(h("chrome")).toEqual([1]);
    expect(h("word")).toEqual([2]);
    expect(h("zap")).toEqual([3]); // "zap" é apelido do WhatsApp
    expect(h("whatsapp")).toEqual([3]);
    expect(h("calculadora")).toEqual([4]);
    expect(h("excel")).toEqual([5]);
    expect(h("youtube")).toEqual([1]);
  });
  it("URLs de sites", () => {
    expect(prog.urlDoSite("globo ponto com")).toBe("https://globo.com");
    expect(prog.urlDoSite("uol com br")).toBe("https://uol.com.br");
    expect(prog.urlDoSite("whatsapp web")).toBe("https://web.whatsapp.com");
    expect(prog.urlDoSite("bom dia")).toBeNull();
  });
});

describe("configuração", () => {
  it("valores padrão, limites e arquivo corrompido", () => {
    const c = validar({ sensibilidade: 99, modelo: "gigante", nomeAtivacao: "   ", aliases: [{ falas: [], tipo: "x" }, { falas: ["a"], tipo: "url", destino: "http://x" }] });
    expect(c.sensibilidade).toBe(10);
    expect(c.modelo).toBe("base");
    expect(c.nomeAtivacao).toBe("Jarvis");
    expect(c.aliases.length).toBe(1);
    const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cfg-")), "c.json");
    fs.writeFileSync(arq, "{ não é json");
    expect(criarConfig(arq).get().nomeAtivacao).toBe("Jarvis");
  });
  it("arquivo de versão antiga: respostas faladas passam a vir desligadas, mas escolha nova é respeitada", () => {
    const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cfg-")), "c.json");
    fs.writeFileSync(arq, JSON.stringify({ nomeAtivacao: "Zeca", falarRespostas: true }));
    const a = criarConfig(arq);
    expect(a.get().nomeAtivacao).toBe("Zeca");
    expect(a.get().falarRespostas).toBe(false);
    a.set({ falarRespostas: true });
    expect(criarConfig(arq).get().falarRespostas).toBe(true);
  });
  it("limites do tempo de silêncio e modo inválido", () => {
    expect(validar({ silencioMs: 10 }).silencioMs).toBe(250);
    expect(validar({ silencioMs: 99999 }).silencioMs).toBe(1500);
    expect(validar({ modoEscuta: "xyz" }).modoEscuta).toBe("nome");
  });
  it("salva e relê", () => {
    const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cfg-")), "sub", "c.json");
    const a = criarConfig(arq);
    a.set({ nomeAtivacao: "Assistente", pastaRaiz: "D:\\x" });
    const b = criarConfig(arq);
    expect(b.get().nomeAtivacao).toBe("Assistente");
    expect(b.get().pastaRaiz).toBe("D:\\x");
  });
});

describe("ps", () => {
  it("embute dados com aspas e acentos", () => {
    const s = ps.dadosPS("x", [{ nome: "O'Brien ç" }]);
    expect(s).toContain("FromBase64String");
  });
  it("fora do Windows devolve erro claro", async () => {
    if (process.platform === "win32") return;
    await expect(ps.ps("1")).rejects.toThrow(/Windows/);
  });
});

// Se houver o PowerShell moderno (pwsh) na máquina, confere a sintaxe de TODOS os scripts.
function achaPowerShell(): string | null {
  // só o PowerShell moderno (pwsh): em PCs com apenas o Windows PowerShell o teste é pulado, para não travar a geração do .exe
  for (const exe of ["/opt/pwsh/pwsh", "pwsh"]) {
    try {
      execFileSync(exe, ["-NoProfile", "-Command", "1"], { stdio: "ignore", timeout: 20000 });
      return exe;
    } catch {
      /* próximo */
    }
  }
  return null;
}
const PS = achaPowerShell();

describe.skipIf(!PS)("sintaxe dos scripts PowerShell", () => {
  it("todos os scripts gerados são válidos", async () => {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "ps1-"));
    const scripts: Record<string, string> = {};
    const gravador = async (s: string) => {
      scripts[`s${Object.keys(scripts).length}`] = s;
      return "{}";
    };
    // captura os scripts que as funções gerariam, trocando o executor
    const orig = { ps: ps.ps, psJson: ps.psJson };
    ps.ps = gravador;
    ps.psJson = async (s: string) => (await gravador(s), []);
    delete req.cache[req.resolve("../electron/engine/janelas.cjs")];
    delete req.cache[req.resolve("../electron/engine/programas.cjs")];
    const J = req("../electron/engine/janelas.cjs");
    const Pg = req("../electron/engine/programas.cjs");
    try {
      await J.listar(1); await J.focar(5); await J.mostrar(5, "maximizar"); await J.fechar([1, 2]); await J.matar([100]);
      await J.teclas("^{TAB}", { hwnd: 3, digitar: "a'b", depois: "{ENTER}" }); await J.teclas("%{TAB}");
      await J.midia("proxima"); await J.areaDeTrabalho();
      for (const op of ["mais", "menos", "definir", "mudo", "som", "ler"]) await J.volume(op, 30);
      await J.fecharPastas("D:\\Pasta d'aspas"); await J.fecharPastas(null);
      await Pg.listarInstalados();
    } finally {
      Object.assign(ps, orig);
    }
    scripts.programas = Pg.SCRIPT_LISTAR;
    Object.entries(scripts).forEach(([k, v]) => fs.writeFileSync(path.join(pasta, `${k}.ps1`), v));
    const verificador = `$bad=0; foreach($f in Get-ChildItem '${pasta}' -Filter *.ps1){ $t=$null;$e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile($f.FullName,[ref]$t,[ref]$e); if($e.Count -gt 0){ $bad++; "$($f.Name): $($e[0].Message) (linha $($e[0].Extent.StartLineNumber))" } }; "RESULTADO:$bad"`;
    const saida = execFileSync(PS!, ["-NoProfile", "-Command", verificador], { encoding: "utf8", timeout: 60000 });
    expect(Object.keys(scripts).length).toBeGreaterThan(15);
    expect(saida).toContain("RESULTADO:0");
  });
});
