"use client";

import { useEffect, useMemo, useState } from "react";
import { BookCheck, Check, Loader2, SpellCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { carregarVerificador, corrigirNoTexto, revisarTexto, type Problema } from "@/lib/ortografia";
import type { VerificadorHunspell } from "@/lib/ortografia/hunspell";

interface Props {
  texto: string;
  /** Termos que não devem ser tratados como erro (ex.: palavras da vaga). */
  extras: string[];
  /** Sem esta função, só mostra os problemas (sem botão de corrigir). */
  onCorrigir?: (novoTexto: string, descricao: string) => void;
}

function Contexto({ problema }: { problema: Problema }) {
  const i = problema.contexto.indexOf(problema.trecho);
  if (i === -1) return <span>{problema.contexto}</span>;
  const antes = problema.contexto.slice(Math.max(0, i - 50), i);
  const depois = problema.contexto.slice(i + problema.trecho.length, i + problema.trecho.length + 50);
  return (
    <span>
      {i > 50 && "…"}
      {antes}
      <mark className="rounded-sm bg-destructive/10 text-destructive underline decoration-wavy decoration-destructive/70 underline-offset-4">
        {problema.trecho}
      </mark>
      {depois}
      {i + problema.trecho.length + 50 < problema.contexto.length && "…"}
    </span>
  );
}

/** Revisão de ortografia e escrita, com correção em um clique. */
export function RevisaoOrtografica({ texto, extras, onCorrigir }: Props) {
  const [verificador, setVerificador] = useState<VerificadorHunspell | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [ignorados, setIgnorados] = useState<Set<string>>(new Set());

  useEffect(() => {
    let ativo = true;
    carregarVerificador()
      .then((v) => ativo && setVerificador(v))
      .catch(() => ativo && setFalhou(true));
    return () => {
      ativo = false;
    };
  }, []);

  const revisao = useMemo(
    () => (verificador ? revisarTexto(texto, verificador, extras) : null),
    [verificador, texto, extras]
  );
  const problemas = (revisao?.problemas ?? []).filter((p) => !ignorados.has(p.id));
  const ortografia = problemas.filter((p) => p.tipo === "ortografia");
  const escrita = problemas.filter((p) => p.tipo === "escrita");
  const totalOcorrencias = ortografia.reduce((s, p) => s + p.ocorrencias, 0);

  return (
    <Card id="ortografia" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <SpellCheck className="size-5 text-primary" aria-hidden="true" />
          Ortografia e escrita
          {revisao && problemas.length > 0 && <Badge variant="warning">{problemas.length}</Badge>}
        </CardTitle>
        <div aria-live="polite" className="text-sm text-muted-foreground">
          {!revisao && !falhou && (
            <p className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Carregando o dicionário de português…
            </p>
          )}
          {falhou && <p>Não foi possível carregar o dicionário agora. Verifique sua conexão e recarregue a página.</p>}
          {revisao &&
            (problemas.length === 0 ? (
              <p className="flex items-center gap-2 text-success-foreground">
                <BookCheck className="size-4" aria-hidden="true" />
                Nenhum erro encontrado em {revisao.palavrasVerificadas} palavras. Muito bem!
              </p>
            ) : (
              <p>
                Encontramos <strong className="text-foreground">{ortografia.length} palavra(s) possivelmente errada(s)</strong>
                {totalOcorrencias > ortografia.length && ` (${totalOcorrencias} ocorrências)`} e{" "}
                <strong className="text-foreground">{escrita.length} ajuste(s) de escrita</strong> (concordância, crase,
                conjunções como “mas” e “mais”) em {revisao.palavrasVerificadas} palavras. Erros de português estão entre os
                motivos mais comuns para um currículo ser descartado.
              </p>
            ))}
        </div>
      </CardHeader>
      {problemas.length > 0 && (
        <CardContent>
          <ul className="grid gap-2.5">
            {[...ortografia, ...escrita].map((p) => (
              <li key={p.id} className="grid gap-2 rounded-xl border bg-muted/50 p-3.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={p.tipo === "ortografia" ? "warning" : "outline"}>
                    {p.tipo === "ortografia" ? "Ortografia" : "Escrita"}
                  </Badge>
                  <span className="font-semibold">“{p.trecho}”</span>
                  {p.ocorrencias > 1 && <span className="text-muted-foreground">aparece {p.ocorrencias} vezes</span>}
                </div>
                <p className="text-muted-foreground">
                  <Contexto problema={p} />
                </p>
                <p className="text-xs text-muted-foreground">{p.explicacao}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {p.sugestoes.length === 0 && <span className="text-muted-foreground">Sem sugestão automática.</span>}
                  {p.sugestoes.map((s) =>
                    onCorrigir ? (
                      <Button
                        key={s}
                        size="sm"
                        variant="outline"
                        onClick={() => onCorrigir(corrigirNoTexto(texto, p.trecho, s), `“${p.trecho}” corrigido para “${s}”`)}
                      >
                        <Check aria-hidden="true" />
                        Trocar por “{s}”
                      </Button>
                    ) : (
                      <Badge key={s} variant="success">
                        {s}
                      </Badge>
                    )
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setIgnorados((a) => new Set(a).add(p.id))}>
                    <X aria-hidden="true" />
                    Está certo, ignorar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
