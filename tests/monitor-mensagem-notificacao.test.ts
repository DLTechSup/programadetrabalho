import { describe, expect, it } from "vitest";
import { completarDatas, interpretarPre, type Mensagem } from "../src/apps/monitor/mensagem";
import { textoDoAviso } from "../src/apps/monitor/notificacao";

describe("interpretarPre", () => {
  it("extrai remetente, dia e hora", () => {
    const r = interpretarPre("[18:42, 06/11/2026] Camilo: ");
    expect(r.remetente).toBe("Camilo");
    expect(r.hora).toBe("18:42");
    expect(r.dia?.getFullYear()).toBe(2026);
    expect(r.dia?.getMonth()).toBe(10); // novembro = índice 10
    expect(r.dia?.getDate()).toBe(6);
  });

  it("texto vazio ou sem o formato esperado não quebra", () => {
    expect(interpretarPre("")).toEqual({ remetente: "", dia: null, hora: "" });
    expect(interpretarPre("qualquer coisa")).toEqual({ remetente: "", dia: null, hora: "" });
  });
});

describe("completarDatas", () => {
  it("mensagem sem data herda da vizinha", () => {
    const msgs: Mensagem[] = [
      { id: "1", minha: false, legenda: "a", blobs: [], carregando: 0, mais: 0, remetente: "Ana", dia: new Date(2026, 10, 13), hora: "09:00" },
      { id: "2", minha: false, legenda: "b", blobs: [], carregando: 0, mais: 0, remetente: "", dia: null, hora: "" },
      { id: "3", minha: false, legenda: "c", blobs: [], carregando: 0, mais: 0, remetente: "Bia", dia: new Date(2026, 10, 14), hora: "10:00" },
    ];
    completarDatas(msgs);
    expect(msgs[1].remetente).toBe("Ana");
    expect(msgs[1].dia).toEqual(new Date(2026, 10, 13));
  });

  it("sem nenhuma vizinha com data: fica sem data mesmo", () => {
    const msgs: Mensagem[] = [{ id: "1", minha: false, legenda: "a", blobs: [], carregando: 0, mais: 0, remetente: "", dia: null, hora: "" }];
    completarDatas(msgs);
    expect(msgs[0].dia).toBeNull();
  });
});

describe("textoDoAviso", () => {
  it("evento de grupo A/B", () => {
    const d = { grupo: "PROGRAMAÇÃO", marca: "BEIRA RIO", referencia: "123.456", novas: 3, total: 3, nova: true, situacao: "ok" as const, obs: "" };
    expect(textoDoAviso(d)).toEqual(["✔ PROGRAMAÇÃO", "BEIRA RIO 123.456", "3 foto(s) salva(s)"]);
    expect(textoDoAviso({ ...d, nova: false, total: 5, novas: 2 })[0]).toMatch(/^＋ PROGRAMAÇÃO/);
    const [t, l1, l2] = textoDoAviso({ ...d, marca: "?", referencia: "não lida", situacao: "conferir", obs: "não consegui ler" });
    expect(t.startsWith("⚠")).toBe(true);
    expect(l1).toBe("não lida");
    expect(l2).toContain("não consegui ler");
  });

  it("evento de conversa individual", () => {
    const d = { tipo: "I" as const, grupo: "PROGRAMAÇÃO", mensagens: 2, fotos: 1, previa: "oi" };
    expect(textoDoAviso(d)).toEqual(["💬 PROGRAMAÇÃO", "oi", "2 mensagem(ns) salva(s) em texto · 1 foto(s)"]);
  });
});
