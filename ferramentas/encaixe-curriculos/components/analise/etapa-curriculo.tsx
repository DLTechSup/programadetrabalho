"use client";

import { useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Contador } from "./contador";
import { EnvioArquivo } from "./envio-arquivo";
import type { EstiloCurriculo } from "@/lib/estilo";
import { MIN_CURRICULO } from "@/lib/constantes";

interface Props {
  curriculo: string;
  setCurriculo: (v: string) => void;
  setEstilo: (e: EstiloCurriculo | null) => void;
  carregando: boolean;
  erroAnalise: string;
  onVoltar: () => void;
  onAnalisar: () => void;
}

export function EtapaCurriculo({ curriculo, setCurriculo, setEstilo, carregando, erroAnalise, onVoltar, onAnalisar }: Props) {
  const [erro, setErro] = useState("");

  function analisar() {
    if (curriculo.trim().length < MIN_CURRICULO) {
      setErro(`O currículo precisa ter pelo menos ${MIN_CURRICULO} caracteres.`);
      return;
    }
    setErro("");
    onAnalisar();
  }

  if (carregando) {
    return (
      <div className="grid gap-4" aria-busy="true">
        <p role="status" className="flex items-center gap-2 font-medium">
          <Sparkles className="size-4 animate-pulse text-primary" aria-hidden="true" />
          Lendo a vaga e o seu currículo…
        </p>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-24" />
          ))}
        </div>
      </div>
    );
  }

  const mensagem = erro || erroAnalise;

  return (
    <div className="grid gap-6">
      <EnvioArquivo
        onArquivo={(texto, estilo) => {
          setCurriculo(texto);
          setEstilo(estilo);
        }}
      />

      <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        ou cole o texto
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="texto-curriculo" className="text-base">
          Texto do seu currículo
        </Label>
        <Textarea
          id="texto-curriculo"
          value={curriculo}
          onChange={(e) => {
            setCurriculo(e.target.value);
            // Texto apagado: o estilo do arquivo anterior deixa de valer.
            if (!e.target.value.trim()) setEstilo(null);
          }}
          placeholder="Cole aqui o texto completo do seu currículo"
          className="min-h-80 max-h-[65vh]"
          aria-invalid={(!!erro && curriculo.trim().length < MIN_CURRICULO) || undefined}
          aria-describedby="dica-curriculo contador-curriculo erro-curriculo"
        />
        <p id="dica-curriculo" className="text-sm text-muted-foreground">
          Envie o arquivo acima ou copie do seu Word ou PDF. A formatação não importa: nós organizamos.
        </p>
        <Contador id="contador-curriculo" atual={curriculo.trim().length} minimo={MIN_CURRICULO} />
      </div>

      <p id="erro-curriculo" role="alert" className="text-sm font-medium text-destructive empty:hidden">
        {mensagem}
      </p>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={onVoltar}>
          <ArrowLeft aria-hidden="true" />
          Voltar
        </Button>
        <Button onClick={analisar}>
          <Sparkles aria-hidden="true" />
          Analisar
        </Button>
      </div>
    </div>
  );
}
