"use client";

import { useMemo, useState } from "react";
import { compararCurriculos, type LinhaComparada } from "@/lib/diff";
import { secaoDoTitulo } from "@/lib/reescrever-curriculo";
import { cn } from "@/lib/utils";

interface Props {
  original: string;
  atual: string;
}

const ehTitulo = (l: string) => !!secaoDoTitulo(l) || /^(RESUMO PROFISSIONAL|EXPERIÊNCIA|FORMAÇÃO|HABILIDADES|CERTIFICAÇÕES E IDIOMAS)$/.test(l);

function LinhaAjustada({ l }: { l: LinhaComparada }) {
  if (l.tipo === "vazia") return <div className="h-3" aria-hidden="true" />;
  if (l.tipo === "titulo") return <p className="mt-2 text-xs font-bold tracking-wider text-primary uppercase">{l.texto}</p>;
  if (l.tipo === "igual") return <p>{l.texto}</p>;
  if (l.tipo === "nova") {
    return (
      <p className="rounded-sm bg-success/10 px-1 -mx-1 shadow-[inset_3px_0_0_var(--success)]">
        <span className="sr-only">Novo: </span>
        {l.texto}
      </p>
    );
  }
  if (l.reescrita) {
    return (
      <div className="rounded-sm bg-amber-50 px-1 -mx-1 shadow-[inset_3px_0_0_var(--warning)]">
        <p className="text-destructive/80 line-through">
          <span className="sr-only">Antes: </span>
          {l.antes}
        </p>
        <p className="text-success-foreground">
          <span className="sr-only">Depois: </span>
          {l.texto}
        </p>
      </div>
    );
  }
  return (
    <p className="rounded-sm bg-amber-50 px-1 -mx-1 shadow-[inset_3px_0_0_var(--warning)]">
      <span className="sr-only">Alterado: </span>
      {l.texto.match(/^\s*-\s+/)?.[0]}
      {l.pedacos!.map((p, i) =>
        p.tipo === "igual" ? (
          <span key={i}>{p.texto}</span>
        ) : p.tipo === "novo" ? (
          <ins key={i} className="rounded-sm bg-success/20 text-success-foreground no-underline">
            {p.texto}
          </ins>
        ) : (
          <del key={i} className="rounded-sm bg-destructive/10 text-destructive/80">
            {p.texto}
          </del>
        )
      )}
    </p>
  );
}

/** Visualizador: como estava × como ficou, marcando o que mudou. */
export function Comparador({ original, atual }: Props) {
  const [modo, setModo] = useState<"lado" | "mudancas">("lado");
  const comparacao = useMemo(() => compararCurriculos(original, atual, ehTitulo), [original, atual]);
  const { alteradas, novas, removidas } = comparacao.resumo;
  const mudancas = comparacao.linhas.filter((l) => l.tipo === "alterada" || l.tipo === "nova");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <strong className="text-foreground">{alteradas}</strong> linha(s) alterada(s),{" "}
          <strong className="text-foreground">{novas}</strong> nova(s) e{" "}
          <strong className="text-foreground">{removidas}</strong> removida(s).
        </p>
        <div role="radiogroup" aria-label="Modo de visualização" className="inline-flex rounded-lg bg-muted p-1 text-sm">
          {(
            [
              ["lado", "Lado a lado"],
              ["mudancas", "Só as mudanças"],
            ] as const
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              role="radio"
              aria-checked={modo === valor}
              onClick={() => setModo(valor)}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50",
                modo === valor ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-success/30" aria-hidden="true" /> Novo ou trocado</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-destructive/20" aria-hidden="true" /> Removido</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-amber-200" aria-hidden="true" /> Linha alterada</li>
      </ul>

      {modo === "lado" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section aria-label="Como estava" className="grid content-start gap-2">
            <h4 className="text-sm font-semibold text-muted-foreground">Como estava</h4>
            <div tabIndex={0} className="max-h-[40rem] overflow-auto rounded-xl border bg-white p-5 text-sm leading-relaxed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              {original.split("\n").map((linha, i) => {
                const removida = comparacao.removidas.includes(linha.trim());
                return linha.trim() ? (
                  <p key={i} className={cn(removida && "rounded-sm bg-destructive/10 px-1 -mx-1 text-destructive/80 line-through")}>
                    {removida && <span className="sr-only">Removido: </span>}
                    {linha}
                  </p>
                ) : (
                  <div key={i} className="h-3" aria-hidden="true" />
                );
              })}
            </div>
          </section>
          <section aria-label="Como ficou" className="grid content-start gap-2">
            <h4 className="text-sm font-semibold text-primary">Como ficou</h4>
            <div tabIndex={0} className="max-h-[40rem] overflow-auto rounded-xl border border-primary/30 bg-white p-5 text-sm leading-relaxed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              {comparacao.linhas.map((l, i) => (
                <LinhaAjustada key={i} l={l} />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <ul className="grid gap-2">
          {mudancas.map((l, i) => (
            <li key={i} className="grid gap-1 rounded-xl border bg-white p-4 text-sm">
              {l.tipo === "alterada" ? (
                <>
                  <p className="text-xs font-semibold text-warning-foreground uppercase">Alterado</p>
                  <p className="text-muted-foreground line-through">{l.antes}</p>
                  <LinhaAjustada l={l} />
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold text-success-foreground uppercase">Novo</p>
                  <p>{l.texto}</p>
                </>
              )}
            </li>
          ))}
          {comparacao.removidas.map((r) => (
            <li key={`r-${r}`} className="grid gap-1 rounded-xl border bg-white p-4 text-sm">
              <p className="text-xs font-semibold text-destructive uppercase">Removido</p>
              <p className="text-destructive/80 line-through">{r}</p>
            </li>
          ))}
          {mudancas.length + comparacao.removidas.length === 0 && (
            <li className="text-sm text-muted-foreground">Nenhuma mudança em relação ao original.</li>
          )}
        </ul>
      )}
    </div>
  );
}
