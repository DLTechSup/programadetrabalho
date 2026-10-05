# Assistente de Voz para Windows

Assistente **controlado por voz** (React + TypeScript + Electron) que roda 100% no seu computador:
você chama pelo nome, fala o que quer e ele executa — abrir marcas/referências, abrir e fechar programas,
trocar abas do navegador, controlar janelas e volume.

> Programa **separado** dos outros da pasta raiz (GradeFácil e Reparo do Windows): tem seu próprio `package.json` e executável.

## Como funciona

1. **Escuta** o microfone e detecta quando você fala (sem gravar nada em disco).
2. **Reconhece** a frase com o **Whisper** (modelo local, em português). Baixa uma única vez (~80 MB); depois funciona **sem internet**.
3. Só reage se a frase começar com o **nome do assistente** (padrão **Jarvis**). O resto do que é dito na sala é ignorado.
4. **Entende** o pedido (regras em português, offline, sem custo), **executa** e **responde falando** (voz do Windows).

### Palavra de ativação que você troca por voz
```
Você:       Jarvis
Assistente: Pois não?
Você:       seu nome agora é Assistente
Assistente: Ok, me chame de Assistente quando quiser algo.
```
Também funciona numa frase só (“Jarvis, seu nome agora é Computador”). O nome fica salvo e vale na próxima vez que abrir.
Se o reconhecedor escrever o nome de outro jeito, a tela **Conversa** mostra o que foi ouvido e dá para cadastrar variações em **Configurações**.

### Depois de um comando ele continua ouvindo (12 s, ajustável)
“Jarvis, abre a marca Beira Rio” … “referência 8506 ponto 209” … “lista os arquivos” … “volta uma pasta”. Sem repetir o nome.

## Modos de escuta (Configurações › Como eu devo ouvir)
| Modo | Como usa | Quando |
|---|---|---|
| **Pelo nome** (padrão) | “Jarvis, abre a marca Beira Rio” | gente falando por perto |
| **Pelo atalho** (mais rápido) | aperta **Ctrl+Shift+Space** e fala “abre a marca Beira Rio” | o que você fala fora do atalho nem é processado: sem falsos comandos e mais leve |
| **Direto** (como ditado) | só fala o comando | sozinho, em lugar silencioso |

Sem resposta falada por padrão (o resultado aparece na tela e a ação acontece). Dá para ligar em Configurações.

### Deixar mais rápido
- Modo **atalho**; **silêncio para terminar a frase** em ~400 ms; modelo **Equilibrado (base)** (o **Preciso (small)** acerta mais, mas demora mais). O Diagnóstico mostra em quantos segundos cada frase foi reconhecida.
- O Whisper sempre processa uma janela de 30 s, então há um tempo mínimo de ~1–3 s por frase em computadores comuns; o programa já usa vários núcleos e “aquece” o modelo ao abrir.

## O que ele faz

| Categoria | Exemplos |
|---|---|
| **Marcas e referências** (`Raiz › Marca › Referência › arquivos`) | “Abre a marca Beira Rio” · “Abre a marca Beira Rio, referência 8506 ponto 209” · “Abre a referência 8367 da Bebece” · “Pesquisa a referência 8506” · “Lista os arquivos” · “Abre o arquivo ficha” · “Volta uma pasta” · “Fecha as pastas” |
| **Programas** | “Abre o WhatsApp” · “Abre o zap web” (atalho da área de trabalho) · “Abre o Excel” · “Fecha o Chrome” · “Mata o Excel” (fecha à força) |
| **Navegador** (Chrome, Edge, Firefox, Brave, Opera) | “Próxima aba” · “Aba anterior” · “Vai para a aba 3” · “Vai para a aba do YouTube” · “Nova aba” · “Fecha a aba” · “Reabre a aba” · “Recarrega a página” · “Pesquisa no Google preço do dólar” · “Abre o site globo.com” · “Janela anônima no Firefox” |
| **Janelas** | “Troca de janela” · “Vai para o Excel” · “Minimiza essa janela” · “Maximiza o Chrome” · “Mostra a área de trabalho” · “O que está aberto?” |
| **Volume e mídia** | “Aumenta o volume” · “Abaixa um pouco” · “Volume em 30” · “Volume no máximo” · “Mudo” · “Liga o som” · “Pausa” · “Próxima música” |

A tela **Comandos** lista todos com exemplos clicáveis (a lista é gerada do mesmo código que interpreta os comandos, então não fica desatualizada).

### Marcas e referências (o fluxo da sua rotina)
- Aponte a **pasta raiz** (ex.: `D:\Users\LiraDanilo\Desktop\LANÇAMENTOS`) na aba **Pastas**. O programa aprende as marcas e referências sozinho.
- Códigos falados de qualquer jeito: “oito cinco zero seis ponto dois zero nove”, “8506.209”, “8.506.209”, “8506 209”.
- **Código parcial** (“8367”) acha todas as parecidas e **pergunta qual** (“1, 8367.871 · 2, 8367.872 …”); você responde “dois”, “o segundo” ou o final do código.
- **Mesma referência em duas marcas** → pergunta qual. **Referência que não existe na marca** → avisa e sugere onde ela existe.
- Nomes de marca tolerantes a erro do reconhecedor (“molequinha” → `MOLEKINHA`; `MOLEKINHA` ≠ `MOLEKINHO` quando falados com clareza). Pastas como “Nova pasta” e “FOTOS variadas” podem ser ignoradas na aba Pastas.

