import { useEffect, useMemo, useState } from "react";
import type { ArquivoGrande, NoPasta, ProgressoScan } from "../api/types";
import { Anel, Aviso, Barra, Caixa, Vazio, tomPorUso } from "../components/ui";
import { Icone } from "../components/Icons";
import { ListaTarefas } from "../components/ListaTarefas";
import { useApp } from "../state";
import { LIMPEZAS, PREFIXO_LIMPEZA, ITENS } from "../lib/catalogo";
import { bytes, dataBR, duracao, percentual } from "../lib/format";
import { NOMES_TIPO, dicaArquivo, notaPasta } from "../lib/arquivos";

type Aba = "limpeza" | "pastas" | "arquivos" | "tipos";

export function Disco() {
  const { api, diag, limpeza, atualizarLimpeza, scan, setScan, executar } = useApp();
  const [aba, setAba] = useState<Aba>("limpeza");
  const [escaneando, setEscaneando] = useState(false);
  const [prog, setProg] = useState<ProgressoScan | null>(null);
  const [erro, setErro] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());

  // pré-seleciona as limpezas seguras assim que o tamanho é conhecido
  useEffect(() => {
    if (!limpeza) return;
    const padrao = new Set(LIMPEZAS.filter((l) => l.padrao).map((l) => l.id));
    setSel(new Set(limpeza.filter((i) => padrao.has(i.id) && (i.bytes ?? 0) > 0).map((i) => PREFIXO_LIMPEZA + i.id)));
  }, [limpeza]);

  async function escanearCompleto() {
    setErro("");
    setEscaneando(true);
    setProg(null);
    const parar = api.aoProgressoScan(setProg);
    try {
      await atualizarLimpeza();
      setScan(await api.escanearDisco());
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      parar();
      setEscaneando(false);
    }
  }
  async function soLixo() {
    setErro("");
    setEscaneando(true);
    setProg(null);
    try {
      await atualizarLimpeza();
    } catch (e) {
      setErro(String((e as Error).message || e));
    } finally {
      setEscaneando(false);
    }
  }

  const tamanhos = useMemo(() => Object.fromEntries((limpeza ?? []).map((i) => [PREFIXO_LIMPEZA + i.id, i.bytes])), [limpeza]);
  const itensLimpeza = useMemo(() => ITENS.filter((i) => i.limpeza && (limpeza ?? []).some((l) => PREFIXO_LIMPEZA + l.id === i.id && l.existe)), [limpeza]);
  const totalSel = [...sel].reduce((s, id) => s + (tamanhos[id] ?? 0), 0);
  const totalLiberavel = (limpeza ?? []).filter((i) => LIMPEZAS.find((l) => l.id === i.id)?.padrao).reduce((s, i) => s + (i.bytes ?? 0), 0);

  const usado = diag ? diag.discoTotal - diag.discoLivre : scan?.totalBytes ?? 0;
  const total = diag?.discoTotal ?? 0;

  return (
    <div className="pagina com-barra">
      <header className="pagina-topo">
        <div>
          <h1>Espaço em disco</h1>
          <p className="muted">Descubra o que mais ocupa espaço no C: e o que pode ser apagado com segurança.</p>
        </div>
        <div className="acoes">
          <button className="btn" disabled={escaneando} onClick={soLixo}><Icone nome="trash" tam={16} /> Procurar lixo (rápido)</button>
          <button className="btn primario" disabled={escaneando} onClick={escanearCompleto}><Icone nome="search" tam={16} /> Escanear o disco C: inteiro</button>
        </div>
      </header>

      {erro && <Aviso tom="erro">{erro}</Aviso>}

      {escaneando && (
        <div className="cartao scan-andamento">
          <span className="spinner grande" />
          <div className="scan-info">
            <strong>{prog ? "Lendo o disco…" : "Procurando arquivos descartáveis…"}</strong>
            {prog && <>
              <span>{prog.arquivos.toLocaleString("pt-BR")} arquivos · {prog.pastas.toLocaleString("pt-BR")} pastas · {bytes(prog.bytes)}</span>
              <small className="caminho" title={prog.atual}>{prog.atual}</small>
              {total > 0 && <Barra pct={percentual(prog.bytes, usado)} />}
            </>}
          </div>
          {prog && <button className="btn" onClick={() => api.cancelarScan()}>Parar</button>}
        </div>
      )}

      {total > 0 && (
        <div className="cartao disco-resumo">
          <Anel valor={percentual(usado, total)} rotulo={`${percentual(usado, total).toFixed(0)}%`} sub="usado" tom={`var(--${tomPorUso(percentual(usado, total))})`} tam={110} />
          <div>
            <h3>Disco C: — {bytes(diag!.discoLivre)} livres de {bytes(total, 0)}</h3>
            <p className="muted">
              {limpeza ? <>Dá para liberar <b>{bytes(totalLiberavel)}</b> com a limpeza segura.</> : "Clique em “Procurar lixo” para saber quanto dá para liberar."}
              {scan && <> Último scan: {scan.arquivos.toLocaleString("pt-BR")} arquivos em {duracao(scan.duracaoMs)}{scan.erros ? ` (${scan.erros} pastas sem acesso)` : ""}.</>}
            </p>
          </div>
        </div>
      )}

      <nav className="abas">
        {([["limpeza", "O que posso apagar", "trash"], ["pastas", "O que mais ocupa", "folder"], ["arquivos", "Maiores arquivos", "file"], ["tipos", "Por tipo", "list"]] as const).map(([id, nome, ico]) => (
          <button key={id} className={aba === id ? "ativa" : ""} onClick={() => setAba(id)}><Icone nome={ico} tam={16} /> {nome}</button>
        ))}
      </nav>

      {aba === "limpeza" && (
        limpeza ? (
          <>
            <ListaTarefas itens={itensLimpeza} sel={sel} alternar={(id, v) => setSel((s) => { const n = new Set(s); v ? n.add(id) : n.delete(id); return n; })} tamanhos={tamanhos} />
            <div className="barra-acao">
              <div>
                <strong>{sel.size} item(ns) · {bytes(totalSel)}</strong>
                <small>Só os itens marcados como “Seguro” vêm selecionados. Arquivos pessoais nunca são tocados.</small>
              </div>
              <button className="btn primario" disabled={!sel.size} onClick={() => executar([...sel], "Limpar disco")}><Icone nome="trash" tam={16} /> Limpar selecionados</button>
            </div>
          </>
        ) : <Vazio icone="trash" titulo="Ainda não procurei lixo">Clique em “Procurar lixo (rápido)” para listar temporários, caches, relatórios de erro e outros arquivos descartáveis.</Vazio>
      )}

      {aba === "pastas" && (scan ? <ArvorePastas raiz={scan.arvore} /> : <SemScan onClick={escanearCompleto} desabilitado={escaneando} />)}
      {aba === "arquivos" && (scan ? <Arquivos lista={scan.maiores} /> : <SemScan onClick={escanearCompleto} desabilitado={escaneando} />)}
      {aba === "tipos" && (scan ? <Tipos porTipo={scan.porTipo} total={scan.totalBytes} /> : <SemScan onClick={escanearCompleto} desabilitado={escaneando} />)}
    </div>
  );
}

