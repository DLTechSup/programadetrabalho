# -*- coding: utf-8 -*-
"""
Núcleo da automação Bling — toda a lógica de leitura, análise de descrição,
agrupamento de cores e geração de código/descrição. Sem nenhuma dependência
de interface gráfica, pra poder ser reaproveitado por qualquer UI (PyQt6,
tkinter, linha de comando, etc).
"""

import os
import re
import json
import unicodedata

import pandas as pd

ESTOQUE_MINIMO = "1,00"
ESTOQUE_MAXIMO = "5,00"

TAMANHO_MIN, TAMANHO_MAX = 14, 50
TAMANHOS_LETRA = {"PP", "P", "M", "G", "GG", "XG", "XGG", "U", "UN"}

COLUNAS_COPIAR_DO_PAI = [
    "Marca",
    "Peso líquido (Kg)",
    "Peso bruto (Kg)",
    "Largura do produto",
    "Altura do Produto",
    "Profundidade do produto",
    "Volumes",
    "Itens p/ caixa",
    "Data Validade",
    "Descrição Curta",
]


# ---------------------------------------------------------------------------
# Utilidades básicas
# ---------------------------------------------------------------------------
def limpo(valor):
    if valor is None or (isinstance(valor, float) and pd.isna(valor)):
        return ""
    return str(valor).strip().strip("\t")


def _faixa(n):
    return TAMANHO_MIN <= n <= TAMANHO_MAX


def ler_planilha(caminho):
    """Lê .xls (formato que o Bling exporta) ou .xlsx, retorna DataFrame."""
    ext = os.path.splitext(caminho)[1].lower()
    if ext == ".xls":
        try:
            import xlrd
            livro = xlrd.open_workbook(caminho, ignore_workbook_corruption=True)
            df = pd.read_excel(livro, engine="xlrd", dtype=object)
        except Exception:
            raise ValueError(
                "Não consegui abrir este arquivo .xls. Solução: abra o arquivo "
                "no Excel (ou Google Sheets) e clique em Arquivo > Salvar como > "
                "Excel (.xlsx). Depois selecione esse novo arquivo .xlsx aqui "
                "no programa."
            )
    else:
        df = pd.read_excel(caminho, engine="openpyxl", dtype=object)
    df = df.where(pd.notna(df), None)
    return df


def salvar_planilha(df, caminho_saida):
    df.to_excel(caminho_saida, index=False, engine="openpyxl")


# ---------------------------------------------------------------------------
# Banco de dados de cores (aprendizado incremental)
# ---------------------------------------------------------------------------
def caminho_banco_cores(pasta_programa):
    return os.path.join(pasta_programa, "cores_bling.json")


def carregar_cores(caminho):
    if os.path.exists(caminho):
        try:
            with open(caminho, "r", encoding="utf-8") as f:
                dados = json.load(f)
        except Exception:
            dados = {}
    else:
        dados = {}
    dados.setdefault("por_marca", {})
    dados.setdefault("generico", {})
    return dados


def salvar_cores(caminho, banco):
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(banco, f, indent=2, ensure_ascii=False, sort_keys=True)


def consultar_abreviacao(banco, marca, cor):
    marca_norm = (marca or "").strip().upper()
    cor_norm = (cor or "").strip().lower()
    chave_marca = f"{marca_norm}|{cor_norm}"
    if chave_marca in banco["por_marca"]:
        return banco["por_marca"][chave_marca]
    if cor_norm in banco["generico"]:
        return banco["generico"][cor_norm]
    return None


def aprender_abreviacao(banco, marca, cor, abreviacao):
    marca_norm = (marca or "").strip().upper()
    cor_norm = (cor or "").strip().lower()
    banco["por_marca"][f"{marca_norm}|{cor_norm}"] = abreviacao
    banco["generico"][cor_norm] = abreviacao


# ---------------------------------------------------------------------------
# Análise da linha (tamanho + agrupamento de cor)
# ---------------------------------------------------------------------------
def _ultimas_palavras(texto, k=2):
    palavras = texto.split()
    return " ".join(palavras[-k:]) if palavras else ""


def tentar_via_cod_fornecedor(cod_fornecedor):
    """Fornecedores como a Olympikus usam um padrão limpo:
    'REFERENCIA-CODIGOCOR-TAMANHO', ex: '43522987-LUNMHO-38'. Retorna
    (tamanho, corcode). 'corcode' vem None quando o meio é só número (não é
    um código de cor de verdade) — mas o tamanho continua sendo aproveitado,
    por ser confiável de qualquer forma."""
    texto = str(cod_fornecedor or "").strip().strip("\t")
    m = re.match(r"^(.+)-([A-Za-z0-9]{2,10})-(\d{2})$", texto)
    if m:
        _, corcode, tamanho = m.groups()
        if _faixa(int(tamanho)):
            if re.search(r"[A-Za-z]", corcode):
                return tamanho, corcode.upper()
            return tamanho, None
    return None, None


