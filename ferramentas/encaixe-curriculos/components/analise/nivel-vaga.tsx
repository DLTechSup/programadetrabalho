"use client";

import { ArrowDownWideNarrow, Info, MessageCircleHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AvaliacaoNivel } from "@/lib/nivel";
import { cn } from "@/lib/utils";

interface Props {
  avaliacao: AvaliacaoNivel;
  ativo: boolean;
  onAlternar: (ativo: boolean) => void;
  gerado: boolean;
}

function juntar(itens: string[]) {
  return itens.length <= 1 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** Opção de ajustar o currículo para uma vaga de nível mais simples ("qualificado demais"). */
export function NivelVaga({ avaliacao, ativo, onAlternar, gerado }: Props) {
  const { sobrequalificado, sinaisVaga, sinaisCurriculo } = avaliacao;

  if (!sobrequalificado && !ativo) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <ArrowDownWideNarrow className="size-4 text-primary" aria-hidden="true" />
        Vai se candidatar a uma vaga de nível mais simples do que a sua experiência?
        <Button variant="link" className="h-auto p-0 text-sm" onClick={() => onAlternar(true)}>
          Ajustar o currículo para ela
        </Button>
      </p>
    );
  }

  return (
    <Card className={cn("gap-4 border-2", ativo ? "border-primary/40 bg-accent/30" : "border-warning/50 bg-amber-50/60")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ArrowDownWideNarrow className="size-5 text-primary" aria-hidden="true" />
          {ativo ? "Currículo ajustado para uma vaga de nível mais simples" : "Você pode parecer “qualificado demais” para esta vaga"}
        </CardTitle>
        {sobrequalificado && (
          <p className="text-sm text-muted-foreground">
            A vaga tem {juntar(sinaisVaga)}, e o seu currículo mostra {juntar(sinaisCurriculo)}. Muitos recrutadores
            descartam perfis assim achando que a pessoa vai sair logo ou não vai se adaptar.
          </p>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        <ul className="grid gap-1.5 text-sm">
          <li className="flex gap-2">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <strong>O que muda:</strong> destacamos o trabalho prático que você já fez e deixamos de fora o que não ajuda
              nesta vaga (pós-graduação, tópicos de gestão estratégica, ferramentas avançadas).
            </span>
          </li>
          <li className="flex gap-2">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <strong>O que não muda:</strong> cargos, empresas e datas continuam os verdadeiros. Currículo não precisa
              listar tudo, mas nunca pode mentir.
            </span>
          </li>
        </ul>

        {ativo && (
          <div className="flex gap-3 rounded-xl border bg-white p-4 text-sm">
            <MessageCircleHeart className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="grid gap-1">
              <p className="font-semibold">Dica para a entrevista</p>
              <p className="text-muted-foreground">
                Prepare uma frase sincera sobre por que você quer esta vaga (estabilidade, horário, perto de casa,
                mudança de área, recomeço). Ex.: “Quero uma rotina mais estável e gosto de atender pessoas; posso
                contribuir com organização e experiência em atendimento.” Isso tira a dúvida do recrutador.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {ativo ? (
            <Button variant="outline" onClick={() => onAlternar(false)}>
              Voltar ao ajuste normal
            </Button>
          ) : (
            <Button onClick={() => onAlternar(true)}>Ajustar para esta vaga</Button>
          )}
          {ativo && (
            <p className="text-sm text-muted-foreground">
              {gerado
                ? "As sugestões de nível aparecem no topo de “Sugestões do Encaixe”. Aplique só as que concordar."
                : "Gere o currículo ajustado abaixo para ver as sugestões de nível."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
