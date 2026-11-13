import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import NoteWindow from "./apps/notedeck/NoteWindow.jsx";
import Shell from "./Shell";
import "./styles.css";

// Cada nota do NoteDeck é a sua própria janela (BrowserWindow), carregando este mesmo
// pacote com #/note/<id> na URL -- só ela usa esse hash; a Central inteira usa o resto.
const notaId = window.location.hash.match(/^#\/note\/(.+)$/)?.[1];
if (notaId) document.body.dataset.view = "note";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {notaId ? <NoteWindow id={notaId} /> : <Shell />}
  </StrictMode>,
);
