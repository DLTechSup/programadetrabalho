import { describe, expect, it } from "vitest";
import { analisar, GUID_ALTO_DESEMPENHO, liberavelPadrao, pontuacao, rotuloNota, type Problema } from "../src/lib/analise";
import { dicaArquivo, notaPasta } from "../src/lib/arquivos";
import { bytes, duracao, percentual } from "../src/lib/format";
import { idsDoSintoma, ITENS, SINTOMAS, item } from "../src/lib/catalogo";
import { montarRelatorio } from "../src/lib/relatorio";
import { veredito } from "../src/pages/Internet";
import type { Diagnostico, ItemInicializacao, ItemLimpeza } from "../src/api/types";

const GB = 1024 ** 3;
const saudavel: Diagnostico = {
  windows: "Windows 11", versao: "10", fabricante: "X", ramTotal: 16 * GB, ramLivre: 10 * GB, uptimeDias: 1, cpu: "i7", nucleos: 8, cpuUso: 10,
  pagefileAutomatico: true, notebook: false, discoTotal: 500 * GB, discoLivre: 300 * GB, tipoDisco: "SSD", saudeDisco: "Healthy",
  planoEnergia: GUID_ALTO_DESEMPENHO, antivirus: ["Windows Defender"], servicos: { SysMain: "Automatic/Running", DiagTrack: "Disabled/Stopped", WSearch: "Automatic/Running" },
  transparencia: false, explorerAbreEmEsteComputador: true, appsSegundoPlanoBloqueados: true, dns: ["1.1.1.1"],
};
const ids = (p: Problema[]) => p.map((x) => x.id);

