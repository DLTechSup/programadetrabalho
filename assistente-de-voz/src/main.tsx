import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { criarApi } from "./api";
import { ProvedorAssistente } from "./assistente";
import "./styles.css";

(async () => {
  const api = await criarApi();
  const [info, config] = await Promise.all([api.info(), api.obterConfig()]);
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ProvedorAssistente api={api} info={info} configInicial={config}>
        <App />
      </ProvedorAssistente>
    </StrictMode>,
  );
})();
