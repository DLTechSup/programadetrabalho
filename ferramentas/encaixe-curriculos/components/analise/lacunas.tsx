"use client";

import { Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { slugificar } from "@/lib/slug";
import type { PalavraChave } from "@/lib/tipos";

export interface RespostaLacuna {
  resposta?: "sim" | "nao";
  descricao: string;
}

interface Props {
  faltando: PalavraChave[];
  respostas: Record<string, RespostaLacuna>;
  onResponder: (termo: string, r: RespostaLacuna) => void;
  gerando: boolean;
  onGerar: () => void;
}

export function Lacunas({ faltando, respostas, onResponder, gerando, onGerar }: Props) {
  return (
    <section aria-labelledby="titulo-lacunas" className="grid gap-4">
      <div>
        <h3 id="titulo-lacunas" className="text-xl font-semibold">
          Confirme o que você tem
        </h3>
        <p className="mt-1 text-muted-foreground">
          {faltando.length > 0
            ? "Só incluímos um termo que falta se você disser que tem e contar onde usou. Responder é opcional."
            : "Seu currículo já cita todas as palavras-chave da vaga. Ainda assim, podemos organizá-lo no formato ATS."}
        </p>
      </div>

      {faltando.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {faltando.map((p) => {
            const id = `lacuna-${slugificar(p.termo) || "termo"}`;
            const atual = respostas[p.termo] ?? { descricao: "" };
            return (
              <li key={p.termo}>
                <Card className="h-full gap-3 bg-muted py-5 shadow-none">
                  <CardHeader className="px-5">
                    <CardTitle id={`${id}-pergunta`} className="text-base font-normal">
                      Você tem experiência com <strong className="font-semibold">{p.termo}</strong>?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 px-5">
                    <RadioGroup
                      aria-labelledby={`${id}-pergunta`}
                      value={atual.resposta ?? ""}
                      onValueChange={(v) => onResponder(p.termo, { ...atual, resposta: v as "sim" | "nao" })}
                      className="flex gap-6"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="sim" id={`${id}-sim`} />
                        <Label htmlFor={`${id}-sim`} className="text-base font-normal">Sim</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="nao" id={`${id}-nao`} />
                        <Label htmlFor={`${id}-nao`} className="text-base font-normal">Não</Label>
                      </div>
                    </RadioGroup>
                    {atual.resposta === "sim" && (
                      <div className="grid gap-1.5">
                        <Label htmlFor={`${id}-descricao`}>Onde e como?</Label>
                        <Textarea
                          id={`${id}-descricao`}
                          value={atual.descricao}
                          onChange={(e) => onResponder(p.termo, { ...atual, descricao: e.target.value })}
                          placeholder="Ex.: empresa, projeto, curso"
                          className="min-h-20"
                          aria-describedby={`${id}-ajuda`}
                        />
                        <p id={`${id}-ajuda`} className="text-xs text-muted-foreground">
                          {atual.descricao.trim()
                            ? "Vamos usar só o que você escreveu aqui."
                            : "Sem descrição, o termo não entra no currículo."}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Button size="lg" onClick={onGerar} disabled={gerando} className="w-full sm:w-fit">
        {gerando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Wand2 aria-hidden="true" />}
        {gerando ? "Gerando…" : "Gerar currículo ajustado"}
      </Button>
    </section>
  );
}
