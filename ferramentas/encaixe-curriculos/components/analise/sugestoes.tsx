"use client";

import { useMemo, useState } from "react";
import { Check, CheckCheck, Lightbulb, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORIA_NIVEL, aplicarSugestao, aplicarTodas, gerarSugestoes, type Sugestao } from "@/lib/sugestoes";
import { cn } from "@/lib/utils";
import type { PalavraChave } from "@/lib/tipos";

interface Props {
  texto: string;
  palavras: PalavraChave[];
  cargo: string;
  nivelEntrada: boolean;
  proibidos: PalavraChave[];
  onAplicar: (novoTexto: string, descricao: string) => void;
}

function Previa({ sugestao }: { sugestao: Sugestao }) {
  return (
    <div className="grid gap-1.5 text-sm">
      {sugestao.trocas.slice(0, 3).map((t) => (
        <div key={t.linha} className="grid gap-1 rounded-md border bg-white p-2.5">
          <p className="text-destructive/90 line-through decoration-destructive/60">
            <span className="sr-only">Antes: </span>
            {t.linha.replace(/^-\s+/, "")}
          </p>
          {t.nova !== null && (
            <p className="text-success-foreground">
              <span className="sr-only">Depois: </span>
              {t.nova.split("\n").pop()!.replace(/^-\s+/, "")}
            </p>
          )}
        </div>
      ))}
      {sugestao.trocas.length > 3 && <p className="text-muted-foreground">e mais {sugestao.trocas.length - 3} linha(s)</p>}
    </div>
  );
}

/** Sugestões comentadas: "Eu faria… porque…", com aplicar ou ignorar. */
export function Sugestoes({ texto, palavras, cargo, nivelEntrada, proibidos, onAplicar }: Props) {
  const [ignoradas, setIgnoradas] = useState<Set<string>>(new Set());
  const todas = useMemo(
    () => gerarSugestoes({ texto, palavras, cargo, nivelEntrada, proibidos }),
    [texto, palavras, cargo, nivelEntrada, proibidos]
  );
  const visiveis = todas.filter((s) => !ignoradas.has(s.id));
  const deNivel = visiveis.filter((s) => s.categoria === CATEGORIA_NIVEL);

  return (
    <Card id="sugestoes" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="size-5 text-primary" aria-hidden="true" />
          Sugestões do Encaixe
          {visiveis.length > 0 && <Badge variant="secondary">{visiveis.length}</Badge>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          O que eu mudaria no seu currículo para ele ficar mais atraente para a vaga, e por quê. Você decide:
          aplique só o que concordar. Nada é inventado, só reescrito.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4">
        {visiveis.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg bg-muted p-4 text-sm">
            <Check className="size-4 text-success-foreground" aria-hidden="true" />
            Sem sugestões pendentes. Veja também a revisão de ortografia e as dicas abaixo.
          </p>
        ) : (
          <>
            {deNivel.length > 1 && (
              <Button
                className="justify-self-start"
                onClick={() => onAplicar(aplicarTodas(texto, deNivel), `${deNivel.length} ajustes para a vaga de nível mais simples`)}
              >
                <CheckCheck aria-hidden="true" />
                Aplicar ajustes de nível ({deNivel.length})
              </Button>
            )}
            {visiveis.length > 1 && (
              <Button
                variant="outline"
                className="justify-self-start"
                onClick={() => onAplicar(aplicarTodas(texto, visiveis), `${visiveis.length} sugestões aplicadas`)}
              >
                <CheckCheck aria-hidden="true" />
                Aplicar todas ({visiveis.length})
              </Button>
            )}
            <ul className="grid gap-3">
              {visiveis.map((s) => (
                <li
                  key={s.id}
                  className={cn(
                    "grid gap-3 rounded-xl border p-4",
                    s.categoria === CATEGORIA_NIVEL ? "border-primary/30 bg-accent/30" : "bg-muted/50"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Lightbulb className="size-4 text-primary" aria-hidden="true" />
                    <h4 className="font-semibold">{s.titulo}</h4>
                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                      {s.categoria}
                    </Badge>
                  </div>
                  <dl className="grid gap-2 text-sm">
                    <div>
                      <dt className="font-semibold text-foreground">Eu faria:</dt>
                      <dd className="text-muted-foreground">{s.euFaria}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-foreground">Porque:</dt>
                      <dd className="text-muted-foreground">{s.porque}</dd>
                    </div>
                  </dl>
                  <Previa sugestao={s} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => onAplicar(aplicarSugestao(texto, s), s.titulo)}>
                      <Check aria-hidden="true" />
                      Concordo, aplicar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIgnoradas((atual) => new Set(atual).add(s.id))}
                    >
                      <X aria-hidden="true" />
                      Ignorar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
