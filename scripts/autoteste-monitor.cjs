// Autoteste do Monitor de Demandas: abre uma página que imita o WhatsApp Web (sem WhatsApp de
// verdade) e confere, de ponta a ponta, que o leitor (electron/monitor/leitor.cjs) e o motor de
// regras (electron/monitor/motor.cjs) leem e salvam as demandas certinho. Rodado no CI (Windows)
// a cada build, igual ao "--selftest" dos outros programas desta família.
//   npm run autoteste:monitor
const { app } = require("electron");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const { Navegador } = require("../electron/monitor/leitor.cjs");
const fixture = require("../electron/monitor/fixture.cjs");
const { Processador } = require("../electron/monitor/motor.cjs");
const { RegrasReferencia } = require("../electron/monitor/logica-pura.cjs");

let falhas = 0;
function assert(cond, msg) {
  if (!cond) { falhas++; console.error("FALHOU:", msg); } else { console.log("ok:", msg); }
}

app.whenReady().then(async () => {
  let nav;
  try {
    const url = fixture.criar(fs.mkdtempSync(path.join(os.tmpdir(), "monitor-fixture-")));

    // ---- leitor: conversas, mensagens, fotos, álbum escondido ----
    nav = new Navegador({ partition: "persist:autoteste-" + Date.now(), url, show: false });
    await nav.iniciar();
    assert(await nav.logado(), "logado() detecta a tela do WhatsApp");
    const conversas = await nav.conversas();
    assert(conversas.includes("Demandas Fotos"), "lista de conversas inclui 'Demandas Fotos'");
    assert(await nav.abrirConversa("Demandas Fotos"), "abre 'Demandas Fotos' pelo nome exato");
    const { titulo, msgsBrutas } = await nav.ler();
    assert(titulo === "Demandas Fotos", "lê o título da conversa aberta");
    assert(msgsBrutas.length === 4, "lê as 4 mensagens da conversa");
    assert(msgsBrutas[0].legenda === "BEIRA RIO 8513.115", "lê a legenda certa");
    assert(await nav.abrirConversa("programacao"), "acha grupo com emoji/acento pelo nome simples");
    assert((await nav.tituloAberto()) === "PROGRAMAÇÃO ✨📷💰", "título real tem o emoji de volta");
    await nav.abrirConversa("Demandas Fotos");
    const { msgsBrutas: msgs2 } = await nav.ler();
    const fotos = await nav.baixar(msgs2[0].blobs);
    assert(fotos.length === 3 && fotos[0].slice(0, 3).toString("hex") === "ffd8ff", "baixa fotos de verdade (JPEG)");
    const album = await nav.baixarAlbumCompleto(msgs2[1], msgs2[1].blobs.length + msgs2[1].mais - 1);
    assert(album.length >= msgs2[1].blobs.length, "baixa fotos escondidas do álbum (+N)");

    // ---- motor: ciclo completo salva pastas e lista, sem duplicar (reaproveita a mesma janela) ----
    const saida = fs.mkdtempSync(path.join(os.tmpdir(), "monitor-saida-"));
    const cfg = { pastaBase: saida, pegarAntigas: true, todasDoGrupoB: true, tentarEscondidas: true, esperaLegendaSeg: 120, grupos: [{ nome: "Demandas Fotos", tipo: "A" }] };
    const eventos = [];
    const p = new Processador(cfg, nav, { evento: (t, d) => eventos.push([t, d]), regrasRef: new RegrasReferencia() });
    await p.ciclo();
    const salvos = eventos.filter(([t]) => t === "salvo").map(([, d]) => d);
    assert(salvos.length === 2, "ciclo() gera 2 demandas (BEIRA RIO e DAKOTA)");
    assert(salvos.some((d) => d.referencia === "8513.115" && d.novas === 3), "BEIRA RIO 8513.115 com 3 fotos");
    assert(salvos.some((d) => d.referencia === "rosa Choque" && d.novas === 6), "DAKOTA rosa Choque com 6 fotos (álbum completo)");
    const diaStr = (() => { const d = new Date(); const z = (n) => String(n).padStart(2, "0"); return `${z(d.getDate())}-${z(d.getMonth() + 1)}-${d.getFullYear()}`; })();
    const diaDir = path.join(saida, "Demandas Fotos", diaStr);
    assert(!fs.existsSync(path.join(diaDir, "VIZZANO 1111.100")), "mensagem antiga (2020) não é salva");
    assert(!fs.existsSync(path.join(diaDir, "MODARE 7000.100")), "mensagem própria (minha=true) não é salva");
    await p.ciclo();
    const salvos2 = eventos.filter(([t]) => t === "salvo").map(([, d]) => d);
    assert(salvos2.length === 2, "segunda volta do ciclo não duplica nada");
    nav.fechar();

    if (falhas > 0) { console.error(`\n${falhas} verificação(ões) falharam.`); process.exit(1); }
    console.log("\nAUTOTESTE DO MONITOR DE DEMANDAS: TUDO CERTO");
    process.exit(0);
  } catch (e) {
    console.error("\nERRO no autoteste do monitor:", e);
    if (nav) nav.fechar();
    process.exit(1);
  }
});
