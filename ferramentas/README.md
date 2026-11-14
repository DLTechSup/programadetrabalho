# Ferramentas

Aqui fica o código-fonte de todas as outras ferramentas da DLTechSup — as que ainda **não**
foram portadas para dentro da Central (o programa Electron na raiz deste repositório). A ideia
é não precisar mais procurar ferramenta espalhada em repositório separado: está tudo aqui.

| Pasta | O que é | Tecnologia |
|---|---|---|
| ![](sonora-baixar-musica/build/icon.png) [`sonora-baixar-musica/`](sonora-baixar-musica) | **Sonora** — baixa música/vídeo de mais de 1100 sites (usa o motor yt-dlp) | Electron + React |
| ![](projeta-moveis/app/public/icone.png) [`projeta-moveis/`](projeta-moveis) | **Projeta Móveis** — desenho técnico, plano de corte e orçamento de móveis a partir das medidas | Electron + React (+ versão antiga em Python) |
| [`catalogo-loja/`](catalogo-loja) | **Catálogo + Administração** — catálogo de fotos das marcas/referências e painel de administração da Calçados 24h | Site estático (HTML/JS) |
| ![](dll-transferencia-arquivos/dll-logo-small.png) [`dll-transferencia-arquivos/`](dll-transferencia-arquivos) | **DLL** — transferência de arquivo direto entre dois navegadores (P2P, sem servidor) | Site estático (HTML/JS) |
| ![](dltech-site/logo-dltech.png) [`dltech-site/`](dltech-site) | **dltech.site** — site de suporte remoto (AnyDesk) da DLTechSup | Site estático (HTML/JS) |
| [`anydesk-license-reset/`](anydesk-license-reset) | Reseta o bloqueio da versão grátis do AnyDesk (sem interface, roda como script) | Scripts (Windows/Linux/macOS) |
| ![](conector-desktop-mobile/assets/logo-1024.png) [`conector-desktop-mobile/`](conector-desktop-mobile) | **DeskLink** — controla o PC pelo celular (áudio, notificações, controle remoto) | Desktop (Windows) + Android |
| [`encaixe-curriculos/`](encaixe-curriculos) | **Encaixe** — casador de currículos com vagas (ATS) | Next.js |
| [`separador-de-fotos/`](separador-de-fotos) | Separa fotos de calçados por marca/referência lendo a etiqueta (OCR) | Python (desktop) |
| [`nomes-descricoes-calcados/`](nomes-descricoes-calcados) | Gera nome e descrição de calçados para o Bling | Python (desktop) |
| ![](codigos-das-fotos-v2/img/logo.png) [`codigos-das-fotos-v2/`](codigos-das-fotos-v2) | Versão 2 (redesenhada) do Códigos das Fotos — o que está rodando na Central hoje é a versão 1 | Site estático (HTML/JS) |

## Já dentro da Central (não precisam de pasta aqui)

GradeFácil, Renomear em Massa, Captura de Tela, Monitor de Demandas, NoteDeck e Códigos das
Fotos (v1) já são abas nativas do programa na raiz deste repositório — veja `src/apps/` e
`electron/`.
