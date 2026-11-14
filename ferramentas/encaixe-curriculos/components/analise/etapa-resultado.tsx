"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RegraDeOuro } from "@/components/regra-de-ouro";
import { calcularMatch } from "@/lib/score";
import { reescreverCurriculo } from "@/lib/reescrever-curriculo";
import type { EstiloCurriculo } from "@/lib/estilo";
import type { AnaliseVaga, LacunaConfirmada, ResultadoReescrita } from "@/lib/tipos";
import { PainelScore } from "./painel-score";
import { PalavrasChave } from "./palavras-chave";
import { Lacunas, type RespostaLacuna } from "./lacunas";
import { CurriculoAjustado, type PassoHistorico } from "./curriculo-ajustado";
import { Sugestoes } from "./sugestoes";
import { NivelVaga } from "./nivel-vaga";
import { avaliarNivel } from "@/lib/nivel";
import { RevisaoOrtografica } from "./revisao-ortografica";
import { toast } from "sonner";
import { Dicas } from "./dicas";
import { termosProibidos, validarAntiInvencao } from "@/lib/anti-invencao";

interface Props {
  analise: AnaliseVaga;
  curriculo: string;
  estilo: EstiloCurriculo | null;
  onVoltar: () => void;
  onNovaAnalise: () => void;
  /** Corrige o texto original (ex.: ortografia antes de gerar o ajustado). */
  onAlterarOriginal: (texto: string) => void;
  vaga: string;
}

export function EtapaResultado({ analise, curriculo, estilo, onVoltar, onNovaAnalise, onAlterarOriginal, vaga }: Props) {
  // Palavras da vaga e termos da análise não são tratados como erro de ortografia.
  const extrasOrtografia = useMemo(
    () => [...analise.palavras_chave.flatMap((p) => [p.termo, ...p.variantes]), ...(vaga.match(/\p{L}+/gu) ?? [])],
    [analise, vaga]
  );
  const match = useMemo(() => calcularMatch(curriculo, analise.palavras_chave), [curriculo, analise]);
  const [respostas, setRespostas] = useState<Record<string, RespostaLacuna>>({});
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoReescrita | null>(null);
  const [confirmadas, setConfirmadas] = useState<LacunaConfirmada[]>([]);
  const [texto, setTexto] = useState("");
  const [historico, setHistorico] = useState<PassoHistorico[]>([]);
  const nivel = useMemo(() => avaliarNivel({ vaga, cargo: analise.cargo, curriculo }), [vaga, analise, curriculo]);
  const [nivelEntrada, setNivelEntrada] = useState(false);
  const proibidos = useMemo(() => termosProibidos(match.faltando, confirmadas), [match, confirmadas]);

  function aplicar(novo: string, descricao: string) {
    if (novo === texto) return;
    setHistorico((h) => [...h, { texto, descricao }]);
    setTexto(novo);
    toast.success(descricao);
  }

  const scoreDepois = useMemo(
    () => (resultado ? calcularMatch(texto, analise.palavras_chave).score : 0),
    [resultado, texto, analise]
  );

  // A validação anti-invenção continua valendo para as edições feitas na tela.
  const avisos = useMemo(() => {
    if (!resultado) return [];
    return validarAntiInvencao({
      curriculoAjustado: texto,
      curriculoOriginal: curriculo,
      proibidos,
      confirmadas,
    });
  }, [resultado, texto, curriculo, proibidos, confirmadas]);

  useEffect(() => {
    if (resultado) document.getElementById("titulo-ajustado")?.focus();
  }, [resultado]);

  async function gerar() {
    // Só entram termos marcados como "Sim" e com descrição preenchida.
    const lacunas: LacunaConfirmada[] = match.faltando
      .map((p) => ({ termo: p.termo, r: respostas[p.termo] }))
      .filter(({ r }) => r?.resposta === "sim" && r.descricao.trim().length > 0)
      .map(({ termo, r }) => ({ termo, descricao: r!.descricao.trim() }));

    setGerando(true);
    setResultado(null);
    await new Promise((r) => setTimeout(r, 500));
    const novo = reescreverCurriculo({ curriculo, palavras: analise.palavras_chave, confirmadas: lacunas });
    setConfirmadas(lacunas);
    setResultado(novo);
    setTexto(novo.curriculo);
    setHistorico([]);
    setGerando(false);
  }

  return (
    <div className="grid gap-8">
      <RegraDeOuro className="z-30 sm:sticky sm:top-[4.5rem]" />

      <div className="grid items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <PainelScore score={match.score} cargo={analise.cargo} />
        <PalavrasChave encontradas={match.encontradas} faltando={match.faltando} />
      </div>

      <NivelVaga avaliacao={nivel} ativo={nivelEntrada} onAlternar={setNivelEntrada} gerado={!!resultado} />

      <Lacunas
        faltando={match.faltando}
        respostas={respostas}
        onResponder={(termo, r) => setRespostas((atual) => ({ ...atual, [termo]: r }))}
        gerando={gerando}
        onGerar={gerar}
      />

      <div aria-live="polite" className="grid gap-4">
        {gerando && (
          <div className="grid gap-3" aria-busy="true">
            <p role="status" className="font-medium">Reescrevendo seu currículo com as palavras da vaga…</p>
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}
      </div>

      {resultado && (
        <CurriculoAjustado
          original={curriculo}
          texto={texto}
          gerado={resultado.curriculo}
          historico={historico}
          onEditar={setTexto}
          onDesfazer={() => {
            const anterior = historico[historico.length - 1];
            if (!anterior) return;
            setTexto(anterior.texto);
            setHistorico((h) => h.slice(0, -1));
          }}
          onRestaurar={() => {
            setTexto(resultado.curriculo);
            setHistorico([]);
          }}
          mudancas={resultado.mudancas}
          avisos={avisos}
          cargo={analise.cargo}
          estilo={estilo}
          scoreAntes={match.score}
          scoreDepois={scoreDepois}
          onNovaAnalise={onNovaAnalise}
        />
      )}

      {resultado && <Sugestoes
          texto={texto}
          palavras={analise.palavras_chave}
          cargo={analise.cargo}
          nivelEntrada={nivelEntrada}
          proibidos={proibidos}
          onAplicar={aplicar}
        />}

      <RevisaoOrtografica
        texto={resultado ? texto : curriculo}
        extras={extrasOrtografia}
        onCorrigir={resultado ? aplicar : (novo, descricao) => {
          onAlterarOriginal(novo);
          toast.success(descricao);
        }}
      />

      <Dicas texto={resultado ? texto : curriculo} palavras={analise.palavras_chave} ajustado={!!resultado} />

      <div>
        <Button variant="outline" onClick={onVoltar}>
          <ArrowLeft aria-hidden="true" />
          Voltar
        </Button>
      </div>
    </div>
  );
}
