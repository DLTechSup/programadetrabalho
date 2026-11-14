# DLL — Digital Link Load

Transferência de arquivos direto de um navegador para outro, sem servidor no meio. Quem envia gera um código de 12 caracteres; quem recebe digita esse código no site e o download começa. Os bytes vão por WebRTC, cifrados de ponta a ponta, e nunca passam por nenhum servidor.

Não há limite de tamanho imposto pelo site. Se a conexão cair, a transferência retoma do ponto onde parou.

## Como usar

**Enviando**

1. Abra o site e escolha (ou arraste) os arquivos.
2. Aparece um código, tipo `K3F9-2QMT-7XBD`.
3. Passe o endereço do site e o código. Se preferir, use "Copiar link com o código" — o link abre a página já com o código preenchido.
4. Mantenha a aba aberta enquanto alguém estiver baixando. Ao fechar, o código deixa de funcionar.

**Recebendo**

1. Abra o site, digite o código e toque em "Baixar".
2. Deixe a aba aberta até terminar.
3. No Chrome e no Edge, escolher onde salvar faz os dados irem direto para o disco, sem limite de memória.

## Como funciona

O código não é um apelido de um link guardado em algum lugar: ele é a semente de tudo. Dos 12 caracteres, via HKDF-SHA256, derivam-se três coisas — o identificador usado na sinalização, a chave AES-256-GCM da transferência e uma chave HMAC para autenticação. Os dois lados chegam ao mesmo resultado a partir do mesmo código, então nenhuma chave precisa trafegar.

A sinalização (troca de offer, answer e ICE) usa o broker público do PeerJS e vê apenas um identificador derivado. O conteúdo dos arquivos vai pelo data channel do WebRTC, em blocos de 64 KB, com controle de `bufferedAmount` para não estourar o buffer de envio.

**Segurança**

- Cada bloco é cifrado com AES-256-GCM, IV único, e dados associados que amarram o índice do arquivo e o offset — blocos não podem ser reordenados, repetidos ou emendados.
- Antes de qualquer byte, os dois lados provam que conhecem o código por desafio-resposta HMAC mútuo, com comparação em tempo constante. Isso também derruba a tentativa de um servidor de sinalização malicioso se colocar no meio.
- Quem abre o site com o código errado é desconectado sem receber nem o nome dos arquivos. Conexões que não se autenticam em 10 segundos são encerradas.
- Se a verificação de integridade falhar em qualquer bloco, a transferência é abortada de vez, sem nova tentativa.
- Nome, tamanho e tipo recebidos são sanitizados antes de virarem nome de download.
- A página exige HTTPS, porque a criptografia do navegador só funciona em contexto seguro.

Quem tem o código tem o arquivo — trate o código como uma senha.

## Publicando

O site é um único arquivo estático. Copie `index.html` para a raiz do repositório e ative GitHub Pages em Settings → Pages. Nenhuma configuração, build ou servidor é necessário.

## Limites conhecidos

- As duas abas precisam estar abertas ao mesmo tempo. Não há armazenamento: se ninguém está enviando, o código não serve para nada.
- No Safari e no iOS não existe gravação direta em disco, então o arquivo é montado na memória e os muito grandes podem falhar. No Chrome em Android e desktop isso não acontece.
- Redes muito restritivas podem bloquear a conexão direta. Sem servidor TURN, esses casos não completam.
- O broker público de sinalização sabe que dois pares conversaram e quando — metadados, não conteúdo.

## Desenvolvimento

O código-fonte é `Passthru.dc.html`. O `index.html` é a versão compilada em arquivo único, com todas as dependências embutidas para funcionar offline e sem CDN.

## Licença

PolyForm Noncommercial 1.0.0 — uso livre para fins não comerciais, mantendo os créditos. Uso comercial exige licença separada, negociada com o autor. Veja `LICENSE.md`.

Criado por Danilo Lira. Contato para uso comercial: daniloliracontato@hotmail.com
