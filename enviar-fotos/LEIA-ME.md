# Enviar Fotos

Envia uma pasta de fotos (`Marca / Referência / arquivos`) para o Google Drive do dono,
sozinho, sem ninguém na frente. O plano original está em [`PLANO.md`](PLANO.md).

## 1. Google Cloud (uma vez)
1. Em console.cloud.google.com crie um projeto e ative a **Google Drive API**.
2. **Tela de consentimento OAuth** → tipo *Externo* → adicione seu e-mail como usuário.
   **Publique o app ("Em produção")**: em modo *Teste* o refresh token expira em 7 dias.
   (Com o escopo `drive.file` não é preciso verificação do Google; aparece só o aviso
   "app não verificado" no seu login, é normal: *Avançado → continuar*.)
3. **Credenciais → Criar → ID do cliente OAuth → App para computador**. Baixe o JSON e salve
   nesta pasta como `credentials.json`.

## 2. Configurar e gerar o .exe (máquina do dono, Windows, Python 3.11+)
1. Edite as constantes no topo de `enviar_fotos.py`: `NOME_DESTINATARIO`, `PASTA_DESTINO` e
   `STATUS_URL` (link *raw* de um Gist com a palavra `ativo`; troque por `desativado` para
   parar o envio em até ~1 minuto. Vazio = sem interruptor).
2. `pip install -r requirements.txt` e `python autorizar.py` → faz o login e cria `token.json`.
3. Dê dois cliques em `GERAR-EXE.bat` (roda os testes e gera `dist\EnviarFotos.exe`).

## 3. Na máquina da empresa
Abrir o `.exe` → **Selecionar pasta** → **Compartilhar** → confirmar. Não deslogar, desligar nem
trocar de usuário (Win+L é ok). O programa fecha sozinho 60 s depois de concluir.
Acompanhe pelo Drive: `Fotos da Loja/_progresso.txt` (atualiza a cada 25 arquivos ou 60 s;
se a hora da última atualização parar, o PC está sem internet/desligado).
Se parar, basta abrir de novo: ele pula o que já está no Drive.

## 4. Depois
Apague `EnviarFotos.exe`, `token.json`, `credentials.json` e `log_envio.txt` da máquina da empresa e
revogue o acesso em myaccount.google.com/permissions.
**O .exe contém o token do seu Drive: não publique nem envie por e-mail/chat.**

## Ajustes feitos em relação ao plano
- Arquivo já no Drive com **tamanho diferente** é substituído (arquivo incompleto/alterado); mesmo tamanho é pulado.
- `_progresso.txt` é reaproveitado ao retomar (não duplica) e traz o tamanho total/enviado.
- Timeout de 60 s nas conexões (sem isso uma conexão "morta" travaria o envio para sempre).
- Revogação só é tratada como "desativado" se o Google responder `invalid_grant`; falhas de rede ao
  renovar o token viram pausa e nova tentativa.
- Drive cheio (`storageQuotaExceeded`) fica em status `erro` e continua tentando (dá para liberar espaço).
- Interruptor com resposta que não seja `ativo`/`desativado` (ex.: 404) é tratado como "não deu
  para verificar": não inicia, mas não interrompe um envio em andamento.
- Sessão de upload expirada (404) recomeça o arquivo; pastas duplicadas no Drive não são criadas.
- Sem janela bloqueante no fim: mostra a mensagem e fecha sozinho após 60 s só se concluiu.
- `teste_enviador.py` testa o motor com um Drive simulado (estrutura, apóstrofo/acentos, retomada,
  queda de internet, HTTP 429/5xx, cancelar e interruptor).
- **Testes manuais ainda necessários** (precisam de Windows/Google reais): janela, `.exe` em máquina limpa,
  suspensão após 20+ min ociosa e login real. O `.exe` não pode ser gerado em Linux.
