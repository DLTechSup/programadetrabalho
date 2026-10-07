import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import logo from "./assets/logo.svg";
import seed from "./core/cores_bling_seed.json";
import {
  agruparVariacoes, bancoVazio, criarLinhaPai, detectarLinhaPai, gerarCodigoEDescricao, limpo,
  mesclarBanco, normalizarBanco, normalizarCodigos, processarVariacoes, removerLinhas, serializarBanco,
  type Analise, type BancoCores, type DadosNovoPai, type Grupo, type Planilha,
} from "./core/nucleo";
import { gerarXlsx, lerPlanilha } from "./core/planilha";
import { plataforma, type ArquivoAberto } from "./platform";
import { BancoCoresView } from "./components/BancoCoresView";
import { IconeCheck, IconeLua, IconePaleta, IconeRadar, IconePlanilha, IconeSol, IconeUpload } from "./components/Icons";
import { Modal } from "./components/Modal";
import { NovoPaiDialog } from "./components/NovoPaiDialog";
import { ScannerView } from "./components/ScannerView";
import { aplicarAoBanco, type ParAgregado } from "./core/scanner";
import { Resultado, type ResumoGeracao } from "./components/Resultado";
import { TelaCores } from "./components/TelaCores";

type Vista = "planilha" | "banco" | "scanner";
type Fase = "inicio" | "cores" | "pronto";
type TipoLog = "info" | "ok" | "aviso" | "erro";
interface EntradaLog { id: number; tipo: TipoLog; texto: string }
interface Toast { id: number; texto: string; erro?: boolean }

interface Sessao {
  id: number; // muda a cada arquivo aberto: garante que nenhuma tela reaproveite dados do anterior
  nomeArquivo: string;
  planilha: Planilha;
  paiIdx: number;
  codigoPai: string;
  marca: string;
  categoria: string;
  analisadas: Map<number, Analise>;
  grupos: Map<string, Grupo>;
}

