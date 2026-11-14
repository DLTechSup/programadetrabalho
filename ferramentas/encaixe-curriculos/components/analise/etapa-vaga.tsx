"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Contador } from "./contador";

interface Props {
  vaga: string;
  setVaga: (v: string) => void;
  onContinuar: () => void;
}

export function EtapaVaga({ vaga, setVaga, onContinuar }: Props) {
  const [erro, setErro] = useState("");

  function continuar() {
    if (!vaga.trim()) {
      setErro("Cole o texto da vaga para continuar.");
      document.getElementById("texto-vaga")?.focus();
      return;
    }
    setErro("");
    onContinuar();
  }

  const invalido = !!erro && !vaga.trim();

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Label htmlFor="texto-vaga" className="text-base">
          Texto da vaga
        </Label>
        <ol id="como-copiar" className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
          {[
            "Abra a vaga no site onde você a encontrou (Indeed, LinkedIn, Gupy…).",
            "Selecione a descrição, principalmente as atividades e os requisitos, e copie (Ctrl+C).",
            "Cole aqui embaixo (Ctrl+V). A formatação não importa.",
          ].map((passo, i) => (
            <li key={passo} className="flex gap-2 rounded-lg bg-muted/70 p-3">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <span>{passo}</span>
            </li>
          ))}
        </ol>
        <Textarea
          id="texto-vaga"
          value={vaga}
          onChange={(e) => {
            setVaga(e.target.value);
            if (erro) setErro("");
          }}
          placeholder="Cole aqui a descrição da vaga: título, atividades, requisitos e diferenciais."
          className="min-h-64 max-h-[60vh]"
          aria-invalid={invalido || undefined}
          aria-describedby="como-copiar contador-vaga erro-vaga"
        />
        <Contador id="contador-vaga" atual={vaga.trim().length} />
      </div>

      <p id="erro-vaga" role="alert" className="text-sm font-medium text-destructive empty:hidden">
        {erro}
      </p>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            Voltar
          </Link>
        </Button>
        <Button onClick={continuar}>
          <ClipboardPaste aria-hidden="true" />
          Continuar
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
