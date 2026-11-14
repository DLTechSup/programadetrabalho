import { estruturarCurriculo, tituloExibido } from "@/lib/estrutura-curriculo";
import { ESTILO_PADRAO, type EstiloCurriculo } from "@/lib/estilo";

const FAMILIA_CSS = { sans: "Arial, Helvetica, sans-serif", serif: "'Times New Roman', Georgia, serif", mono: "'Courier New', monospace" };

/** Prévia em "folha de papel" do currículo, com o estilo do arquivo original. */
export function PreviaDocumento({ texto, estilo }: { texto: string; estilo: EstiloCurriculo | null }) {
  const e = estilo ?? ESTILO_PADRAO;
  const pt = (v: number) => `${(v / 10.5).toFixed(3)}rem`;
  const blocos = estruturarCurriculo(texto);
  return (
    <div className="overflow-auto rounded-xl bg-stone-200/70 p-3 sm:p-6">
      <article
        aria-label="Prévia do currículo"
        className="mx-auto max-w-[210mm] bg-white text-black shadow-lg"
        style={{
          fontFamily: `'${e.fonte}', ${FAMILIA_CSS[e.familia]}`,
          fontSize: pt(e.tamanhoCorpo),
          color: e.corTexto,
          padding: `clamp(1.25rem, ${(e.margem / 72).toFixed(2)}in, 3rem)`,
          lineHeight: 1.45,
          minHeight: "20rem",
        }}
      >
        {blocos.map((b, i) => {
          switch (b.tipo) {
            case "nome":
              return (
                <h4
                  key={i}
                  style={{
                    fontSize: pt(e.tamanhoNome),
                    color: e.corNome,
                    fontWeight: e.nomeNegrito ? 700 : 400,
                    textAlign: e.alinhamentoNome,
                    lineHeight: 1.2,
                  }}
                >
                  {estilo ? b.texto : b.texto.toUpperCase()}
                </h4>
              );
            case "contato":
              return (
                <p key={i} style={{ textAlign: e.alinhamentoNome }}>
                  {b.texto}
                </p>
              );
            case "titulo":
              return (
                <h5
                  key={i}
                  style={{
                    fontSize: pt(e.tamanhoTitulo),
                    color: e.corTitulo,
                    fontWeight: e.tituloNegrito ? 700 : 400,
                    marginTop: "0.9em",
                    marginBottom: "0.3em",
                    borderBottom: e.linhaAbaixoTitulo ? `1px solid ${e.corTitulo}` : undefined,
                  }}
                >
                  {tituloExibido(b.texto, e.tituloMaiusculo)}
                </h5>
              );
            case "topico":
              return (
                <p key={i} className="flex gap-2">
                  <span aria-hidden="true">-</span>
                  <span>{b.texto}</span>
                </p>
              );
            case "paragrafo":
              return <p key={i}>{b.texto}</p>;
            default:
              return <div key={i} className="h-2" aria-hidden="true" />;
          }
        })}
      </article>
    </div>
  );
}