def extrair_expansao_cor(descricao, corcode):
    """Se outra linha do mesmo grupo trouxer o nome da cor por extenso ao
    lado do código abreviado (ex: 'GRENPT GREEN PRETO'), isso vira uma
    sugestão bem melhor que o código sozinho."""
    texto = str(descricao or "").upper()
    pos = texto.find(corcode.upper())
    if pos == -1:
        return None
    resto = texto[pos + len(corcode):].strip()
    resto = re.sub(r"\b\d{2}\b\s*$", "", resto).strip()
    resto = re.sub(r"\s{2,}", " ", resto)
    if resto and not resto.replace(" ", "").isdigit():
        return resto.title()
    return None


def analisar_descricao(descricao):
    """Tenta reconhecer o tamanho e sugerir um agrupamento de cor a partir
    da descrição crua do fornecedor. Retorna (tamanho, chave_grupo,
    sugestao_cor). 'chave_grupo' é usada só para AGRUPAR linhas da mesma cor
    (baseada no texto completo, por isso é confiável mesmo quando a
    'sugestao' não é perfeita); 'sugestao_cor' é o texto pré-preenchido,
    sempre editável pelo usuário antes de confirmar."""
    texto = str(descricao or "").strip()
    if not texto:
        return "", "", ""

    # 1. tamanho em par "NN/NN" (comum em calçado infantil), em qualquer
    #    posição do texto — pode vir seguido de cor (ex: "33/34 PRETO")
    m = re.search(r"(?:\bN\s+)?(\d{2}/\d{2})\b", texto)
    if m:
        tamanho = m.group(1)
        antes = texto[: m.start()].strip()
        depois = texto[m.end():].strip()
        antes = re.sub(r"\b\d[\d.\-]{2,}\b", "", antes).strip()
        depois = re.sub(r"\b\d[\d.\-]{2,}\b", "", depois).strip()
        # se tiver texto substancial depois do tamanho, é mais provável ser a cor
        if depois and not depois.replace(" ", "").isdigit():
            chave, sugestao = depois.upper(), depois.title()
        else:
            chave, sugestao = antes.upper(), _ultimas_palavras(antes).title()
        return tamanho, chave, sugestao

    # 2. marcador "TAM.=NN." — cor vem DEPOIS do marcador
    m = re.search(r"\bTAM\.?\s*=\s*(\d{2})\.?", texto, re.IGNORECASE)
    if m and _faixa(int(m.group(1))):
        tamanho = m.group(1)
        depois = texto[m.end():].strip()
        depois = re.sub(r"\b\d[\d.\-]{2,}\b\s*$", "", depois).strip()
        return tamanho, depois.upper(), depois.title()

    # 3. "NN=N" (opcionalmente seguido de "COMBn:") — Suzana Santos / Renata Mello
    m = re.search(r"\b(\d{2})=\d+\b", texto)
    if m and _faixa(int(m.group(1))):
        tamanho = m.group(1)
        depois = texto[m.end():].strip()
        m_comb = re.match(r"COMB\d*:\s*(.+)$", depois, re.IGNORECASE)
        cor_texto = m_comb.group(1).strip() if m_comb else depois
        return tamanho, cor_texto.upper(), cor_texto.title()

    # 4. marcador "tam:" / "tam." / "tamanho:" — cor vem ANTES (ou após "CAB")
    m = re.search(r"\btam\.?a?n?h?o?:?\s*(\d{2})\b", texto, re.IGNORECASE)
    if m and _faixa(int(m.group(1))):
        tamanho = m.group(1)
        antes = texto[: m.start()].strip()
        depois = texto[m.end():].strip()
        residual = (antes + " " + depois).strip()
        residual = re.sub(r"\b\d[\d.,/]{1,}\b", "", residual).strip()
        residual = re.sub(r"\s{2,}", " ", residual)

        m_cab = re.search(r"\bCAB\.?E?D?A?L?\.?\s+(.+)$", antes, re.IGNORECASE)
        if m_cab:
            candidato = m_cab.group(1).strip()
            palavras = candidato.split()
            while palavras and re.match(r"^[\d.,/]+$", palavras[-1]):
                palavras.pop()
            sugestao = " ".join(palavras).title() if palavras else residual.title()
        else:
            sugestao = residual.title() if residual else ""
        return tamanho, residual.upper(), sugestao

    tokens = texto.split()
    if tokens:
        ultimo = tokens[-1]

        # 5. último token = tamanho numérico (2 dígitos) ou tamanho em letra (P/M/G/GG/U...)
        if (re.match(r"^\d{2}$", ultimo) and _faixa(int(ultimo))) or ultimo.upper() in TAMANHOS_LETRA:
            tamanho = ultimo if ultimo.upper() not in TAMANHOS_LETRA else ultimo.upper()
            antes = texto[: -len(ultimo)].strip()
            antes = re.sub(r"\b\d[\d.\-]{2,}\b", "", antes).strip()
            antes = re.sub(r"\s{2,}", " ", antes)
            return tamanho, antes.upper(), _ultimas_palavras(antes).title()

        # 6. 4 dígitos colados sem separador = par sem barra (ex: "3334" -> "33/34")
        if re.match(r"^\d{4}$", ultimo):
            a, b = int(ultimo[:2]), int(ultimo[2:])
            if _faixa(a) and _faixa(b) and b - a in (0, 1):
                tamanho = f"{a}/{b}"
                antes = texto[: -len(ultimo)].strip()
                antes = re.sub(r"\b\d[\d.\-]{2,}\b", "", antes).strip()
                antes = re.sub(r"\s{2,}", " ", antes)
                return tamanho, antes.upper(), _ultimas_palavras(antes).title()

    return "", texto.upper(), ""