### Programas
Abre qualquer programa do **menu Iniciar** (inclusive da Microsoft Store) e os atalhos da **área de trabalho** só pelo nome. Se o programa já está aberto, traz para a frente em vez de abrir outro.
Apelidos próprios (ex.: “zap web” → seu atalho do WhatsApp Web) na aba **Programas**.

## Segurança e privacidade
- Reconhecimento de voz **local**: nenhum áudio sai do computador. Internet só para baixar o modelo na primeira vez.
- Só age quando ouve o **nome de ativação**; sem ele, ignora (e mostra “ouvi, mas não era para mim” na Conversa).
- Lista **fechada** de ações programadas — não executa comandos arbitrários.
- Fechar um programa pede “fechar a janela” (o programa pergunta se quer salvar); “mata” só quando você pede explicitamente. Processos do sistema e antivírus são protegidos.

## Como usar
1. Rode `GERAR-EXE-ASSISTENTE-DE-VOZ.bat` (na raiz do repositório) ou `GERAR-EXE.bat` (dentro desta pasta). Precisa do Node.js.
2. Instale/execute o `.exe` gerado em `release/`.
3. Na primeira vez: **Baixar o modelo de voz** (botão na tela inicial) e **escolher a pasta raiz** (aba Pastas). Libere o microfone se o Windows perguntar.
4. Diga “Jarvis” e peça. Pode digitar na caixa da Conversa para testar sem falar.
5. Fechar a janela deixa o assistente na **bandeja** (perto do relógio) ouvindo; “Iniciar junto com o Windows” em Configurações.

## Desenvolvimento
```bash
cd assistente-de-voz
npm install
npm run dev        # interface no navegador, em MODO DEMONSTRAÇÃO (cérebro real, ações simuladas, sem microfone)
npm test           # testes do motor, do interpretador, do detector de voz etc.
npm run app        # abre o Electron (no Windows usa tudo de verdade)
node scripts/smoke-windows.cjs   # (Windows) confere janelas/programas/volume sem abrir nada
npm run dist       # gera instalador e portátil em release/
```
```
electron/main.cjs, preload.cjs       janela, bandeja, protocolo app:// (serve a interface, o WebAssembly e o modelo) e IPC
electron/engine/texto.cjs            normalização, números por extenso, semelhança de nomes (tolera erro de fala)
electron/engine/comandos.cjs         interpretador de comandos em português + exemplos
electron/engine/cerebro.cjs          ativação por nome, troca de nome, perguntas/escolhas, tempo de conversa
electron/engine/acoes.cjs            executa: marcas/referências, programas, navegador, janelas, volume
electron/engine/pastas.cjs           índice Raiz›Marca›Referência e buscas
electron/engine/programas.cjs        programas instalados, sites, janelas abertas
electron/engine/janelas.cjs          PowerShell/Win32: janelas, teclas, volume (Core Audio), mídia
electron/engine/modelo.cjs           download do modelo Whisper
src/audio/                           microfone, detector de fala (VAD), Whisper em Web Worker, resposta falada
src/pages/                           telas: Assistente, Comandos, Pastas, Programas, Configurações
```

## O que foi testado e o que não foi
- **Testado automaticamente (Linux):** interpretação de ~70 frases, ativação/troca de nome, escolhas e cancelamento, fluxo marca › referência › arquivos com a estrutura de pastas real, detector de fala com sinais sintéticos, download do modelo (simulado), configuração, sintaxe de todos os scripts PowerShell e compilação do C#. Também rodou **dentro do Electron** (app empacotado): protocolo, WebAssembly, IPC, índice de pastas e abertura das pastas certas.
- **Não testado (precisa de um Windows com microfone):** captação do microfone e o Whisper reconhecendo sua voz de verdade, a voz falada do Windows, e as ações de janela/aba/volume/abrir programa em um Windows real. O workflow do GitHub Actions roda `scripts/smoke-windows.cjs` para os comandos de janelas/programas/volume.
- Se algo não responder: a Conversa mostra o que foi ouvido; ajuste **Sensibilidade**, escolha o modelo **small** (mais preciso) ou cadastre **variações** do nome.

## Reconhecimento ruim? (ex.: celular como microfone)
1. **Configurações › Diagnóstico do microfone**: toque ▶ para ouvir o que o programa recebeu. Se estiver baixo, abafado ou cortado, o problema é o microfone/aplicativo.
2. Deixe **“Filtros de áudio do navegador” desligado** (padrão): o cancelamento de ruído do Chrome corta sílabas.
3. Use **Qualidade: Preciso (small)** — bem melhor que o “base” com áudio de celular (baixa ~250 MB uma vez).
4. Aumente o volume do microfone no aplicativo do celular e chegue perto; fale a frase inteira sem pausar no começo.
5. O programa já amplifica voz baixa, adiciona silêncio nas pontas e corrige erros comuns nas palavras de comando (“pasto/past” → “pasta”, “abri” → “abre”, “fexa” → “fecha”), mas **não** altera nomes de marcas.

## Limitações
- Trocar de aba **por nome** usa a busca de abas do navegador (Ctrl+Shift+A no Chrome/Edge; barra de endereço `% texto` no Firefox).
- Controlar **conversas de WhatsApp** (abrir um contato, escrever mensagem) não está incluído: abrir o WhatsApp/WhatsApp Web está.
- Interpretação por regras: entende bem os pedidos da lista, mas não frases totalmente livres. Dá para ligar um modelo de IA como segundo nível no futuro.
- Precisa de uma **voz em português** instalada no Windows para responder falando (a maioria já tem).
- Janelas de programas executados como Administrador só podem ser controladas se o assistente também estiver como Administrador.
