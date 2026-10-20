# Projeto: Enviar Fotos (upload de pastas para o Google Drive)

## Objetivo
Programa Windows com interface simples que envia uma pasta de fotos de produtos
(estrutura `Marca / Referência / arquivos`) para o Google Drive do dono do projeto.
Será executado em uma máquina da empresa (com autorização deles). O dono inicia o
envio e **vai embora**: o programa precisa terminar sozinho, sem ninguém na frente.

## Cenário de uso
1. Na máquina do dono: rodar `autorizar.py`, fazer login Google e gerar `token.json`.
2. Gerar `EnviarFotos.exe` com `token.json` embutido (PyInstaller).
3. Na máquina da empresa: abrir o `.exe`, selecionar a pasta, confirmar, clicar em
   **Compartilhar**, e sair. **Nenhum login é pedido nessa máquina.**
4. O envio continua sozinho até o fim. O dono acompanha pelo Drive.
5. Depois: remover o `.exe` da máquina e revogar o acesso em
   myaccount.google.com/permissions.

## Stack
- Python 3.11+, `tkinter` (interface), `google-api-python-client`,
  `google-auth-oauthlib`, `pyinstaller`.
- Textos da interface em português do Brasil, claros para quem não é técnico.

## Arquivos
- `autorizar.py`: fluxo OAuth (app para computador), escopo `drive.file`,
  `access_type="offline"`, `prompt="consent"`, salva `token.json`.
- `enviar_fotos.py`: programa principal com a interface.
- `LEIA-ME.md`: passo a passo de Google Cloud e geração do `.exe`.

## Autenticação (decisões importantes)
- Escopo único: `https://www.googleapis.com/auth/drive.file` (só enxerga o que o
  próprio programa criou). Não usar conta de serviço (não tem espaço no Drive).
- O app OAuth deve estar **"Em produção"** na tela de consentimento; em "Teste" o
  refresh token expira em 7 dias.
- `token.json` (com refresh token) é embutido no `.exe` via `--add-data`.
  Caminho de recursos: `sys._MEIPASS` quando empacotado.
- Ao abrir, sempre `creds.refresh(Request())`. `RefreshError` = acesso revogado:
  mostrar "programa desativado" e encerrar.

## Interface (tkinter)
- Título, texto dizendo para quem as fotos serão enviadas (`NOME_DESTINATARIO`).
- Passo 1: botão **Selecionar pasta** + resumo (nº de marcas = subpastas diretas,
  nº de arquivos, tamanho total). Ignorar `Thumbs.db`, `desktop.ini`, `.DS_Store`
  e arquivos de 0 bytes.
- Passo 2: botão **Compartilhar** (só habilita após selecionar), com caixa de
  confirmação mostrando o resumo ("Essa é a pasta com TODAS as fotos?").
- Barra de progresso (arquivos feitos / total), nome do arquivo atual, botão
  **Cancelar envio**.
- Upload em thread separada; a janela nunca trava (comunicação por `queue`).
- Mensagem final: "Concluído! Pode fechar o programa."

## Requisitos do modo sem supervisão (ponto central)
O dono sai da máquina logo após iniciar. Portanto:
1. **Impedir suspensão do Windows** durante o envio:
   `ctypes.windll.kernel32.SetThreadExecutionState(0x80000001)`
   (ES_CONTINUOUS | ES_SYSTEM_REQUIRED) ao iniciar; restaurar com `0x80000000`
   ao terminar.
2. **Nunca depender de clique depois de iniciar**: sem pop-ups bloqueantes durante
   o envio (erros vão para o log e para a tela; só mostrar pop-up no final).
3. **Retry infinito com backoff** (2s, 4s... até 60s) para falhas de rede e HTTP
   403/429/5xx. Queda de internet de horas não pode encerrar o programa; ele
   pausa e retoma sozinho.
