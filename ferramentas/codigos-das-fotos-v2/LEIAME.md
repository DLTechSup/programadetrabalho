# Códigos das Fotos 2 — Calçados 24h

Nova versão do Códigos das Fotos, com visual novo e as mesmas regras de trabalho.
Usa **o mesmo Supabase, as mesmas tabelas, o mesmo login e os mesmos dados** do site atual.
**Não precisa rodar nenhum SQL nem mudar nada no banco.**

## Como subir
1. Crie um repositório no GitHub (ou use o `CodigoDasFotos`, numa pasta ou branch nova) e envie todos estes arquivos.
2. Ative o GitHub Pages (branch `main`, pasta raiz).
3. Pronto: o endereço abre direto na página do **Escritório**. O **Meu painel** pede o mesmo usuário e senha de hoje.

Para ver sem tocar no banco: coloque `?demo` no fim do endereço (dados fictícios).
O link antigo `?modo=painel` continua abrindo direto o painel.

## O site atual e o novo juntos
Os dois leem e gravam no mesmo formato, então podem funcionar ao mesmo tempo durante a troca.
O que um faz, o outro vê ao vivo.

## O que nunca acontece no novo
- **Nada é apagado do banco.** "Excluir" virou **Arquivar**: o produto sai das listas e fica em *Arquivados*, de onde pode voltar.
- Restaurar um backup só **adiciona** o que estiver faltando; não substitui nem apaga nada.
- O histórico não tem "apagar dia" nem "apagar remessa".
- Remover acesso não existe aqui (apagaria o perfil). Se precisar tirar o acesso de alguém, faça no Supabase em Authentication → Users.

## Escritório (página aberta, sem senha)
- Produtos **agrupados por marca**, com **foto grande** (clique para ampliar e ver todas) e **campo de código em destaque**.
- Digita o código e aperta **Enter** → aparece **"Confira antes de enviar"** com a foto e o código → **Enter** de novo envia e já vai para a próxima referência da mesma marca.
- Alerta fixo de **pendências de fotos** (sem código e sem foto / com código, faltando foto).
- Aviso de **produtos novos**, avisos no navegador (botão "Ativar avisos") e contador na aba.
- Quando tudo é respondido, grava o **"Tudo preenchido"** (o mesmo registro do site atual).
- **Já no site**: os últimos produtos finalizados, com foto e código.

## Meu painel (usuário e senha)
- **Visão geral**: números do dia, "o escritório diz que já enviou as fotos" (Recebi / Não recebi), ritmo de 14 dias e atividade recente.
- **Novo produto**: várias fotos (arrastar, clicar ou colar), marca, referência, situação das fotos, um ou mais valores do Bling, observação. **Colar lista do WhatsApp** no formato de sempre. Tudo vai para o **Rascunho** até você clicar em **Enviar ao escritório**.
- **Esperando código**: Todos / Com o escritório / Escritório não sabe (com **Reenviar**) / Rascunho.
- **Códigos recebidos**: foto grande, **código em destaque — clique para copiar**, Site e Atacado, Feito, **Copiar todos**, **Marcar todos como feito**.
- **Pendências de fotos**: Todas / Sem código / Com código, filtro por situação, Recebi as fotos / Não recebi.
- **Falta Atacado**: já no site, falta o Atacado.
- **Histórico**: catálogo com foto, marca, referência e código; Feitos hoje / Todo o histórico; filtro por marca; copiar lista; baixar fotos; voltar para recebidos.
- **Relatórios** (imprimir ou salvar PDF) com **foto, marca, referência, código e valor** em Esperando, Recebidos, Pendências e Histórico.
- **Acessos e backup**: criar acesso, exportar backup (mesmo formato do site atual) e restaurar.
- Clicar em qualquer produto abre a **edição completa**: fotos, marca, referência, valores, situação, observação, recado ao escritório, corrigir código, Site/Atacado e ações.

## Arquivos
```
index.html            página única
css/app.css           visual (claro/escuro) e animações
img/                  logo
js/config.js          endereço do Supabase, domínio do login, nome "Escritório"
js/regras.js          regras do sistema (testadas)
js/db.js              acesso ao banco — sem nenhum delete
js/demo.js            dados do modo ?demo
js/app.js             rotas, tempo real, avisos
js/views/             telas
tests/                node --test tests/regras.test.mjs
```
