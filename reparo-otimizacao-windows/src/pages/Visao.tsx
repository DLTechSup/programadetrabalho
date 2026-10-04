import { useEffect, useState } from "react";
import { Anel, Aviso, Barra, SeloSeveridade, Caixa, tomPorUso } from "../components/ui";
import { Icone } from "../components/Icons";
import { useApp } from "../state";
import { pontuacao, rotuloNota } from "../lib/analise";
import { bytes, percentual } from "../lib/format";
import { SINTOMAS, tituloDe } from "../lib/catalogo";

export function Visao() {
  const { diag, problemas, estadoAnalise, passoAnalise, erroAnalise, analisar, executar, ir } = useApp();
  const [sel, setSel] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (estadoAnalise === "pronto") setSel(new Set(problemas.filter((p) => p.ids.length && p.padrao).map((p) => p.id)));
  }, [estadoAnalise, problemas]);

  if (estadoAnalise === "nunca" || estadoAnalise === "erro") {
    return (
      <div className="pagina">
        <section className="hero">
          <div>
            <h1>O que está acontecendo com o computador?</h1>
            <p>Faço uma análise completa em poucos minutos: espaço em disco, memória, programas de inicialização, internet e configurações do Windows — e mostro o que dá para consertar, com opção de resolver tudo de uma vez.</p>
            <button className="btn primario grande" onClick={analisar}><Icone nome="search" /> Analisar este computador</button>
            {estadoAnalise === "erro" && <Aviso tom="erro">Não consegui concluir a análise: {erroAnalise}</Aviso>}
          </div>
        </section>
        <h2 className="secao">Ou escolha o que o cliente está reclamando</h2>
        <div className="cartoes">
          {SINTOMAS.map((s) => (
            <button key={s.id} className="cartao-sintoma" onClick={() => ir(s.id === "disco" ? "disco" : "otimizar", s.id)}>
              <span className="cartao-ico"><Icone nome={s.icone} tam={22} /></span>
              <strong>{s.titulo}</strong>
              <small>{s.descricao}</small>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (estadoAnalise === "rodando" || !diag) {
    return (
      <div className="pagina centro">
        <div className="analisando">
          <span className="spinner grande" />
          <h2>Analisando o computador…</h2>
          <p>{passoAnalise}</p>
        </div>
      </div>
    );
  }

  const nota = pontuacao(problemas);
  const tomNota = nota >= 70 ? "var(--verde)" : nota >= 45 ? "var(--ambar)" : "var(--vermelho)";
  const usoDisco = percentual(diag.discoTotal - diag.discoLivre, diag.discoTotal);
  const usoRam = percentual(diag.ramTotal - diag.ramLivre, diag.ramTotal);
  const marcaveis = problemas.filter((p) => p.ids.length);
  const idsSel = [...new Set(problemas.filter((p) => sel.has(p.id)).flatMap((p) => p.ids))];
  const liberar = problemas.filter((p) => sel.has(p.id)).reduce((s, p) => s + (p.liberavel ?? 0), 0);
  const todos = () => executar([...new Set(marcaveis.flatMap((p) => p.ids))], "Resolver tudo");

  return (
    <div className="pagina com-barra">
      <div className="topo-visao">
        <div className="cartao nota">
          <Anel valor={nota} rotulo={String(nota)} sub={rotuloNota(nota)} tom={tomNota} />
          <div>
            <h2>Saúde do computador</h2>
            <p className="muted">{problemas.length === 0 ? "Nenhum problema encontrado." : `${problemas.length} ponto(s) encontrado(s), ${marcaveis.length} com correção automática.`}</p>
            <button className="btn" onClick={analisar}><Icone nome="refresh" tam={16} /> Analisar de novo</button>
          </div>
        </div>
        <div className="cartao metricas">
          <div className="metrica">
            <span><Icone nome="disk" tam={16} /> Disco C: ({diag.tipoDisco})</span>
            <strong>{bytes(diag.discoLivre)} livres</strong>
            <Barra pct={usoDisco} tom={tomPorUso(usoDisco)} />
            <small>{bytes(diag.discoTotal - diag.discoLivre)} usados de {bytes(diag.discoTotal, 0)}</small>
          </div>
          <div className="metrica">
            <span><Icone nome="memory" tam={16} /> Memória RAM</span>
            <strong>{bytes(diag.ramTotal - diag.ramLivre)} em uso</strong>
            <Barra pct={usoRam} tom={tomPorUso(usoRam)} />
            <small>{bytes(diag.ramTotal, 0)} instalados</small>
          </div>
          <div className="metrica">
            <span><Icone nome="cpu" tam={16} /> Processador</span>
            <strong>{diag.cpuUso}% agora</strong>
            <Barra pct={diag.cpuUso} tom={tomPorUso(diag.cpuUso)} />
            <small title={diag.cpu}>{diag.nucleos} threads · {diag.cpu.replace(/\(R\)|\(TM\)|CPU /g, "").slice(0, 34)}</small>
          </div>
          <div className="metrica">
            <span><Icone nome="power" tam={16} /> Ligado há</span>
            <strong>{diag.uptimeDias < 1 ? "menos de 1 dia" : `${Math.floor(diag.uptimeDias)} dia(s)`}</strong>
            <small>{diag.windows.replace("Microsoft ", "")}</small>
          </div>
        </div>
      </div>

      <h2 className="secao">Problemas encontrados</h2>
      {problemas.length === 0 && <Aviso>Tudo em ordem. Se o cliente ainda reclama de lentidão, use “Otimização” para aplicar ajustes finos.</Aviso>}
      <ul className="problemas">
        {problemas.map((p) => (
          <li key={p.id} className={`problema sev-borda-${p.severidade}${sel.has(p.id) ? " sel" : ""}`}>
            {p.ids.length ? (
              <Caixa marcado={sel.has(p.id)} onChange={(v) => setSel((s) => { const n = new Set(s); v ? n.add(p.id) : n.delete(p.id); return n; })} rotulo={p.titulo} />
            ) : (
              <span className="sem-caixa"><Icone nome="info" /></span>
            )}
            <div className="problema-corpo">
              <div className="problema-topo">
                <strong>{p.titulo}</strong>
                <SeloSeveridade s={p.severidade} />
                <span className="selo neutro">{p.area}</span>
                {p.liberavel ? <span className="selo sev-info">libera {bytes(p.liberavel)}</span> : null}
              </div>
              <p>{p.detalhe}</p>
              {p.ids.length > 0 && <div className="chips">{p.ids.map((i) => <span key={i} className="chip">{tituloDe(i)}</span>)}</div>}
              {p.manual && <div className="manual"><Icone nome="wrench" tam={14} /> {p.manual}</div>}
            </div>
          </li>
        ))}
      </ul>

      {marcaveis.length > 0 && (
        <div className="barra-acao">
          <div>
            <strong>{idsSel.length} correção(ões) selecionada(s)</strong>
            <small>{liberar > 0 ? `Libera cerca de ${bytes(liberar)} · ` : ""}Você confirma tudo antes de executar.</small>
          </div>
          <button className="btn" onClick={todos}><Icone nome="rocket" tam={16} /> Resolver tudo</button>
          <button className="btn primario" disabled={!idsSel.length} onClick={() => executar(idsSel, "Resolver problemas selecionados")}><Icone nome="play" tam={16} /> Resolver selecionados</button>
        </div>
      )}
    </div>
  );
}