function carregarTema(): "light" | "dark" {
  try {
    const salvo = localStorage.getItem("bling.tema");
    if (salvo === "light" || salvo === "dark") return salvo;
  } catch { /* sem armazenamento */ }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [vista, setVista] = useState<Vista>("planilha");
  const [fase, setFase] = useState<Fase>("inicio");
  const [tema, setTema] = useState<"light" | "dark">(carregarTema);
  const [banco, setBanco] = useState<BancoCores>(bancoVazio);
  const [caminhoBanco, setCaminhoBanco] = useState("");
  const [versao, setVersao] = useState("");
  const [log, setLog] = useState<EntradaLog[]>([]);
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [resumo, setResumo] = useState<ResumoGeracao | null>(null);
  const [caminhoSalvo, setCaminhoSalvo] = useState<string | null>(null);
  const [pendentePai, setPendentePai] = useState<{ nomeArquivo: string; planilha: Planilha } | null>(null);
  const [erroModal, setErroModal] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [arrastando, setArrastando] = useState(false);
  // abreviações digitadas neste arquivo: só entram no banco quando a planilha é SALVA
  const [aprendido, setAprendido] = useState<BancoCores | null>(null);
  const [confirmarNovo, setConfirmarNovo] = useState(false);
  const contador = useRef(0);
  const sequenciaSessao = useRef(0);

  // ---------- tema ----------
  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    try { localStorage.setItem("bling.tema", tema); } catch { /* ok */ }
  }, [tema]);

  // ---------- banco de cores ----------
  useEffect(() => {
    (async () => {
      const texto = await plataforma.carregarCores();
      let b: BancoCores | null = null;
      if (texto) {
        try { b = normalizarBanco(JSON.parse(texto)); } catch { b = null; }
      }
      // primeira execução (ou arquivo vazio): nasce com o histórico embutido
      if (!b || (!Object.keys(b.por_marca).length && !Object.keys(b.generico).length)) {
        b = normalizarBanco(seed);
        await plataforma.salvarCores(serializarBanco(b));
      }
      setBanco(b);
      setCaminhoBanco(await plataforma.caminhoCores());
      setVersao(await plataforma.versao());
    })();
  }, []);

  const persistirBanco = useCallback(async (b: BancoCores) => {
    setBanco(b);
    await plataforma.salvarCores(serializarBanco(b));
  }, []);

  // ---------- utilidades ----------
  const registrar = useCallback((texto: string, tipo: TipoLog = "info") => {
    setLog((l) => [...l, { id: ++contador.current, tipo, texto }]);
  }, []);

  const avisar = useCallback((texto: string, erro = false) => {
    const id = ++contador.current;
    setToasts((t) => [...t, { id, texto, erro }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  /** Esquece TUDO do documento anterior: planilha, cores digitadas, abreviações não salvas, registro e avisos. */
  function limparTudo() {
    setFase("inicio");
    setSessao(null);
    setResumo(null);
    setCaminhoSalvo(null);
    setPendentePai(null);
    setAprendido(null);
    setErroModal(null);
    setConfirmarNovo(false);
    setArrastando(false);
    setToasts([]);
    setLog([]);
  }

  /** Botão "Novo documento": pede confirmação só se houver trabalho que ainda não foi salvo. */
  function novoDocumento() {
    const trabalhoNaoSalvo = fase === "cores" || (fase === "pronto" && !!resumo && !caminhoSalvo);
    if (trabalhoNaoSalvo) setConfirmarNovo(true);
    else limparTudo();
  }

  // ---------- fluxo principal ----------
  async function escolherArquivo() {
    const arquivo = await plataforma.abrirArquivo();
    if (arquivo) abrir(arquivo);
  }

  function abrir(arquivo: ArquivoAberto) {
    limparTudo();
    setVista("planilha");
    registrar(`Lendo arquivo: ${arquivo.nome}`);
    let planilha: Planilha;
    try {
      planilha = lerPlanilha(arquivo.dados);
      if (!planilha.colunas.includes("Descrição")) {
        throw new Error("Não encontrei a coluna 'Descrição'. Este arquivo parece não ser uma exportação de produtos do Bling.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      registrar(`ERRO: ${msg}`, "erro");
      setErroModal(msg);
      return;
    }
    normalizarCodigos(planilha);
    registrar(`${planilha.linhas.length} linha(s) encontrada(s).`);

    const idx = detectarLinhaPai(planilha);
    if (idx !== null) {
      const codigoPai = limpo(planilha.linhas[idx]["Código"]);
      registrar(`PAI encontrado na linha ${idx + 2}: código = ${codigoPai || "(ainda sem código)"}`, "ok");
      if (planilha.linhas.filter((l) => limpo(l["Código"])).length > 1) {
        registrar(
          "Atenção: este arquivo já tem Códigos preenchidos em várias linhas (parece já processado/importado). " +
          "Os códigos das variações serão refeitos a partir do PAI acima — confira se a linha do PAI está certa.",
          "aviso",
        );
      }
      processar(arquivo.nome, planilha, idx, limpo(planilha.linhas[idx]["Categoria do produto"]));
    } else {
      registrar("Nenhum PAI já cadastrado foi encontrado neste arquivo.", "aviso");
      setPendentePai({ nomeArquivo: arquivo.nome, planilha });
    }
  }

  function aoCriarPai(dados: DadosNovoPai) {
    if (!pendentePai) return;
    const { nomeArquivo, planilha } = pendentePai;
    setPendentePai(null);
    const idx = criarLinhaPai(planilha, dados);
    registrar("PAI criado numa nova linha.", "ok");
    processar(nomeArquivo, planilha, idx, dados.categoria);
  }

  function processar(nomeArquivo: string, planilha: Planilha, paiIdx: number, categoria: string) {
    try {
      processarVariacoes(planilha, paiIdx, categoria, (m) => registrar(m, "ok"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      registrar(`ERRO: ${msg}`, "erro");
      setErroModal(msg);
      return;
    }
    const codigoPai = limpo(planilha.linhas[paiIdx]["Código"]);
    const marca = limpo(planilha.linhas[paiIdx]["Marca"]);
    const base: Sessao = {
      id: ++sequenciaSessao.current,
      nomeArquivo, planilha, paiIdx, codigoPai, marca, categoria,
      analisadas: new Map(), grupos: new Map(),
    };
    if (!codigoPai) {
      registrar(
        "O PAI ainda não tem 'Código' preenchido — não dá pra gerar os códigos das variações ainda. " +
        "Preencha o Código do PAI, exporte de novo e rode o programa novamente.",
        "aviso",
      );
      setSessao(base); setResumo(null); setFase("pronto");
      return;
    }
    const { analisadas, grupos } = agruparVariacoes(planilha, paiIdx);
    registrar(`${grupos.size} cor(es) detectada(s) automaticamente.`, "ok");
    setSessao({ ...base, analisadas, grupos });
    setFase("cores");
  }

  function gerar(cores: Map<string, [string, string]>, removidas: string[]) {
    if (!sessao) return;
    // o aprendizado vai para um banco à parte; só é gravado de verdade ao salvar a planilha
    const novoAprendido = bancoVazio();
    const { total, linhasSemTamanho } = gerarCodigoEDescricao(
      sessao.planilha, sessao.analisadas, sessao.grupos, sessao.codigoPai, cores, novoAprendido, sessao.marca,
    );
    let paiIdx = sessao.paiIdx;
    let semTamanho = linhasSemTamanho;
    let linhasRemovidas = 0;
    if (removidas.length) {
      const indices = removidas.flatMap((k) => sessao.grupos.get(k)?.indices ?? []);
      const novoIndice = removerLinhas(sessao.planilha, indices);
      paiIdx = novoIndice(paiIdx);
      semTamanho = linhasSemTamanho.map((r) => novoIndice(r - 2) + 2);
      linhasRemovidas = indices.length;
      registrar(`${linhasRemovidas} linha(s) de ${removidas.length} cor(es) pendente(s) removida(s) da planilha.`, "aviso");
    }
    setAprendido(novoAprendido);
    setSessao({ ...sessao, paiIdx });
    registrar(`${total} variação(ões) preenchida(s) com Código e Descrição.`, "ok");
    if (semTamanho.length) {
      registrar(`ATENÇÃO: não identifiquei o tamanho automaticamente nas linhas ${semTamanho.join(", ")} — preencha essas manualmente.`, "aviso");
    }
    registrar("Pronto! Clique em 'Salvar planilha pronta…' para escolher onde salvar.", "ok");
    setResumo({ total, cores: cores.size, linhasSemTamanho: semTamanho, removidas: linhasRemovidas });
    setFase("pronto");
  }

  /** Cancelar na tela de cores: descarta o arquivo por completo, como se nunca tivesse sido aberto. */
  function descartarArquivo() {
    limparTudo();
    avisar("Arquivo descartado. Nada foi salvo nem aprendido.");
  }

  async function salvar() {
    if (!sessao) return;
    try {
      const base = sessao.nomeArquivo.replace(/\.[^.]+$/, "");
      const destino = await plataforma.salvarArquivo(`${base}_PRONTO_PARA_IMPORTAR.xlsx`, gerarXlsx(sessao.planilha));
      if (destino) {
        setCaminhoSalvo(destino);
        registrar(`Arquivo salvo em: ${destino}`, "ok");
        if (aprendido) {
          const copia = normalizarBanco(banco);
          const novas = mesclarBanco(copia, aprendido);
          await persistirBanco(copia);
          setAprendido(null);
          if (novas) registrar(`${novas} abreviação(ões) nova(s) ou alterada(s) guardada(s) no banco de cores.`, "ok");
        }
        avisar("Planilha salva com sucesso!");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      registrar(`ERRO ao salvar: ${msg}`, "erro");
      avisar(`Erro ao salvar: ${msg}`, true);
    }
  }

  // ---------- banco de cores: ações ----------
  async function alterarBanco(fn: (b: BancoCores) => void) {
    const copia = normalizarBanco(banco);
    fn(copia);
    await persistirBanco(copia);
  }

  async function exportarBanco() {
    const destino = await plataforma.exportarCores(serializarBanco(banco));
    if (destino) avisar("Banco de cores exportado.");
  }

  async function importarBanco() {
    const texto = await plataforma.importarCores();
    if (!texto) return;
    try {
      const novo = normalizarBanco(JSON.parse(texto));
      const copia = normalizarBanco(banco);
      const antes = Object.keys(copia.por_marca).length + Object.keys(copia.generico).length;
      Object.assign(copia.por_marca, novo.por_marca);
      Object.assign(copia.generico, novo.generico);
      const depois = Object.keys(copia.por_marca).length + Object.keys(copia.generico).length;
      await persistirBanco(copia);
      avisar(`Importado! ${depois - antes} abreviação(ões) nova(s) somada(s) ao banco.`);
    } catch {
      avisar("Arquivo inválido — escolha um cores_bling.json.", true);
    }
  }

  function aplicarScanner(pares: ParAgregado[], sobrescrever: boolean) {
    const copia = normalizarBanco(banco);
    const { novas, atualizadas } = aplicarAoBanco(copia, pares, sobrescrever);
    persistirBanco(copia);
    avisar(`Banco atualizado: ${novas} nova(s)${atualizadas ? ` e ${atualizadas} atualizada(s)` : ""}.`);
  }

  // ---------- arrastar e soltar ----------
  async function aoSoltar(e: DragEvent) {
    e.preventDefault();
    setArrastando(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!/\.xlsx?$/i.test(f.name)) return avisar("Solte um arquivo .xls ou .xlsx.", true);
    abrir({ nome: f.name, dados: new Uint8Array(await f.arrayBuffer()) });
  }

  // ---------- render ----------
  const passo = fase === "inicio" ? 1 : fase === "cores" ? 2 : 3;
  const titulos: Record<Vista, [string, string]> = {
    planilha: ["Planilha do Bling", "Preenche PAI, variações, cores, códigos e descrições automaticamente."],
    banco: ["Banco de cores", "Abreviações aprendidas — cresce sozinho conforme você usa."],
    scanner: ["Scanner de pastas", "Aprende as abreviações de cores a partir de planilhas que você já finalizou."],
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src={logo} alt="" />
          <div><b>GradeFácil</b><small>Cores e tamanhos</small></div>
        </div>
        <nav className="nav">
          <button className={vista === "planilha" ? "ativo" : ""} onClick={() => setVista("planilha")}>
            <IconePlanilha /> Planilha
          </button>
          <button className={vista === "banco" ? "ativo" : ""} onClick={() => setVista("banco")}>
            <IconePaleta /> Banco de cores
          </button>
          <button className={vista === "scanner" ? "ativo" : ""} onClick={() => setVista("scanner")}>
            <IconeRadar /> Scanner de pastas
          </button>
        </nav>
        <div className="grow" />
        <div className="side-foot">
          <span>v{versao || "…"}</span>
          <button className="icon-btn" onClick={() => setTema(tema === "dark" ? "light" : "dark")} title="Alternar tema" aria-label="Alternar tema">
            {tema === "dark" ? <IconeSol size={17} /> : <IconeLua size={17} />}
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar" style={{ position: "relative" }}>
          <h1>{titulos[vista][0]}</h1>
          <p>{titulos[vista][1]}</p>
          {vista === "planilha" && fase !== "inicio" && (
            <button className="btn sec sm" style={{ position: "absolute", right: 32, top: 24 }} onClick={novoDocumento}>
              Novo documento
            </button>
          )}
          {vista === "planilha" && (
            <div className="stepper">
              {["Arquivo", "Cores", "Salvar"].map((nome, i) => {
                const n = i + 1;
                const estado = n < passo ? "feito" : n === passo ? "ativo" : "";
                return (
                  <div key={nome} style={{ display: "contents" }}>
                    {i > 0 && <span className={`step-sep ${n <= passo ? "feito" : ""}`} />}
                    <div className={`step ${estado}`}>
                      <span className="n">{n < passo ? <IconeCheck size={14} /> : n}</span>{nome}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </header>

        <div className="content" style={{ display: vista === "planilha" ? undefined : "none" }}>
          {fase === "inicio" && (
            <>
              <div
                className={`drop ${arrastando ? "sobre" : ""}`}
                onClick={escolherArquivo}
                onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
                onDragLeave={() => setArrastando(false)}
                onDrop={aoSoltar}
                role="button" tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && escolherArquivo()}
              >
                <div className="ico"><IconeUpload size={30} /></div>
                <h2>Arraste a planilha do Bling aqui</h2>
                <p>ou clique para selecionar o arquivo exportado (.xls ou .xlsx)</p>
                <button className="btn" onClick={(e) => { e.stopPropagation(); escolherArquivo(); }}>Selecionar arquivo…</button>
              </div>
              <div className="dicas">
                <div className="card dica"><div className="n">1</div><b>Abra a planilha</b><span>O PAI é detectado sozinho; se não existir, você preenche os dados para criá-lo.</span></div>
                <div className="card dica"><div className="n">2</div><b>Confirme as cores</b><span>Uma linha por cor, não por tamanho. Abreviações já usadas vêm preenchidas.</span></div>
                <div className="card dica"><div className="n">3</div><b>Salve e importe</b><span>Código e Descrição de todas as variações prontos para importar no Bling.</span></div>
              </div>
            </>
          )}

          {fase === "cores" && sessao && (
            <TelaCores
              key={sessao.id}
              codigoPai={sessao.codigoPai}
              marca={sessao.marca}
              categoria={sessao.categoria}
              totalVariacoes={sessao.planilha.linhas.length - 1}
              grupos={sessao.grupos}
              planilha={sessao.planilha}
              banco={banco}
              onGerar={gerar}
              onCancelar={descartarArquivo}
            />
          )}

          {fase === "pronto" && sessao && (
            <Resultado
              planilha={sessao.planilha}
              paiIdx={sessao.paiIdx}
              codigoPai={sessao.codigoPai}
              resumo={resumo}
              caminhoSalvo={caminhoSalvo}
              onSalvar={salvar}
              onMostrarPasta={() => caminhoSalvo && plataforma.mostrarNaPasta(caminhoSalvo)}
              onNova={novoDocumento}
              abreviacoesAGuardar={aprendido ? Object.keys(aprendido.por_marca).length : 0}
            />
          )}

          {fase !== "cores" && (
            <div className="card">
              <div className="card-head">
                <span>Registro de atividade</span>
                {sessao && <span className="sub">{sessao.nomeArquivo}</span>}
              </div>
              <div className="log">
                {log.length === 0 && <div className="log-vazio">Nenhuma atividade ainda. Selecione um arquivo para começar.</div>}
                {log.map((l) => (
                  <div key={l.id} className={`log-linha ${l.tipo}`}><span className="dot" />{l.texto}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {vista === "banco" && (
          <div className="content">
            <BancoCoresView
              banco={banco}
              caminho={caminhoBanco}
              onAlterar={alterarBanco}
              onExportar={exportarBanco}
              onImportar={importarBanco}
              onMostrarPasta={() => plataforma.mostrarNaPasta(caminhoBanco)}
            />
          </div>
        )}
        {vista === "scanner" && (
          <div className="content">
            <ScannerView banco={banco} onAplicar={aplicarScanner} />
          </div>
        )}
      </main>

      {pendentePai && <NovoPaiDialog onConfirmar={aoCriarPai} onCancelar={() => { setPendentePai(null); registrar("Criação do PAI cancelada.", "aviso"); }} />}
      {confirmarNovo && (
        <Modal titulo="Começar um novo documento?" largura={480} onFechar={() => setConfirmarNovo(false)}
          rodape={
            <>
              <button className="btn sec" onClick={() => setConfirmarNovo(false)}>Voltar</button>
              <button className="btn danger" onClick={limparTudo}>Descartar e começar de novo</button>
            </>
          }>
          <p style={{ marginTop: 0 }}>
            O arquivo atual ainda <b>não foi salvo</b>. Se continuar, tudo o que foi preenchido nele é apagado e
            nenhuma abreviação nova é aprendida.
          </p>
        </Modal>
      )}
      {erroModal && (
        <Modal titulo="Erro ao ler arquivo" largura={480} onFechar={() => setErroModal(null)}
          rodape={<button className="btn" onClick={() => setErroModal(null)}>Entendi</button>}>
          <p style={{ marginTop: 0 }}>{erroModal}</p>
        </Modal>
      )}
      <div className="toasts">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.erro ? "erro" : ""}`}>{t.texto}</div>)}
      </div>
    </div>
  );
}