def _sugestao_valida(sugestao):
    """Uma sugestão só números/pontuação (ex: '38', '1137') não é um nome de
    cor válido — melhor deixar em branco pra você preencher do que mostrar
    algo confuso."""
    if not sugestao or not sugestao.strip():
        return ""
    if not re.search(r"[A-Za-zÀ-ÿ]", sugestao):
        return ""
    return sugestao


def analisar_linha(descricao, cod_fornecedor):
    """Combina as duas estratégias: tenta primeiro o 'Cód. no fornecedor'
    (mais confiável quando disponível nesse formato) e cai para a análise
    da Descrição quando não bate, ou quando o código do meio não é uma cor
    válida (só número). Retorna (tamanho, chave_grupo, sugestao,
    veio_do_cod_fornecedor)."""
    tamanho_cf, corcode = tentar_via_cod_fornecedor(cod_fornecedor)

    if tamanho_cf and corcode:
        sugestao = _sugestao_valida(extrair_expansao_cor(descricao, corcode) or corcode.title())
        return tamanho_cf, corcode, sugestao, True

    tamanho_desc, chave, sugestao = analisar_descricao(descricao)
    sugestao = _sugestao_valida(sugestao)
    if tamanho_cf and not tamanho_desc:
        # o cód. fornecedor deu um tamanho confiável, mas a cor precisa vir
        # do texto (que não achou nada) -- usa o tamanho mesmo assim
        chave = chave or tamanho_cf
        return tamanho_cf, chave, sugestao, False
    return tamanho_desc, chave, sugestao, False


def limpar_nome_cor(texto):
    """Remove prefixos/sufixos residuais tipo 'Cor:' ou ';Tamanho:37' que às
    vezes já vêm dentro da própria descrição do fornecedor."""
    t = str(texto or "").strip()
    t = re.sub(r"(?i)^cor\s*:\s*", "", t)
    t = re.sub(r"(?i)\s*;?\s*tamanho\s*:.*$", "", t)
    t = t.strip(" ;:")
    return t


# ---------------------------------------------------------------------------
# Detecção e criação do PAI
# ---------------------------------------------------------------------------
def detectar_linha_pai(df):
    """Retorna o índice da linha do PAI, ou None. Prioriza a linha que já
    tem 'Código' preenchido (sinal mais confiável — variações sempre
    começam com Código em branco). Só usa Marca+Categoria como método
    auxiliar quando isso não resolve sozinho (algumas marcas já vêm com
    Marca/Categoria preenchidas em TODAS as linhas, não só no PAI)."""
    com_codigo = [i for i, row in df.iterrows() if limpo(row.get("Código"))]
    if len(com_codigo) == 1:
        return com_codigo[0]
    if len(com_codigo) > 1:
        for i in com_codigo:
            row = df.loc[i]
            if limpo(row.get("Marca")) and limpo(row.get("Categoria do produto")):
                return i
        return com_codigo[0]
    for i, row in df.iterrows():
        if limpo(row.get("Marca")) and limpo(row.get("Categoria do produto")):
            return i
    return None


