// Códigos das Fotos: continua sendo o mesmo site (HTML + Supabase) de sempre, só que
// embutido aqui dentro como uma aba, em vez de aberto separado no navegador.
export function CodigosFotosView() {
  return (
    <iframe
      src="./codigodasfotos/index.html"
      title="Códigos das Fotos"
      style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
    />
  );
}
