# Automação Bling v3 (React + Electron)

Versão nova do programa em **React + TypeScript**, empacotada como aplicativo de desktop
(Electron) — instala no Windows com atalho na área de trabalho. Mantém **todas as funções**
da versão Python/PyQt6 (a lógica foi portada função por função e comparada com o código
original em 937 casos de teste, com resultado idêntico) e ganhou:

- visual novo (tema claro/escuro, passos, arrastar-e-soltar, pré-visualização do resultado);
- leitura direta de `.xls` e `.xlsx` (não precisa mais "salvar como .xlsx");
- tela **Banco de cores**: buscar, editar, remover, importar e exportar abreviações;
- **Scanner de pastas** (novo): aprende as cores de todas as planilhas já prontas.

## Como usar

1. **Planilha** → arraste o arquivo exportado do Bling (ou clique para escolher).
2. O PAI é detectado sozinho (se não houver, abre o formulário "Criar PAI"). Marca, categoria,
   peso, dimensões, estoque, validade, descrição curta e Código Pai são copiados para as variações.
3. Confirme as cores (uma linha por cor). Abreviações já usadas vêm preenchidas — digite a nova
   e aperte **Enter** para ir para a próxima. Clique em **Gerar Código e Descrição**.
4. **Salvar planilha pronta…** e importe no Bling.

### Scanner de pastas
Estrutura esperada: `Pasta raiz / Marca / Referência / planilha.xlsx` (qualquer profundidade funciona).
O scanner lê **Código** e **Descrição** das variações já prontas (`Cor:Preto;Tamanho:37`) e deduz a
abreviação (`Código = Código Pai + abreviação + tamanho`). Mostra o que é **novo**, **diferente** do
banco atual e **já existente**; você decide se também sobrescreve as diferentes e clica em
**Atualizar banco de cores**. Seus arquivos nunca são alterados; planilhas ainda não preenchidas,
corrompidas ou temporárias do Excel (`~$…`) são ignoradas e listadas no relatório.
A marca usada é a da coluna *Marca* da planilha (a mesma que o programa consulta depois); se estiver vazia, usa o nome da pasta.

### Onde fica o banco de cores
No app instalado: `%APPDATA%\Automação Bling\cores_bling.json`. Na primeira abertura ele nasce com o
seu histórico (745 combinações marca+cor). Para trazer um `cores_bling.json` antigo, use
**Banco de cores → Importar…** (as abreviações são somadas).

## Gerar o executável (.exe)

**Opção 1 — automática (GitHub):** na aba *Actions* do repositório, rode **Gerar executável (Windows)**.
Ao terminar, baixe o artefato `AutomacaoBling-windows` (instalador `Setup` e versão `portable`).
Criando uma tag `v3.0.0` o `.exe` também é anexado a uma Release.

**Opção 2 — no seu computador (Windows):** instale o [Node.js LTS](https://nodejs.org) e dê **dois cliques em `GERAR-EXE.bat`** (instala, testa, compila e abre a pasta `release`). Ou, manualmente, na pasta do projeto:

```bash
npm install
npm run dist
```
Os arquivos saem em `release\` (`AutomacaoBling-3.0.0-x64.exe`).

## Desenvolvimento

```bash
npm install
npm run dev     # interface no navegador (http://localhost:5173), com dados de teste no navegador
npm run app     # compila e abre no Electron
npm test        # testes (inclui a comparação com o código Python original)
```

- `src/core/nucleo.ts` — lógica de negócio (port do `nucleo.py`)
- `src/core/scanner.ts` — extração de cores das planilhas prontas
- `src/core/planilha.ts` — leitura/escrita de Excel
- `legado-python/` — código original, usado como referência pelos testes (`tests/gerar_referencia.py`)
