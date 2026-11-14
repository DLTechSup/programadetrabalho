import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { faixaDoScore } from "@/lib/score";
import { cn } from "@/lib/utils";

const CORES = {
  baixo: { texto: "text-warning-foreground", barra: "bg-warning" },
  medio: { texto: "text-primary", barra: "bg-primary" },
  alto: { texto: "text-success-foreground", barra: "bg-success" },
};

export function PainelScore({ score, cargo }: { score: number; cargo: string }) {
  const faixa = faixaDoScore(score);
  const cor = CORES[faixa.nivel];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Seu encaixe com a vaga</CardTitle>
        <p className="text-sm text-muted-foreground">{cargo}</p>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex items-end gap-3">
          <span className={cn("text-6xl font-bold tabular-nums leading-none", cor.texto)}>{score}%</span>
          <span className={cn("pb-1 text-lg font-semibold", cor.texto)}>{faixa.rotulo}</span>
        </div>
        <Progress
          value={score}
          indicatorClassName={cor.barra}
          aria-label={`Encaixe de ${score}%: ${faixa.rotulo}`}
        />
        <p className="text-sm text-muted-foreground">
          Requisitos obrigatórios pesam 3x mais que os desejáveis.
        </p>
      </CardContent>
    </Card>
  );
}