function SemScan({ onClick, desabilitado }: { onClick(): void; desabilitado: boolean }) {
  return (
    <Vazio icone="disk" titulo="Escaneie o disco para ver esta lista">
      A leitura completa do C: leva de 2 a 10 minutos, dependendo do disco. Você pode continuar olhando as outras abas enquanto isso.
      <br /><br />
      <button className="btn primario" disabled={desabilitado} onClick={onClick}><Icone nome="search" tam={16} /> Escanear o disco C: inteiro</button>
    </Vazio>
  );
}

function ArvorePastas({ raiz }: { raiz: NoPasta }) {
  return (
    <div className="cartao arvore">
      <Aviso>As barras mostram o quanto cada pasta pesa no total do disco. O que está marcado em vermelho é do sistema: não apague na mão.</Aviso>
      <ul>
        {raiz.filhos.map((f) => <Linha key={f.caminho} no={f} total={raiz.bytes} nivel={0} />)}
      </ul>
    </div>
  );
}

function Linha({ no, total, nivel }: { no: NoPasta; total: number; nivel: number }) {
  const { api } = useApp();
  const [aberto, setAberto] = useState(nivel < 1 && no.bytes / total > 0.15);
  const nota = notaPasta(no.caminho);
  const pct = percentual(no.bytes, total);
  return (
    <li>
      <div className="linha-pasta">
        <div className="pasta-nome" style={{ paddingLeft: nivel * 22 }}>
          <button className={`seta${aberto ? " aberta" : ""}`} disabled={!no.filhos.length} onClick={() => setAberto(!aberto)} aria-label="Expandir"><Icone nome="chevron" tam={14} /></button>
          <Icone nome="folder" tam={16} />
          <span title={no.caminho}>{no.nome}</span>
        </div>
        <span>{nota && <span className={`selo nota-${nota.tom}`} title={nota.texto}>{nota.tom === "perigo" ? "sistema" : nota.tom === "bom" ? "pode limpar" : "cuidado"}</span>}</span>
        <div className="pasta-barra"><Barra pct={pct} tom={pct > 30 ? "vermelho" : pct > 10 ? "ambar" : "azul"} alto={6} /></div>
        <span className="pasta-tam">{bytes(no.bytes)}</span>
        <span className="pasta-pct">{pct.toFixed(1).replace(".", ",")}%</span>
        <button className="btn-icone" title="Abrir no Explorador" onClick={() => api.abrirPasta(no.caminho)}><Icone nome="external" tam={15} /></button>
      </div>
      {nota && aberto && <div className="pasta-nota" style={{ paddingLeft: nivel * 22 + 44 }}>{nota.texto}</div>}
      {aberto && no.filhos.length > 0 && <ul>{no.filhos.slice(0, 15).map((f) => <Linha key={f.caminho} no={f} total={total} nivel={nivel + 1} />)}</ul>}
    </li>
  );
}

