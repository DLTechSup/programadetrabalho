# Automação Bling v2 — com interface PyQt6

## O que mudou nessa versão
- Reconhecimento de cor/tamanho totalmente reescrito e testado contra **1683
  arquivos reais** do seu histórico (48 marcas) — taxa de acerto de **99,4%**
  na identificação automática do tamanho.
- Suporte a vários formatos de descrição diferentes ao mesmo tempo: "tam:",
  "TAM.=NN.", "NN=N COMBn:", tamanhos duplos "33/34", tamanhos colados
  "3334", tamanhos em letra (P/M/G/GG/U), e o "Cód. no fornecedor"
  estruturado (Olympikus e outras).
- **Banco de cores pré-populado**: extraí automaticamente 12 mil pares reais
  (marca + cor → abreviação) de todo o seu histórico de arquivos já prontos.
  O programa já nasce sabendo a abreviação de 745 combinações marca+cor que
  você já usou antes.
- Interface nova, em PyQt6, com visual mais profissional (cartões, cores,
  tipografia consistente) em vez da janela simples de antes.
- Arquivos separados: `nucleo.py` (toda a lógica) e `app_bling_qt.py` (só a
  interface) — mais fácil de manter e evoluir.

## Arquivos deste pacote
- `nucleo.py` — lógica de leitura, análise e geração (não mexer, a menos que eu peça)
- `app_bling_qt.py` — a interface gráfica (é esse que você roda)
- `cores_bling_seed.json` — banco de cores inicial com seu histórico

## Instalação (uma vez só)

1. **Python**: https://www.python.org/downloads/ — no instalador do Windows,
   marque **"Add python.exe to PATH"**.
2. Coloque os 3 arquivos deste pacote **na mesma pasta**.
3. Abra o terminal nessa pasta (Windows: digite `cmd` na barra de endereço do
   Explorador de Arquivos) e instale as bibliotecas:
   ```bash
   python -m pip install PyQt6 pandas openpyxl xlrd
   ```

## Como abrir

```bash
python app_bling_qt.py
```

## Como usar

1. **Selecionar arquivo...** → escolha o `.xls` ou `.xlsx` exportado do Bling.
2. O programa preenche sozinho: marca, categoria, peso, dimensões, volumes,
   itens por caixa, validade, descrição curta, estoque mín/máx e Código Pai.
   - Se não achar nenhum PAI já cadastrado, abre uma telinha pedindo os
     dados básicos pra criar essa linha.
3. Abre a tela **"Confirmar cores detectadas"**: uma linha por cor (não por
   tamanho). O nome já vem sugerido, e a abreviação já vem pré-preenchida
   se essa cor (dessa marca, ou de qualquer marca) já tiver sido usada
   antes.
4. **Gerar Código e Descrição** → aplica em todas as variações daquela cor
   de uma vez, e aprende qualquer abreviação nova pra próxima vez.
5. **Salvar planilha pronta...** → escolha onde salvar.
6. Confira e importe no Bling normalmente.

## Gerando o .exe

Na mesma pasta:
```bash
python -m pip install pyinstaller
python -m PyInstaller --onefile --windowed --name AutomacaoBling --add-data "cores_bling_seed.json;." app_bling_qt.py
```

O `--add-data "cores_bling_seed.json;."` é importante — sem ele o `.exe`
não leva o banco de cores inicial junto. O executável final aparece em
`dist\AutomacaoBling.exe`.

Pra atualizar o `.exe` depois de qualquer ajuste que eu fizer no código:
```bash
rmdir /s /q build
rmdir /s /q dist
del AutomacaoBling.spec
python -m PyInstaller --onefile --windowed --name AutomacaoBling --add-data "cores_bling_seed.json;." app_bling_qt.py
```

## Sobre o banco de cores
Fica salvo em `cores_bling.json`, na mesma pasta do programa (ou do `.exe`),
e cresce sozinho conforme você usa. Ele já nasce com as 745 combinações
marca+cor extraídas do seu histórico — muitas cores você não vai nem
precisar digitar abreviação, ela já vem certa.

## O que ainda pode escapar
Cerca de 0,6% das descrições do seu histórico não seguem nenhum dos
padrões reconhecidos (a maioria são produtos que não são calçado — bolsas,
roupas, mochilas com tamanho único). Se aparecer alguma cor/tamanho que o
programa não reconheça, ele avisa exatamente qual linha ficou faltando —
me manda o arquivo que eu ensino o padrão nível.