4. **Retomada**: ao reiniciar, listar os filhos de cada pasta do Drive e pular
   arquivos que já existem (comparar por nome; opcionalmente por tamanho).
   Pasta raiz fixa (`PASTA_DESTINO`), reaproveitada se já existir.
5. **Uploads resumáveis** (`MediaFileUpload(resumable=True, chunksize=5MB)`).
6. **Log em arquivo** (`log_envio.txt` ao lado do `.exe`): início, cada pasta
   concluída, erros, retries, fim. Rotação simples se passar de poucos MB.
7. **Painel de acompanhamento remoto**: a cada N arquivos (ex.: 25) ou 60 s, o
   programa grava/atualiza no Drive um arquivo `_progresso.txt` na pasta raiz
   com: arquivos enviados / total, marca atual, GB enviados, hora da última
   atualização, status (`enviando`, `pausado por falta de internet`, `concluído`,
   `erro`). Assim o dono confere de qualquer lugar abrindo o Drive.
8. Ao concluir: gravar `_progresso.txt` como `concluído`, liberar a suspensão do
   Windows e (opcional) fechar sozinho após 60 s.
9. Não depender de a janela estar em foco ou de usuário logado interativamente
   além de manter a sessão aberta (avisar o dono para **não deslogar, nem
   desligar, nem bloquear com troca de usuário**; bloquear tela com Win+L é ok).

## Interruptor remoto
- `STATUS_URL` aponta para um arquivo de texto público (Gist raw) com `ativo` ou
  `desativado`.
- Checar ao abrir, antes de iniciar, e a cada ~60 s durante o envio (com
  parâmetro `?t=timestamp` contra cache).
- `desativado` → parar o envio com mensagem clara e registrar no log.
- **Sem internet na verificação inicial** → não iniciar.
- **Sem internet no meio do envio** → NÃO encerrar; continuar tentando (o upload
  também precisa de internet). Só interromper se a resposta for explicitamente
  `desativado`.

## Configuração (constantes no topo de `enviar_fotos.py`)
`STATUS_URL`, `NOME_DESTINATARIO`, `PASTA_DESTINO`, tamanho do chunk, intervalo
de atualização do `_progresso.txt`.

## Estrutura no Drive
`Fotos da Loja / [Marca] / [Referência] / foto.jpg` (replicar a hierarquia local
em qualquer profundidade) + `_progresso.txt` na raiz.

## Build
```
pip install google-api-python-client google-auth-oauthlib pyinstaller
python autorizar.py
pyinstaller --onefile --windowed --name EnviarFotos --collect-data googleapiclient --add-data "token.json;." enviar_fotos.py
```

## Testes a fazer antes de levar para a empresa
- Pasta pequena com 2 marcas e subpastas: conferir a estrutura no Drive.
- Cancelar no meio e reabrir: não pode duplicar arquivos.
- Desligar o Wi-Fi por 2 minutos durante o envio: deve pausar e retomar sozinho.
- Mudar `status.txt` para `desativado` durante o envio: deve parar em ~1 minuto.
- Nomes com acento, espaços e apóstrofo (`'`) nas pastas (escapar a query do Drive).
- Rodar o `.exe` numa máquina limpa (sem Python instalado).
- Deixar o PC ocioso por 20+ minutos com o envio rodando: não pode suspender.

## Segurança e boas práticas
- O `token.json` permite enviar arquivos ao Drive do dono: não publicar o `.exe`.
- Mostrar sempre na tela para quem as fotos estão sendo enviadas (transparência
  com a empresa).
- Ao final: apagar o `.exe`, `token.json`, `credentials.json` e `log_envio.txt`
  da máquina da empresa e revogar o acesso em myaccount.google.com/permissions.
- Não gravar senhas nem dados pessoais em log.

## Fora do escopo
- Download/sincronização no sentido Drive → máquina (o dono baixa depois).
- Compactação em ZIP (envio é arquivo a arquivo, preservando pastas).
- Suporte a Mac/Linux (apenas Windows, a menos que o dono peça).
