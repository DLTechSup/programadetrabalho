"use client";

import { useMemo } from "react";
import { CheckCircle2, CircleAlert, Lightbulb } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { avaliarDicas } from "@/lib/dicas";
import type { PalavraChave } from "@/lib/tipos";

interface Props {
  texto: string;
  palavras: PalavraChave[];
  ajustado: boolean;
}

/** Checklist de melhorias, recalculado a cada edição do texto. */
export function Dicas({ texto, palavras, ajustado }: Props) {
  const resultados = useMemo(() => avaliarDicas({ texto, palavras }), [texto, palavras]);
  const avisos = resultados
    .filter((r) => r.aviso)
    .sort((a, b) => Number(b.aviso!.nivel === "importante") - Number(a.aviso!.nivel === "importante"));
  const ok = resultados.filter((r) => !r.aviso);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Dicas para melhorar seu currículo</CardTitle>
        <p className="text-sm text-muted-foreground">
          {ajustado ? "Avaliamos a versão ajustada. " : "Avaliamos o currículo que você enviou. "}
          {ok.length} de {resultados.length} itens já estão bons.
          {ajustado && " Edite o texto acima e a lista se atualiza sozinha."}
        </p>
      </CardHeader>
      <CardContent className="grid gap-3">
        {avisos.length === 0 && (
          <p className="flex items-center gap-2 text-success-foreground">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Tudo certo por aqui. Ótimo trabalho!
          </p>
        )}
        <ul className="grid gap-3">
          {avisos.map(({ id, nome, aviso }) => (
            <li key={id} className="rounded-lg border bg-muted/60 p-4">
              <p className="flex items-center gap-2 font-medium">
                {aviso!.nivel === "importante" ? (
                  <CircleAlert className="size-4 shrink-0 text-warning-foreground" aria-hidden="true" />
                ) : (
                  <Lightbulb className="size-4 shrink-0 text-primary" aria-hidden="true" />
                )}
                {nome}
                <span className="sr-only">{aviso!.nivel === "importante" ? "(importante)" : "(sugestão)"}</span>
                {aviso!.nivel === "importante" && (
                  <span aria-hidden="true" className="rounded-md border border-warning px-1.5 text-xs text-warning-foreground">
                    importante
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{aviso!.mensagem}</p>
              {aviso!.trechos && aviso!.trechos.length > 0 && (
                <ul className="mt-2 grid gap-1 text-sm">
                  {aviso!.trechos.map((t) => (
                    <li key={t} className="border-l-2 border-warning/60 pl-2 break-words">
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        {ok.length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="ok" className="border-b-0">
              <AccordionTrigger>O que já está bom ({ok.length})</AccordionTrigger>
              <AccordionContent>
                <ul className="grid gap-1.5">
                  {ok.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="size-4 shrink-0 text-success-foreground" aria-hidden="true" />
                      {r.nome}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
