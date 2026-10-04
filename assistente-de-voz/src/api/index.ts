import type { Api } from "./types";
import { criarApiDemo } from "./demo";

declare global {
  interface Window {
    api?: Omit<Api, "demo">;
  }
}

/** No programa instalado usa o motor real; no navegador (desenvolvimento) usa uma demonstração. */
export async function criarApi(): Promise<Api> {
  if (window.api) return { ...window.api, demo: false } as Api;
  return criarApiDemo();
}