describe("analisar", () => {
  it("computador saudável não tem problemas e nota máxima", () => {
    const p = analisar(saudavel, []);
    expect(p).toEqual([]);
    expect(pontuacao(p)).toBe(100);
  });
  it("disco quase cheio vira crítico e oferece só a limpeza segura", () => {
    const limpeza: ItemLimpeza[] = [
      { id: "temp_usuario", bytes: 5 * GB, arquivos: 1, existe: true },
      { id: "windows_old", bytes: 14 * GB, arquivos: 1, existe: true },
      { id: "hibernacao", bytes: 6 * GB, arquivos: 1, existe: true },
    ];
    const p = analisar({ ...saudavel, discoLivre: 20 * GB }, limpeza);
    const lixo = p.find((x) => x.id === "lixo")!;
    expect(lixo.severidade).toBe("critico");
    expect(lixo.ids).toEqual(["limpar:temp_usuario"]);
    expect(lixo.padrao).toBe(true);
    const old = p.find((x) => x.id === "windows_old")!;
    expect(old.padrao).toBe(false); // opcional, nunca marcado sozinho
    expect(p.find((x) => x.id === "hibernacao")!.padrao).toBe(false);
    expect(p[0].severidade).toBe("critico"); // ordenado por gravidade
  });
  it("disco cheio sem lixo vira orientação manual", () => {
    const p = analisar({ ...saudavel, discoLivre: 20 * GB }, []);
    const lixo = p.find((x) => x.id === "lixo")!;
    expect(lixo.ids).toEqual([]);
    expect(lixo.manual).toMatch(/Espaço em disco/);
  });
  it("hibernação não é sugerida em notebook", () => {
    const l: ItemLimpeza[] = [{ id: "hibernacao", bytes: 6 * GB, arquivos: 1, existe: true }];
    expect(ids(analisar({ ...saudavel, notebook: true }, l))).not.toContain("hibernacao");
  });
  it("PC fraco com HD: aponta HD, SysMain, telemetria, efeitos, RAM e memória virtual", () => {
    const fraco: Diagnostico = {
      ...saudavel, ramTotal: 4 * GB, ramLivre: 0.3 * GB, tipoDisco: "HDD", pagefileAutomatico: false, transparencia: true,
      servicos: { SysMain: "Automatic/Running", DiagTrack: "Automatic/Running", WSearch: "Automatic/Running" }, appsSegundoPlanoBloqueados: false,
      planoEnergia: "381b4222-f694-41f0-9685-ff5bb260df2e", uptimeDias: 20,
    };
    const p = analisar(fraco, []);
    expect(ids(p)).toEqual(expect.arrayContaining(["ram_alta", "ram_pouca", "pagefile", "hdd", "energia", "visuais", "telemetria", "segundo_plano", "uptime"]));
    expect(p.find((x) => x.id === "hdd")!.ids).toEqual(["sysmain_hdd"]);
    expect(p.find((x) => x.id === "visuais")!.padrao).toBe(true);
    expect(pontuacao(p)).toBeLessThan(50);
  });
  it("SysMain só é sugerido quando está rodando e o disco é HD", () => {
    expect(analisar({ ...saudavel, tipoDisco: "HDD", servicos: { ...saudavel.servicos, SysMain: "Disabled/Stopped" } }, []).find((x) => x.id === "hdd")!.ids).toEqual([]);
    expect(ids(analisar(saudavel, []))).not.toContain("hdd");
  });
  it("detecta dois antivírus, nenhum antivírus e saúde do disco", () => {
    expect(analisar({ ...saudavel, antivirus: ["A", "B"] }, []).find((x) => x.id === "antivirus")!.ids).toEqual([]);
    expect(ids(analisar({ ...saudavel, antivirus: [] }, []))).toContain("sem_antivirus");
    expect(analisar({ ...saudavel, saudeDisco: "Unhealthy" }, []).find((x) => x.id === "saude_disco")!.severidade).toBe("critico");
  });
  it("DNS: público não gera aviso; do provedor gera sugestão opcional", () => {
    expect(ids(analisar({ ...saudavel, dns: ["8.8.8.8"] }, []))).not.toContain("dns");
    const p = analisar({ ...saudavel, dns: ["192.168.0.1"] }, []).find((x) => x.id === "dns")!;
    expect(p.padrao).toBe(false);
    expect(p.ids).toContain("dns_rapido");
  });
  it("programas de inicialização sugeridos viram um problema", () => {
    const i = (nome: string, sugerido: boolean): ItemInicializacao => ({ id: nome, nome, comando: "", escopo: "", origem: "registro", ativo: true, sugerido, essencial: false, motivo: "" });
    const p = analisar(saudavel, [], [i("Teams", true), i("Spotify", true), i("Discord", true), i("X", false)]);
    expect(p.find((x) => x.id === "inicio")!.severidade).toBe("atencao");
  });
  it("todo id de correção citado existe no catálogo", () => {
    const tudo: Diagnostico = { ...saudavel, ramTotal: 4 * GB, ramLivre: 0, tipoDisco: "HDD", pagefileAutomatico: false, transparencia: true, dns: ["10.0.0.1"], cpuUso: 99, uptimeDias: 30, antivirus: [], saudeDisco: "Warning", discoLivre: GB, notebook: false, explorerAbreEmEsteComputador: false, appsSegundoPlanoBloqueados: false, planoEnergia: "x", servicos: { SysMain: "Automatic/Running", DiagTrack: "Automatic/Running", WSearch: "" } };
    const l: ItemLimpeza[] = ITENS.filter((x) => x.limpeza).map((x) => ({ id: x.id.replace("limpar:", ""), bytes: 3 * GB, arquivos: 1, existe: true }));
    for (const p of analisar(tudo, l)) for (const id of p.ids) expect(item(id), id).toBeDefined();
  });
  it("liberavelPadrao soma só as categorias padrão", () => {
    const l: ItemLimpeza[] = [
      { id: "temp_usuario", bytes: 100, arquivos: 1, existe: true },
      { id: "windows_old", bytes: 999, arquivos: 1, existe: true },
      { id: "componentes", bytes: null, arquivos: 0, existe: true },
    ];
    expect(liberavelPadrao(l)).toEqual({ ids: ["limpar:temp_usuario"], bytes: 100 });
  });
  it("rótulos da nota", () => {
    expect([95, 75, 50, 10].map(rotuloNota)).toEqual(["Ótimo", "Bom", "Precisa de atenção", "Crítico"]);
    expect(pontuacao([])).toBe(100);
  });
});

