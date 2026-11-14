import { estruturarCurriculo, tituloExibido } from "@/lib/estrutura-curriculo";
import { ESTILO_PADRAO, type EstiloCurriculo } from "@/lib/estilo";
import { nomeArquivo } from "@/lib/slug";
import { baixarBlob } from "./baixar-arquivo";

const meioPonto = (pt: number) => Math.round(pt * 2);
const twips = (pt: number) => Math.round(pt * 20);
const semCerquilha = (cor: string) => cor.replace("#", "").toUpperCase();

/**
 * Gera um Word (.docx) no estilo do original: mesma fonte (pelo nome), tamanhos,
 * cores e alinhamento. Uma coluna, sem tabelas nem caixas de texto, para o ATS ler.
 */
export async function gerarDocx(curriculo: string, estilo: EstiloCurriculo = ESTILO_PADRAO): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } = await import("docx");

  const alinhamentoNome = estilo.alinhamentoNome === "center" ? AlignmentType.CENTER : AlignmentType.LEFT;
  const paragrafos = estruturarCurriculo(curriculo).map((b) => {
    switch (b.tipo) {
      case "nome":
        return new Paragraph({
          alignment: alinhamentoNome,
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: b.texto,
              bold: estilo.nomeNegrito,
              size: meioPonto(estilo.tamanhoNome),
              color: semCerquilha(estilo.corNome),
            }),
          ],
        });
      case "contato":
        return new Paragraph({ alignment: alinhamentoNome, children: [new TextRun(b.texto)] });
      case "titulo":
        return new Paragraph({
          keepNext: true,
          spacing: { before: 200, after: 80 },
          border: estilo.linhaAbaixoTitulo
            ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: semCerquilha(estilo.corTitulo), space: 1 } }
            : undefined,
          children: [
            new TextRun({
              text: tituloExibido(b.texto, estilo.tituloMaiusculo),
              bold: estilo.tituloNegrito,
              size: meioPonto(estilo.tamanhoTitulo),
              color: semCerquilha(estilo.corTitulo),
            }),
          ],
        });
      case "topico":
        return new Paragraph({ bullet: { level: 0 }, children: [new TextRun(b.texto)] });
      case "paragrafo":
        return new Paragraph({ children: [new TextRun(b.texto)] });
      default:
        return new Paragraph({ spacing: { after: 0 }, children: [] });
    }
  });

  const documento = new Document({
    creator: "Encaixe",
    title: "Currículo",
    styles: {
      default: {
        document: {
          run: {
            font: estilo.fonte,
            size: meioPonto(estilo.tamanhoCorpo),
            color: semCerquilha(estilo.corTexto),
          },
          paragraph: { spacing: { after: 40, line: 276 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: {
              top: twips(estilo.margem),
              bottom: twips(estilo.margem),
              left: twips(estilo.margem),
              right: twips(estilo.margem),
            },
          },
        },
        children: paragrafos,
      },
    ],
  });
  return Packer.toBlob(documento);
}

export async function baixarDocx(curriculo: string, cargo: string, estilo?: EstiloCurriculo): Promise<void> {
  baixarBlob(await gerarDocx(curriculo, estilo), nomeArquivo(cargo, "docx"));
}