function Arquivos({ lista }: { lista: ArquivoGrande[] }) {
  const { api } = useApp();
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [removidos, setRemovidos] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("");
  const visiveis = lista.filter((a) => !removidos.has(a.caminho));
  const total = [...marcados].reduce((s, c) => s + (lista.find((a) => a.caminho === c)?.bytes ?? 0), 0);

  async function lixeira() {
    const r = await api.enviarParaLixeira([...marcados]);
    setRemovidos((s) => new Set([...s, ...r.feitos]));
    setMarcados(new Set());
    setMsg(`${r.feitos.length} arquivo(s) enviado(s) para a Lixeira${r.falhas.length ? ` · ${r.falhas.length} não puderam ser movidos` : ""}. Esvazie a Lixeira para recuperar o espaço.`);
  }

  return (
    <>
      <div className="cartao tabela">
        <Aviso>Estes são os maiores arquivos do disco. Marque o que o cliente autorizar a apagar: eles vão para a <b>Lixeira</b> (dá para recuperar), nada é apagado definitivamente.</Aviso>
        {msg && <Aviso>{msg}</Aviso>}
        <table>
          <thead><tr><th /><th>Arquivo</th><th>Tamanho</th><th>Modificado</th><th>Sugestão</th><th /></tr></thead>
          <tbody>
            {visiveis.map((a) => {
              const dica = dicaArquivo(a.caminho, a.nome, a.modificado);
              const bloqueado = dica?.tom === "perigo";
              return (
                <tr key={a.caminho} className={marcados.has(a.caminho) ? "sel" : ""}>
                  <td><Caixa marcado={marcados.has(a.caminho)} desabilitado={bloqueado} rotulo={a.nome} onChange={(v) => setMarcados((s) => { const n = new Set(s); v ? n.add(a.caminho) : n.delete(a.caminho); return n; })} /></td>
                  <td><strong>{a.nome}</strong><small className="caminho" title={a.pasta}>{a.pasta}</small></td>
                  <td className="num">{bytes(a.bytes)}</td>
                  <td>{dataBR(a.modificado)}</td>
                  <td>{dica && <span className={`selo nota-${dica.tom}`}>{dica.texto}</span>}</td>
                  <td><button className="btn-icone" title="Mostrar no Explorador" onClick={() => api.mostrarNaPasta(a.caminho)}><Icone nome="external" tam={15} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="barra-acao">
        <div><strong>{marcados.size} arquivo(s) · {bytes(total)}</strong><small>Enviados para a Lixeira — reversível.</small></div>
        <button className="btn primario" disabled={!marcados.size} onClick={lixeira}><Icone nome="trash" tam={16} /> Enviar para a Lixeira</button>
      </div>
    </>
  );
}

function Tipos({ porTipo, total }: { porTipo: Record<string, { bytes: number; arquivos: number }>; total: number }) {
  const linhas = Object.entries(porTipo).sort((a, b) => b[1].bytes - a[1].bytes);
  return (
    <div className="cartao tipos">
      {linhas.map(([tipo, v]) => (
        <div key={tipo} className="tipo-linha">
          <span>{NOMES_TIPO[tipo] ?? tipo}</span>
          <Barra pct={percentual(v.bytes, total)} alto={10} />
          <strong>{bytes(v.bytes)}</strong>
          <small>{v.arquivos.toLocaleString("pt-BR")} arquivos</small>
        </div>
      ))}
    </div>
  );
}
