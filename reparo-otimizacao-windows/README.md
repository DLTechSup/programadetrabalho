# Reparo e Otimização do Windows

Programa de desktop (React + TypeScript + Electron) para o técnico resolver, em um só lugar, os problemas
mais comuns de um computador Windows: **disco cheio**, **lentidão**, **pouca memória**, **pastas que demoram a abrir**
e **sites que demoram a carregar**.

> É um programa **separado** do GradeFácil (pasta raiz do repositório): tem o próprio `package.json`, build e executável.

## O que ele faz

| Tela | Para quê |
|---|---|
| **Visão geral** | Analisa o computador e lista os **problemas encontrados**, cada um com caixa de seleção e a correção que será aplicada. Botões **Resolver selecionados** e **Resolver tudo**. Mostra nota de saúde, disco, RAM, CPU e tempo ligado. |
| **Espaço em disco** | **Escaneia o C: inteiro** e mostra: *O que posso apagar* (limpeza segura com tamanho de cada item), *O que mais ocupa* (árvore de pastas com barras e avisos do que é do sistema), *Maiores arquivos* (com sugestão — vão para a Lixeira, nunca apaga direto) e *Por tipo* (vídeos, instaladores, ISOs…). |
| **Otimização e reparo** | Escolha o sintoma do cliente — *computador lento, pastas demoram a abrir, sites demoram a abrir, pouca memória, disco cheio, erros do Windows* — e o programa já marca o que costuma resolver. Dá para ajustar item por item. |
| **Memória** | RAM em tempo real, programas que mais consomem, **Encerrar** programa (processos do sistema são protegidos) e **Liberar memória agora**. |
| **Inicialização** | Liga/desliga os programas que abrem junto com o Windows (reversível; antivírus e drivers vêm marcados como *essenciais*). |
| **Internet** | Mede a velocidade do DNS (principal causa de “sites lentos” com internet boa), a latência, e aplica a correção. |

### Limpeza (todas medidas antes, você escolhe o que apagar)
Temporários (usuários e Windows), cache de Chrome/Edge/Firefox/Brave, cache de Teams/Discord/Slack/Spotify, miniaturas,
cache de shaders, relatórios e dumps de erro, logs do CBS/DISM, download do Windows Update, cache da Otimização de Entrega, Lixeira,
componentes antigos do Windows (DISM), e — **desmarcados por padrão, risco alto** — `Windows.old` e `hiberfil.sys`.
Documentos, fotos, vídeos e e-mails do cliente **nunca** são tocados pela limpeza automática.

### Otimização e reparo
Plano de energia Alto desempenho · reduzir efeitos visuais · bloquear apps em segundo plano · desativar telemetria (DiagTrack) ·
SysMain em HD · programas pesados na inicialização · desfragmentar/TRIM · liberar RAM · memória virtual automática ·
**pastas lentas** (zerar cache de modo de exibição, reconstruir miniaturas/ícones, abrir em “Este Computador”) ·
**internet** (limpar DNS, DNS 1.1.1.1/8.8.8.8, reparar Winsock/TCP-IP, desativar Otimização de Entrega) ·
**reparo** (CHKDSK online, SFC, DISM, Windows Update, verificação rápida do Defender).

### Segurança
- Antes de executar, abre uma tela com **tudo o que será feito** (desmarque o que não quiser), avisos de risco e a opção de criar **ponto de restauração**.
- A interface só envia **IDs**; os caminhos de limpeza ficam no motor (`electron/engine`). Não existe “apagar caminho arbitrário”.
- Arquivos grandes só vão para a **Lixeira**, e somente os que apareceram no último scan e fora de pastas do sistema.
- Links simbólicos/junções são ignorados (sem loops nem contagem dupla). Arquivos em uso são pulados.
- Programas de inicialização são desativados pelo mecanismo do Gerenciador de Tarefas (reversível).
- Gera **relatório** `.txt` do que foi feito.

## Como usar (técnico)
1. Rode `GERAR-EXE.bat` (precisa do Node.js) ou baixe o executável do GitHub Actions (workflow *Reparo e Otimização do Windows*).
2. Instale `ReparoWindows-Instalador-*.exe` ou use o `ReparoWindows-Portatil-*.exe` direto do pendrive.
   O programa pede **permissão de administrador** (necessária para limpar o Windows).
3. Em **Visão geral**, clique **Analisar este computador**, confira os problemas e **Resolver tudo** (ou só os selecionados).

## Desenvolvimento
```bash
cd reparo-otimizacao-windows
npm install
npm run dev        # interface no navegador, em MODO DEMONSTRAÇÃO (dados fictícios)
npm test           # testes do motor e da interface (Linux/Windows)
npm run app        # abre o Electron (no Windows usa o motor real)
npm run smoke      # (Windows) roda o diagnóstico/limpeza/ajustes reais sem a interface: node scripts/smoke-windows.cjs --tarefas
npm run dist       # gera instalador e portátil em release/
```

```
electron/main.cjs, preload.cjs      janela e ponte IPC
electron/engine/catalogo.json       descrição de todas as tarefas/limpezas (usado pelo motor E pela interface)
electron/engine/scanner.cjs         scanner do disco (árvore, maiores arquivos, tipos)
electron/engine/limpeza.cjs         categorias de limpeza (caminhos, medir, apagar)
electron/engine/tarefas.cjs         ajustes/reparos (PowerShell, DISM, SFC, netsh…)
electron/engine/inicializacao.cjs   programas de inicialização
electron/engine/sistema.cjs         diagnóstico, memória e processos
electron/engine/rede.cjs            teste de DNS/latência
src/                                interface React (páginas, componentes, regras de análise)
```

## Limitações conhecidas
- Os ajustes por usuário (efeitos visuais, Explorador, apps em segundo plano) valem para o usuário que executou o programa como administrador.
- O tamanho de “Componentes antigos do Windows” só é conhecido depois de executar (o DISM não informa antes).
- “Disco com 100%” e “Windows lento” podem ter causa de hardware (HD velho, pouca RAM): nesses casos o programa explica e recomenda SSD/mais memória.
- No navegador/Linux a interface roda em modo demonstração; o motor real só executa no Windows.
