import { estruturarCurriculo, textoSeguroParaPdf, tituloExibido } from "@/lib/estrutura-curriculo";
import { ESTILO_PADRAO, fontePadraoPdf, pacoteFonteEquivalente, type EstiloCurriculo } from "@/lib/estilo";
import { nomeArquivo } from "@/lib/slug";
import { baixarBlob } from "./baixar-arquivo";

const FAMILIA_ORIGINAL = "FonteDoOriginal";
const fontesRegistradas = new Set<string>();

type ReactPdf = typeof import("@react-pdf/renderer");

/** Registra a fonte gratuita equivalente à do original (ex.: Calibri -> Carlito). */
function registrarFonte(Font: ReactPdf["Font"], pacote: string) {
  const familia = `${FAMILIA_ORIGINAL}-${pacote}`;
  if (!fontesRegistradas.has(pacote)) {
    const base = `https://cdn.jsdelivr.net/npm/@fontsource/${pacote}@5/files/${pacote}-latin`;
    Font.register({
      family: familia,
      fonts: [
        { src: `${base}-400-normal.woff`, fontWeight: 400 },
        { src: `${base}-700-normal.woff`, fontWeight: 700 },
      ],
    });
    fontesRegistradas.add(pacote);
  }
  return familia;
}

/**
 * Gera o PDF no navegador com @react-pdf/renderer, no estilo do currículo original.
 * Sempre uma coluna, texto selecionável, sem tabelas, ícones ou imagens.
 */
export async function gerarPdf(curriculo: string, estilo: EstiloCurriculo = ESTILO_PADRAO): Promise<Blob> {
  const reactPdf = await import("@react-pdf/renderer");
  const { pdf, Document, Page, Text, View, StyleSheet, Font } = reactPdf;
  Font.registerHyphenationCallback((palavra) => [palavra]);

  const pacote = estilo.origem === "padrao" ? null : pacoteFonteEquivalente(estilo.fonte);
  const padrao = fontePadraoPdf(estilo.familia);

  const montar = (fonte: { normal: string; negrito: string; peso: boolean }) => {
    const negrito = (ativo: boolean) =>
      fonte.peso
        ? { fontFamily: fonte.normal, fontWeight: ativo ? 700 : 400 }
        : { fontFamily: ativo ? fonte.negrito : fonte.normal };

    const estilos = StyleSheet.create({
      pagina: {
        padding: estilo.margem,
        ...negrito(false),
        fontSize: estilo.tamanhoCorpo,
        lineHeight: 1.4,
        color: estilo.corTexto,
      },
      nome: {
        ...negrito(estilo.nomeNegrito),
        fontSize: estilo.tamanhoNome,
        color: estilo.corNome,
        textAlign: estilo.alinhamentoNome,
        // Altura de linha própria: senão herda a da página, calculada para o corpo do texto.
        lineHeight: 1.25,
        marginBottom: 4,
      },
      contato: { fontSize: estilo.tamanhoCorpo, textAlign: estilo.alinhamentoNome },
      titulo: {
        ...negrito(estilo.tituloNegrito),
        fontSize: estilo.tamanhoTitulo,
        color: estilo.corTitulo,
        lineHeight: 1.3,
        marginTop: 10,
        marginBottom: 4,
        ...(estilo.linhaAbaixoTitulo
          ? { borderBottomWidth: 0.75, borderBottomColor: estilo.corTitulo, paddingBottom: 2 }
          : {}),
      },
      topico: { flexDirection: "row", marginBottom: 1 },
      marcador: { width: 10 },
      textoTopico: { flex: 1 },
      paragrafo: { marginBottom: 1 },
      espaco: { height: 4 },
    });

    const blocos = estruturarCurriculo(textoSeguroParaPdf(curriculo));
    return (
      <Document title="Currículo" language="pt-BR" creator="Encaixe" producer="Encaixe">
        <Page size="A4" style={estilos.pagina}>
          {blocos.map((b, i) => {
            switch (b.tipo) {
              case "nome":
                return (
                  <Text key={i} style={estilos.nome}>
                    {estilo.origem === "padrao" ? b.texto.toUpperCase() : b.texto}
                  </Text>
                );
              case "contato":
                return <Text key={i} style={estilos.contato}>{b.texto}</Text>;
              case "titulo":
                return (
                  <Text key={i} style={estilos.titulo} minPresenceAhead={30}>
                    {tituloExibido(b.texto, estilo.tituloMaiusculo)}
                  </Text>
                );
              case "topico":
                return (
                  <View key={i} style={estilos.topico} wrap={false}>
                    <Text style={estilos.marcador}>-</Text>
                    <Text style={estilos.textoTopico}>{b.texto}</Text>
                  </View>
                );
              case "paragrafo":
                return <Text key={i} style={estilos.paragrafo}>{b.texto}</Text>;
              default:
                return <View key={i} style={estilos.espaco} />;
            }
          })}
        </Page>
      </Document>
    );
  };

  if (pacote) {
    try {
      const familia = registrarFonte(Font, pacote);
      return await pdf(montar({ normal: familia, negrito: familia, peso: true })).toBlob();
    } catch (e) {
      // Sem internet ou fonte indisponível: usa a fonte padrão da mesma família.
      console.warn("Fonte equivalente indisponível, usando a padrão", e);
    }
  }
  return pdf(montar({ ...padrao, peso: false })).toBlob();
}

export async function baixarPdf(curriculo: string, cargo: string, estilo?: EstiloCurriculo): Promise<void> {
  baixarBlob(await gerarPdf(curriculo, estilo), nomeArquivo(cargo, "pdf"));
}