describe("catálogo na interface", () => {
  it("cada sintoma tem sugestões e nenhuma é de risco alto", () => {
    for (const s of SINTOMAS) {
      const r = idsDoSintoma(s.id);
      expect(r.length, s.id).toBeGreaterThan(0);
      for (const id of r) expect(item(id)!.risco, id).not.toBe("alto");
    }
  });
  it("'disco cheio' inclui a limpeza segura e 'sites' inclui DNS", () => {
    expect(idsDoSintoma("disco")).toEqual(expect.arrayContaining(["limpar:temp_usuario", "limpar:lixeira"]));
    expect(idsDoSintoma("sites")).toEqual(expect.arrayContaining(["dns_limpar", "dns_rapido"]));
  });
});

describe("helpers", () => {
  it("formata bytes em pt-BR", () => {
    expect(bytes(0)).toBe("0 B");
    expect(bytes(1536)).toBe("1,5 KB");
    expect(bytes(5 * GB)).toBe("5,0 GB");
    expect(bytes(null)).toBe("—");
    expect(percentual(1, 0)).toBe(0);
    expect(percentual(5, 2)).toBe(100);
    expect(duracao(187000)).toBe("3 min 7 s");
  });
  it("dicas de arquivos grandes", () => {
    expect(dicaArquivo("C:\\Users\\a\\Downloads\\win.iso", "win.iso", 0)!.tom).toBe("bom");
    expect(dicaArquivo("C:\\Windows\\MEMORY.DMP", "MEMORY.DMP", 0)!.tom).toBe("perigo");
    expect(dicaArquivo("C:\\Users\\a\\Documents\\a.pst", "a.pst", 0)!.tom).toBe("perigo");
    expect(dicaArquivo("C:\\Users\\a\\Videos\\f.mp4", "f.mp4", Date.now() - 800 * 86400000)!.texto).toMatch(/antigo/);
    expect(dicaArquivo("C:\\Users\\a\\x.abc", "x.abc", 0)).toBeNull();
  });
  it("notas de pastas conhecidas", () => {
    expect(notaPasta("C:\\Windows\\WinSxS")!.tom).toBe("perigo");
    expect(notaPasta("C:\\Windows\\assembly")!.texto).toMatch(/\.NET/);
    expect(notaPasta("C:\\Windows\\assembly\\NativeImages_v4.0.30319_64")!.tom).toBe("perigo");
    expect(notaPasta("C:\\Users\\Ana\\Downloads")!.tom).toBe("bom");
    expect(notaPasta("C:\\Program Files (x86)")!.tom).toBe("perigo");
    expect(notaPasta("C:\\Pasta\\Qualquer")).toBeNull();
  });
  it("veredito do teste de internet", () => {
    const base = { conectado: true, latenciaMs: 20, resolvedores: [{ nome: "atual", ms: 30, falhas: 0 }, { nome: "Cloudflare", ms: 25, falhas: 0 }, { nome: "Google", ms: 28, falhas: 0 }] };
    expect(veredito(base).tom).toBe("info");
    expect(veredito({ ...base, resolvedores: [{ nome: "atual", ms: 400, falhas: 0 }, base.resolvedores[1], base.resolvedores[2]] }).texto).toMatch(/Trocar o DNS/);
    expect(veredito({ ...base, resolvedores: [{ nome: "atual", ms: null, falhas: 4 }, base.resolvedores[1], base.resolvedores[2]] }).tom).toBe("erro");
    expect(veredito({ ...base, conectado: false }).tom).toBe("erro");
    expect(veredito({ ...base, latenciaMs: 300 }).texto).toMatch(/latência/);
  });
  it("relatório lista cada etapa e o total liberado", () => {
    const txt = montarRelatorio(
      [{ id: "limpar:temp_usuario", estado: "ok", mensagem: "Limpo.", liberado: 2 * GB }, { id: "sfc", estado: "erro", mensagem: "falhou" }, { id: "pagefile_auto", estado: "ok", mensagem: "", reiniciar: true }],
      saudavel, new Date("2026-01-02T10:00:00"),
    );
    expect(txt).toContain("[OK] Arquivos temporários dos usuários — Limpo. (2,0 GB liberados)");
    expect(txt).toContain("[ERRO] Verificar e reparar arquivos do Windows (SFC) — falhou");
    expect(txt).toContain("Espaço liberado no total: 2,0 GB");
    expect(txt).toContain("reiniciar");
  });
});
