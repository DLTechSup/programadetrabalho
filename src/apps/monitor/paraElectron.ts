// Ponto de entrada só para empacotar a lógica pura do Monitor de Demandas num .cjs que o
// processo principal do Electron consome direto (sem duplicar o código em dois lugares).
// Gerado por "npm run build:electron-logic" (esbuild) -> electron/monitor/logica-pura.cjs.
export * from "./referencia";
export * from "./marcas";
export * from "./legenda";
export * from "./regrasRef";
export * from "./armazenamento";
export * from "./mensagem";
export * from "./notificacao";