def criar_linha_pai(df, dados):
    """Adiciona uma nova linha de PAI ao DataFrame a partir dos dados
    informados manualmente. Código e Descrição ficam em branco de
    propósito — o Código do PAI é o que dá origem ao SKU das variações."""
    nova = {col: None for col in df.columns}
    nova["Marca"] = dados["marca"]
    nova["Categoria do produto"] = None  # categoria fica só nos filhos
    nova["Peso líquido (Kg)"] = dados["peso_liquido"]
    nova["Peso bruto (Kg)"] = dados["peso_bruto"]
    nova["Largura do produto"] = dados["largura"]
    nova["Altura do Produto"] = dados["altura"]
    nova["Profundidade do produto"] = dados["profundidade"]
    nova["Volumes"] = dados["volumes"]
    nova["Itens p/ caixa"] = dados["itens_caixa"]
    nova["GTIN/EAN"] = ""
    nova["GTIN/EAN da Embalagem"] = ""
    nova["Estoque mínimo"] = ESTOQUE_MINIMO
    nova["Estoque máximo"] = ESTOQUE_MAXIMO
    if dados.get("data_validade"):
        nova["Data Validade"] = dados["data_validade"]
    if dados.get("codigo"):
        nova["Código"] = dados["codigo"]
    if dados.get("descricao"):
        nova["Descrição"] = dados["descricao"]
    df.loc[len(df)] = nova
    return len(df) - 1


def processar_variacoes(df, linha_pai_idx, categoria, log=lambda m: None):
    """Preenche todas as colunas 'de apoio' (peso, dimensões, marca,
    categoria, estoque, validade, descrição curta) em todas as linhas
    filhas, a partir dos dados da linha do PAI. 'Código' e 'Descrição'
    de cada variação continuam sendo gerados à parte, pela tela de cores."""
    pai_row = df.loc[linha_pai_idx]
    pai = {c: pai_row.get(c) for c in COLUNAS_COPIAR_DO_PAI}
    codigo_pai = limpo(pai_row.get("Código"))

    df.at[linha_pai_idx, "Categoria do produto"] = None
    df.at[linha_pai_idx, "Estoque mínimo"] = ESTOQUE_MINIMO
    df.at[linha_pai_idx, "Estoque máximo"] = ESTOQUE_MAXIMO

    total = 0
    for i, row in df.iterrows():
        if i == linha_pai_idx:
            continue
        df.at[i, "Categoria do produto"] = categoria
        for coluna in COLUNAS_COPIAR_DO_PAI:
            df.at[i, coluna] = pai[coluna]
        df.at[i, "Estoque mínimo"] = ESTOQUE_MINIMO
        df.at[i, "Estoque máximo"] = ESTOQUE_MAXIMO
        if codigo_pai:
            df.at[i, "Código Pai"] = codigo_pai
        total += 1

    log(f"{total} variação(ões) preenchida(s) com os dados do PAI.")
    if codigo_pai:
        log(f"Código Pai preenchido em todas as variações: {codigo_pai}")
    else:
        log("O PAI ainda não tem 'Código' preenchido — gere/gere o código do PAI antes de gerar os SKUs das variações.")
    return df


def agrupar_variacoes(df, linha_pai_idx):
    """Analisa todas as linhas filhas e agrupa por cor detectada. Retorna
    (analisadas, grupos) onde 'analisadas' é {indice: (tamanho, chave,
    sugestao)} e 'grupos' é {chave: {"sugestao":, "indices":, "tamanhos":}}."""
    analisadas = {}
    grupos = {}
    for i, row in df.iterrows():
        if i == linha_pai_idx:
            continue
        cod_fornecedor = row.get("Cód. no fornecedor")
        tamanho, chave, sugestao, veio_cod = analisar_linha(row.get("Descrição"), cod_fornecedor)
        analisadas[i] = (tamanho, chave, sugestao)
        grupo = grupos.setdefault(chave, {"sugestao": sugestao, "indices": [], "tamanhos": []})
        grupo["indices"].append(i)
        grupo["tamanhos"].append(tamanho or "?")
        if veio_cod and len(sugestao) > len(grupo["sugestao"]):
            grupo["sugestao"] = sugestao
    return analisadas, grupos


def gerar_codigo_e_descricao(df, analisadas, grupos, codigo_pai, cores_por_grupo, banco_cores, marca):
    """Aplica as cores confirmadas pelo usuário (cores_por_grupo: {chave:
    (cor, abreviacao)}) e escreve Código/Descrição em cada linha filha.
    Retorna (total_preenchido, linhas_sem_tamanho)."""
    total = 0
    linhas_sem_tamanho = []
    for chave, (cor, abrev) in cores_por_grupo.items():
        cor = limpar_nome_cor(cor)
        abrev = (abrev or "").strip().upper()
        if not cor or not abrev:
            continue
        aprender_abreviacao(banco_cores, marca, cor, abrev)
        for i in grupos[chave]["indices"]:
            tamanho = analisadas[i][0]
            if not tamanho:
                linhas_sem_tamanho.append(i + 2)
                continue
            df.at[i, "Código"] = f"{codigo_pai}{abrev}{tamanho}"
            df.at[i, "Descrição"] = f"Cor:{cor};Tamanho:{tamanho}"
            total += 1
    return total, linhas_sem_tamanho
