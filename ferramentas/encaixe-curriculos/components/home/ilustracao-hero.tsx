import { Check, Lightbulb, SpellCheck, X } from "lucide-react";

/** Anel de progresso do score. */
function Anel({ valor }: { valor: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="size-28" aria-hidden="true">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e7e5e4" strokeWidth="10" />
      <circle
        cx="50" cy="50" r={r} fill="none" stroke="url(#anel-encaixe)" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${(valor / 100) * c} ${c}`} transform="rotate(-90 50 50)"
      />
      <defs>
        <linearGradient id="anel-encaixe" x1="0" x2="1">
          <stop offset="0" stopColor="#0f766e" />
          <stop offset="1" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight="700" fill="#1c1917">
        {valor}%
      </text>
    </svg>
  );
}

/** Ilustração do resultado (decorativa), feita com HTML e CSS. */
export function IlustracaoHero() {
  return (
    <div className="relative mx-auto w-full max-w-md select-none" aria-hidden="true">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-accent via-white to-teal-50 blur-2xl" />
      <div className="sombra-suave rounded-2xl border bg-white p-5">
        <div className="flex items-center gap-4">
          <Anel valor={81} />
          <div>
            <p className="text-sm text-muted-foreground">Encaixe com a vaga</p>
            <p className="text-lg font-bold">Alto encaixe</p>
            <p className="mt-1 text-sm">
              <span className="text-muted-foreground line-through">62%</span>{" "}
              <span className="font-semibold text-success-foreground">→ 81%</span>
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
          {["SQL", "Power BI", "Análise de dados", "Excel"].map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-1 font-medium text-success-foreground">
              <Check className="size-3" /> {t}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 rounded-md border border-warning px-2 py-1 font-medium text-warning-foreground">
            <X className="size-3" /> Python
          </span>
        </div>
        <div className="mt-4 space-y-1.5 rounded-xl bg-muted p-3 text-xs leading-relaxed">
          <p className="font-bold tracking-wide text-primary">EXPERIÊNCIA</p>
          <p>Analista de Dados | Empresa X | 2021 – atual</p>
          <p>
            - <del className="rounded-sm bg-destructive/10 text-destructive/80">Responsável pela elaboração de</del>{" "}
            <ins className="rounded-sm bg-success/20 text-success-foreground no-underline">Elaborei</ins> relatórios em{" "}
            <ins className="rounded-sm bg-success/20 text-success-foreground no-underline">Power BI</ins>
          </p>
        </div>
      </div>

      <div className="flutuar sombra-suave absolute -right-3 -bottom-20 w-60 rounded-xl border bg-white p-3 text-xs sm:-right-10">
        <p className="flex items-center gap-1.5 font-semibold">
          <Lightbulb className="size-3.5 text-primary" /> Sugestão do Encaixe
        </p>
        <p className="mt-1 text-muted-foreground">
          <strong className="text-foreground">Eu faria:</strong> começar com um verbo de ação.{" "}
          <strong className="text-foreground">Porque:</strong> o recrutador lê só o início de cada tópico.
        </p>
      </div>
      <div className="flutuar sombra-suave absolute -top-6 -left-3 rounded-xl border bg-white px-3 py-2 text-xs [animation-delay:1.5s] sm:-left-10">
        <p className="flex items-center gap-1.5 font-semibold">
          <SpellCheck className="size-3.5 text-primary" /> 3 erros de português corrigidos
        </p>
      </div>
    </div>
  );
}
