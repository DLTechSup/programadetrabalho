"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { AVISO_PRIVACIDADE } from "@/lib/constantes";
import type { AnaliseVaga } from "@/lib/tipos";
import { analisarVaga } from "@/lib/analisar-vaga";
import type { EstiloCurriculo } from "@/lib/estilo";
import { IndicadorEtapas } from "./indicador-etapas";
import { EtapaVaga } from "./etapa-vaga";
import { EtapaCurriculo } from "./etapa-curriculo";
import { EtapaResultado } from "./etapa-resultado";

type Etapa = 1 | 2 | 3;

const TITULOS: Record<Etapa, { titulo: string; subtitulo: string }> = {
  1: { titulo: "Qual é a vaga?", subtitulo: "Cole o texto da vaga para descobrirmos o que o filtro procura." },
  2: { titulo: "Agora, o seu currículo", subtitulo: "Vamos comparar com o que a vaga pede." },
  3: { titulo: "Seu resultado", subtitulo: "Veja seu encaixe, confirme o que você tem e gere a versão ajustada." },
};

/** Estado apenas em memória: nada é salvo e tudo some ao recarregar. A análise roda no navegador. */
export function FluxoAnalise() {
  const [etapa, setEtapa] = useState<Etapa>(1);
  const [vaga, setVaga] = useState("");
  const [curriculo, setCurriculo] = useState("");
  const [estilo, setEstilo] = useState<EstiloCurriculo | null>(null);
  const [analise, setAnalise] = useState<AnaliseVaga | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [chaveResultado, setChaveResultado] = useState(0);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const primeiraRenderizacao = useRef(true);

  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    tituloRef.current?.focus();
  }, [etapa]);

  async function analisar() {
    setErro("");
    setCarregando(true);
    // Pausa curta só para a pessoa ver que a leitura aconteceu; tudo roda aqui no navegador.
    await new Promise((r) => setTimeout(r, 500));
    const resultado = analisarVaga(vaga);
    setCarregando(false);
    if (resultado.palavras_chave.length === 0) {
      setErro(
        "Não encontramos requisitos nessa descrição. Volte e confira se colou a vaga completa, com a parte de requisitos."
      );
      return;
    }
    setAnalise(resultado);
    setChaveResultado((k) => k + 1);
    setEtapa(3);
  }

  function novaAnalise() {
    setVaga("");
    setCurriculo("");
    setEstilo(null);
    setAnalise(null);
    setErro("");
    setEtapa(1);
  }

  const { titulo, subtitulo } = TITULOS[etapa];

  return (
    <div className="fundo-hero min-h-full">
      <div className={cn("mx-auto grid gap-8 px-4 py-8 sm:px-6 sm:py-12", etapa === 3 ? "max-w-7xl" : "max-w-3xl")}>
        <IndicadorEtapas atual={etapa} />

        <div className="grid gap-2">
          <h1 ref={tituloRef} tabIndex={-1} className="text-3xl font-extrabold tracking-tight outline-none sm:text-4xl">
            {titulo}
          </h1>
          <p className="text-lg text-muted-foreground">{subtitulo}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="size-3.5 text-primary" aria-hidden="true" />
            {AVISO_PRIVACIDADE} Tudo acontece no seu navegador.
          </p>
        </div>

        {etapa === 1 && (
          <div className="sombra-suave rounded-2xl border bg-white p-5 sm:p-8">
            <EtapaVaga vaga={vaga} setVaga={setVaga} onContinuar={() => setEtapa(2)} />
          </div>
        )}
        {etapa === 2 && (
          <div className="sombra-suave rounded-2xl border bg-white p-5 sm:p-8">
            <EtapaCurriculo
              curriculo={curriculo}
              setCurriculo={setCurriculo}
              setEstilo={setEstilo}
              carregando={carregando}
              erroAnalise={erro}
              onVoltar={() => setEtapa(1)}
              onAnalisar={analisar}
            />
          </div>
        )}
        {etapa === 3 && analise && (
          <EtapaResultado
            key={chaveResultado}
            analise={analise}
            curriculo={curriculo}
            estilo={estilo}
            onVoltar={() => setEtapa(2)}
            onNovaAnalise={novaAnalise}
            onAlterarOriginal={setCurriculo}
            vaga={vaga}
          />
        )}
      </div>
    </div>
  );
}
