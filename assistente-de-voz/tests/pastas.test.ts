import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const req = createRequire(import.meta.url);
const P = req("../electron/engine/pastas.cjs");

let raiz: string;
let idx: any;
const mk = (rel: string, arquivo = false) => {
  const p = path.join(raiz, rel);
  if (arquivo) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, "x");
  } else fs.mkdirSync(p, { recursive: true });
};

beforeAll(async () => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), "lanc-"));
  // estrutura vista nas telas do cliente
  for (const m of ["ACTVITTA", "Adrun", "BEBECE", "BEIRA RIO", "CONVERSE", "MOLEKINHA", "MOLEKINHO", "Marca Actvitta", "FOTOS variadas", "Nova pasta"]) mk(m);
  for (const r of ["8246.1212", "8367.871", "8367.872", "8367.875", "8367.878", "8506.209", "8519.101", "8519.110", "BEIRA", "BEIRA RIO", "BEIRA RIO 8407.137"]) mk(`BEIRA RIO/${r}`);
  mk("BEIRA RIO/8506.209/frente.jpg", true);
  mk("BEIRA RIO/8506.209/costas.jpg", true);
  mk("BEIRA RIO/8506.209/ficha tecnica.pdf", true);
  mk("BEIRA RIO/8506.209/fotos/detalhe 1.png", true);
  mk("BEBECE/4182.224");
  mk("BEBECE/8506.209"); // mesma referência em outra marca
  mk("MOLEKINHA/2083.1122");
  mk("MOLEKINHO/2433.100");
  idx = await P.indexar(raiz);
});
afterAll(() => fs.rmSync(raiz, { recursive: true, force: true }));

describe("indexar", () => {
  it("lê marcas e referências e ignora 'Nova pasta'", () => {
    expect(idx.marcas.map((m: any) => m.nome)).not.toContain("Nova pasta");
    expect(idx.marcas.find((m: any) => m.nome === "BEIRA RIO").refs.length).toBe(11);
    expect(idx.totalRefs).toBeGreaterThan(14);
  });
  it("raiz inexistente não quebra", async () => {
    const r = await P.indexar(path.join(raiz, "nao-existe"));
    expect(r.marcas).toEqual([]);
    expect(r.erro).toMatch(/raiz/);
  });
  it("respeita a lista de ignoradas", async () => {
    const r = await P.indexar(raiz, { ignorar: ["FOTOS variadas", "nova pasta"] });
    expect(r.marcas.map((m: any) => m.nome)).not.toContain("FOTOS variadas");
  });
});

describe("marcas", () => {
  const nomes = (f: string) => P.acharMarcas(idx, f).map((r: any) => r.item.nome);
  it("acha por nome falado, sem acento/maiúscula", () => {
    expect(nomes("beira rio")[0]).toBe("BEIRA RIO");
    expect(nomes("bebece")[0]).toBe("BEBECE");
  });
  it("tolera grafia do reconhecedor", () => {
    expect(nomes("molequinha")[0]).toBe("MOLEKINHA");
    expect(nomes("adrum")[0]).toBe("Adrun");
  });
  it("nome exato vence 'Marca X' parecida", () => {
    const r = P.acharMarcas(idx, "actvitta");
    expect(r[0].item.nome).toBe("ACTVITTA");
    expect(P.vencedorClaro(r)).toBe(true);
  });
  it("nome inexistente não devolve nada", () => {
    expect(nomes("zzzzzz")).toEqual([]);
  });
});

describe("referências", () => {
  const beira = () => idx.marcas.find((m: any) => m.nome === "BEIRA RIO");
  it("código completo falado por extenso ou em dígitos", () => {
    for (const f of ["8506.209", "8506 209", "8.506.209", "oito cinco zero seis ponto dois zero nove", "8506, 209"]) {
      const r = P.acharRefs(idx, f, beira());
      expect(r[0].item.nome, f).toBe("8506.209");
      expect(P.vencedorRef(r)).toBe(true);
    }
  });
  it("código parcial acha todas as parecidas (ambíguo)", () => {
    const r = P.acharRefs(idx, "8367", beira());
    expect(r.map((x: any) => x.item.nome).sort()).toEqual(["8367.871", "8367.872", "8367.875", "8367.878"]);
    expect(P.vencedorRef(r)).toBe(false);
  });
  it("final do código ('872') resolve", () => {
    const r = P.acharRefs(idx, "8367 872", beira());
    expect(r[0].item.nome).toBe("8367.872");
    expect(P.vencedorRef(r)).toBe(true);
  });
  it("acha a pasta que tem o código no nome", () => {
    const r = P.acharRefs(idx, "8407 137", beira());
    expect(r[0].item.nome).toBe("BEIRA RIO 8407.137");
  });
  it("sem marca procura em todas (mesma referência em 2 marcas)", () => {
    const r = P.acharRefs(idx, "8506.209");
    expect(r.map((x: any) => x.item.marca).sort()).toEqual(["BEBECE", "BEIRA RIO"]);
    expect(P.vencedorRef(r)).toBe(false);
  });
  it("por nome quando não há dígitos", () => {
    const r = P.acharRefs(idx, "beira rio", beira());
    expect(r[0].item.nome).toBe("BEIRA RIO");
  });
  it("código inexistente", () => {
    expect(P.acharRefs(idx, "9999 999", beira())).toEqual([]);
  });
});

describe("arquivos", () => {
  const ref = () => path.join(raiz, "BEIRA RIO", "8506.209");
  it("lista arquivos e pastas", async () => {
    const c = await P.listarConteudo(ref());
    expect(c.arquivos).toEqual(["costas.jpg", "ficha tecnica.pdf", "frente.jpg"]);
    expect(c.pastas).toEqual(["fotos"]);
  });
  it("busca por nome em subpastas", async () => {
    const r = await P.buscarEm(ref(), "detalhe");
    expect(r[0].nome).toBe("detalhe 1.png");
    expect((await P.buscarEm(ref(), "ficha"))[0].nome).toBe("ficha tecnica.pdf");
  });
  it("pasta inexistente devolve vazio", async () => {
    expect(await P.listarConteudo(path.join(raiz, "x"))).toEqual({ arquivos: [], pastas: [] });
  });
});
