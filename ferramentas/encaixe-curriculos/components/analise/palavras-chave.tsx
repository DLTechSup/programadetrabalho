import { Asterisk } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CATEGORIAS, ROTULO_CATEGORIA, type PalavraChave } from "@/lib/tipos";

function MarcaObrigatorio() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          role="img"
          aria-label="Requisito obrigatório"
          className="inline-flex rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Asterisk className="size-3.5" aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent>Requisito obrigatório</TooltipContent>
    </Tooltip>
  );
}

function ListaPorCategoria({ palavras, tipo }: { palavras: PalavraChave[]; tipo: "encontrada" | "faltando" }) {
  if (palavras.length === 0) {
    return (
      <p className="py-4 text-muted-foreground">
        {tipo === "encontrada"
          ? "Nenhuma palavra-chave da vaga foi encontrada no seu currículo ainda."
          : "Nenhuma palavra-chave faltando. Ótimo!"}
      </p>
    );
  }
  return (
    <div className="grid gap-5 pt-2">
      {CATEGORIAS.map((categoria) => {
        const doGrupo = palavras.filter((p) => p.categoria === categoria);
        if (doGrupo.length === 0) return null;
        return (
          <section key={categoria} aria-label={ROTULO_CATEGORIA[categoria]}>
            <h4 className="mb-2 text-sm font-semibold text-muted-foreground">{ROTULO_CATEGORIA[categoria]}</h4>
            <ul className="flex flex-wrap gap-2">
              {doGrupo.map((p) => (
                <li key={p.termo}>
                  <Badge variant={tipo === "encontrada" ? "success" : "warning"} className="whitespace-normal">
                    {p.termo}
                    {p.obrigatorio && <MarcaObrigatorio />}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function PalavrasChave({ encontradas, faltando }: { encontradas: PalavraChave[]; faltando: PalavraChave[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Palavras-chave da vaga</CardTitle>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <Asterisk className="size-3.5" aria-hidden="true" /> = requisito obrigatório
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={faltando.length > 0 ? "faltando" : "encontradas"}>
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="encontradas">Encontradas ({encontradas.length})</TabsTrigger>
            <TabsTrigger value="faltando">Faltando ({faltando.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="encontradas">
            <ListaPorCategoria palavras={encontradas} tipo="encontrada" />
          </TabsContent>
          <TabsContent value="faltando">
            <ListaPorCategoria palavras={faltando} tipo="faltando" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
