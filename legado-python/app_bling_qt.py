# -*- coding: utf-8 -*-
"""
Automação Bling v2 — interface em PyQt6
==========================================
Fluxo:
  1. Selecionar arquivo (.xls ou .xlsx) exportado do Bling
  2. Preenchimento automático dos campos de apoio (peso, marca, categoria,
     dimensões, estoque, validade, descrição curta, Código Pai)
  3. Tela de confirmação de cores (agrupadas automaticamente) -> gera
     Código e Descrição de cada variação
  4. Salvar
"""

import os
import sys

from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont, QColor, QPalette
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QTextEdit, QFileDialog, QMessageBox, QDialog, QLineEdit,
    QScrollArea, QFrame, QFormLayout, QGridLayout, QSizePolicy, QGraphicsDropShadowEffect,
)

import nucleo


# ---------------------------------------------------------------------------
# Paleta / estilo
# ---------------------------------------------------------------------------
COR_PRIMARIA = "#2F6FED"
COR_PRIMARIA_HOVER = "#255CC7"
COR_FUNDO = "#F5F7FB"
COR_CARTAO = "#FFFFFF"
COR_TEXTO = "#1F2430"
COR_TEXTO_SUAVE = "#6B7280"
COR_BORDA = "#E3E7EF"
COR_SUCESSO = "#1EA672"
COR_ALERTA = "#D97706"

FOLHA_ESTILO = f"""
QWidget {{
    background-color: {COR_FUNDO};
    color: {COR_TEXTO};
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 14px;
}}
QLabel#titulo {{
    font-size: 20px;
    font-weight: 600;
}}
QLabel#subtitulo {{
    color: {COR_TEXTO_SUAVE};
    font-size: 13px;
}}
QFrame#cartao {{
    background-color: {COR_CARTAO};
    border-radius: 10px;
    border: 1px solid {COR_BORDA};
}}
QPushButton {{
    background-color: {COR_PRIMARIA};
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 18px;
    font-weight: 600;
}}
QPushButton:hover {{
    background-color: {COR_PRIMARIA_HOVER};
}}
QPushButton:disabled {{
    background-color: #C7CEDB;
    color: #F0F1F4;
}}
QPushButton#secundario {{
    background-color: transparent;
    color: {COR_PRIMARIA};
    border: 1px solid {COR_PRIMARIA};
}}
QPushButton#secundario:hover {{
    background-color: #EAF1FF;
}}
QTextEdit {{
    background-color: #0F1720;
    color: #D7E3F4;
    border-radius: 8px;
    padding: 10px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 12px;
}}
QLineEdit {{
    border: 1px solid {COR_BORDA};
    border-radius: 6px;
    padding: 6px 8px;
    background-color: white;
}}
QLineEdit:focus {{
    border: 1px solid {COR_PRIMARIA};
}}
QScrollArea {{
    border: none;
}}
"""


def cartao(widget_interno):
    """Envolve um widget num 'cartão' com sombra suave, dando aparência mais profissional."""
    frame = QFrame()
    frame.setObjectName("cartao")
    layout = QVBoxLayout(frame)
    layout.addWidget(widget_interno)
    sombra = QGraphicsDropShadowEffect()
    sombra.setBlurRadius(18)
    sombra.setOffset(0, 3)
    sombra.setColor(QColor(31, 36, 48, 35))
    frame.setGraphicsEffect(sombra)
    return frame


def pasta_do_programa():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------------------
# Diálogo: dados do PAI (quando ainda não existe)
# ---------------------------------------------------------------------------
class DialogoNovoPai(QDialog):
    CAMPOS = [
        ("codigo", "Código do PAI (SKU) — deixe em branco se ainda não decidiu"),
        ("descricao", "Descrição completa do produto"),
        ("marca", "Marca *"),
        ("categoria", "Categoria (ex: Sandalia, Chinelo, Bota) *"),
        ("peso_liquido", "Peso líquido (Kg) *"),
        ("peso_bruto", "Peso bruto (Kg) *"),
        ("largura", "Largura do produto (cm) *"),
        ("altura", "Altura do produto (cm) *"),
        ("profundidade", "Profundidade do produto (cm) *"),
        ("volumes", "Volumes *"),
        ("itens_caixa", "Itens por caixa *"),
        ("data_validade", "Data de validade (opcional)"),
    ]
    OBRIGATORIOS = {"marca", "categoria", "peso_liquido", "peso_bruto", "largura", "altura", "profundidade", "volumes", "itens_caixa"}

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Criar PAI")
        self.setMinimumWidth(460)
        self.dados = None

        layout = QVBoxLayout(self)
        aviso = QLabel(
            "Não encontrei um PAI já cadastrado neste arquivo.\n"
            "Preencha os dados abaixo pra criar essa linha:"
        )
        aviso.setWordWrap(True)
        aviso.setStyleSheet("font-weight: 600;")
        layout.addWidget(aviso)

        form = QFormLayout()
        self.campos = {}
        for chave, rotulo in self.CAMPOS:
            entrada = QLineEdit()
            self.campos[chave] = entrada
            form.addRow(rotulo, entrada)
        layout.addLayout(form)

        botoes = QHBoxLayout()
        botoes.addStretch()
        btn_cancelar = QPushButton("Cancelar")
        btn_cancelar.setObjectName("secundario")
        btn_cancelar.clicked.connect(self.reject)
        btn_ok = QPushButton("Criar PAI e continuar")
        btn_ok.clicked.connect(self._confirmar)
        botoes.addWidget(btn_cancelar)
        botoes.addWidget(btn_ok)
        layout.addLayout(botoes)

    def _confirmar(self):
        valores = {chave: campo.text().strip() for chave, campo in self.campos.items()}
        faltando = [rotulo for chave, rotulo in self.CAMPOS if chave in self.OBRIGATORIOS and not valores[chave]]
        if faltando:
            QMessageBox.warning(self, "Campos obrigatórios", "Preencha:\n" + "\n".join(faltando))
            return
        self.dados = valores
        self.accept()


# ---------------------------------------------------------------------------
# Tela: confirmar cores detectadas
# ---------------------------------------------------------------------------
class TelaCores(QDialog):
    def __init__(self, df, linha_pai_idx, codigo_pai, marca, banco_cores, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Confirmar cores detectadas")
        self.resize(880, 620)
        self.df = df
        self.linha_pai_idx = linha_pai_idx
        self.codigo_pai = codigo_pai
        self.marca = marca
        self.banco_cores = banco_cores
        self.resultado_ok = False
        self.linhas_sem_tamanho = []

        self.analisadas, self.grupos = nucleo.agrupar_variacoes(df, linha_pai_idx)

        layout = QVBoxLayout(self)
        titulo = QLabel(
            f"PAI: {codigo_pai or '(sem código ainda)'} — {len(self.grupos)} cor(es) detectada(s) automaticamente"
        )
        titulo.setObjectName("titulo")
        layout.addWidget(titulo)
        sub = QLabel("Confira/edite o nome de cada cor e digite a abreviação (uma vez por cor, não por tamanho).")
        sub.setObjectName("subtitulo")
        sub.setWordWrap(True)
        layout.addWidget(sub)

        cabecalho = QHBoxLayout()
        for texto, largura in [("COR (confira/edite)", 260), ("ABREVIAÇÃO", 140), ("TAMANHOS ENCONTRADOS", 320), ("QTD.", 60)]:
            lbl = QLabel(texto)
            lbl.setStyleSheet("font-weight: 700; color: #6B7280; font-size: 11px;")
            lbl.setFixedWidth(largura)
            cabecalho.addWidget(lbl)
        cabecalho.addStretch()
        layout.addLayout(cabecalho)

        area_scroll = QScrollArea()
        area_scroll.setWidgetResizable(True)
        conteudo = QWidget()
        self.grid = QVBoxLayout(conteudo)
        self.grid.setSpacing(6)

        self.linhas_widgets = []
        for chave, info in sorted(self.grupos.items()):
            linha = QHBoxLayout()
            entrada_cor = QLineEdit(info["sugestao"])
            entrada_cor.setFixedWidth(260)

            entrada_abrev = QLineEdit()
            entrada_abrev.setFixedWidth(140)
            abrev_conhecida = nucleo.consultar_abreviacao(self.banco_cores, self.marca, info["sugestao"])
            if abrev_conhecida:
                entrada_abrev.setText(abrev_conhecida)

            tamanhos_txt = ", ".join(sorted(set(info["tamanhos"]), key=lambda x: (len(x), x)))
            lbl_tamanhos = QLabel(tamanhos_txt)
            lbl_tamanhos.setFixedWidth(320)
            lbl_tamanhos.setStyleSheet("color: #6B7280; font-size: 12px;")

            lbl_qtd = QLabel(str(len(info["indices"])))
            lbl_qtd.setFixedWidth(60)

            linha.addWidget(entrada_cor)
            linha.addWidget(entrada_abrev)
            linha.addWidget(lbl_tamanhos)
            linha.addWidget(lbl_qtd)
            linha.addStretch()
            self.grid.addLayout(linha)
            self.linhas_widgets.append((chave, entrada_cor, entrada_abrev))

        self.grid.addStretch()
        area_scroll.setWidget(conteudo)
        layout.addWidget(area_scroll, stretch=1)

        dica = QLabel(
            "Se alguma cor ficou dividida em 2 linhas por engano, ou juntou 2 cores diferentes numa só, "
            "guarde esse arquivo pra me mostrar depois — ajusto a regra de agrupamento."
        )
        dica.setObjectName("subtitulo")
        dica.setWordWrap(True)
        layout.addWidget(dica)

        botoes = QHBoxLayout()
        botoes.addStretch()
        btn_cancelar = QPushButton("Cancelar")
        btn_cancelar.setObjectName("secundario")
        btn_cancelar.clicked.connect(self.reject)
        btn_gerar = QPushButton("Gerar Código e Descrição")
        btn_gerar.clicked.connect(self._gerar)
        botoes.addWidget(btn_cancelar)
        botoes.addWidget(btn_gerar)
        layout.addLayout(botoes)

    def _gerar(self):
        cores_por_grupo = {}
        vazios = 0
        for chave, entrada_cor, entrada_abrev in self.linhas_widgets:
            cor = entrada_cor.text().strip()
            abrev = entrada_abrev.text().strip()
            if not cor or not abrev:
                vazios += 1
                continue
            cores_por_grupo[chave] = (cor, abrev)

        if vazios:
            resp = QMessageBox.question(
                self, "Cores incompletas",
                f"{vazios} grupo(s) de cor estão sem nome ou sem abreviação e vão ficar "
                f"sem Código/Descrição. Continuar mesmo assim?",
            )
            if resp != QMessageBox.StandardButton.Yes:
                return

        total, linhas_sem_tamanho = nucleo.gerar_codigo_e_descricao(
            self.df, self.analisadas, self.grupos, self.codigo_pai,
            cores_por_grupo, self.banco_cores, self.marca,
        )
        self.total_gerado = total
        self.linhas_sem_tamanho = linhas_sem_tamanho
        self.resultado_ok = True
        self.accept()


# ---------------------------------------------------------------------------
# Janela principal
# ---------------------------------------------------------------------------
class JanelaPrincipal(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Automação Bling")
        self.resize(760, 620)

        self.df_atual = None
        self.nome_sugerido = "planilha_preenchida.xlsx"
        self.caminho_cores = nucleo.caminho_banco_cores(pasta_do_programa())
        self.banco_cores = nucleo.carregar_cores(self.caminho_cores)

        # se ainda não existe nenhum banco de cores local, usa o seed (se disponível)
        if not self.banco_cores["por_marca"] and not self.banco_cores["generico"]:
            caminho_seed = os.path.join(pasta_do_programa(), "cores_bling_seed.json")
            if os.path.exists(caminho_seed):
                self.banco_cores = nucleo.carregar_cores(caminho_seed)
                nucleo.salvar_cores(self.caminho_cores, self.banco_cores)

        central = QWidget()
        self.setCentralWidget(central)
        layout_ext = QVBoxLayout(central)
        layout_ext.setContentsMargins(24, 24, 24, 24)
        layout_ext.setSpacing(16)

        titulo = QLabel("Automação de preenchimento — planilha do Bling")
        titulo.setObjectName("titulo")
        layout_ext.addWidget(titulo)

        subtitulo = QLabel("Selecione o arquivo exportado do Bling (.xls ou .xlsx) pra começar.")
        subtitulo.setObjectName("subtitulo")
        layout_ext.addWidget(subtitulo)

        conteudo_cartao = QWidget()
        layout_cartao = QVBoxLayout(conteudo_cartao)

        linha_botao = QHBoxLayout()
        self.btn_selecionar = QPushButton("📂  Selecionar arquivo...")
        self.btn_selecionar.clicked.connect(self.selecionar_arquivo)
        linha_botao.addWidget(self.btn_selecionar)
        self.label_arquivo = QLabel("Nenhum arquivo selecionado")
        self.label_arquivo.setObjectName("subtitulo")
        linha_botao.addWidget(self.label_arquivo)
        linha_botao.addStretch()
        layout_cartao.addLayout(linha_botao)

        self.log_box = QTextEdit()
        self.log_box.setReadOnly(True)
        self.log_box.setMinimumHeight(360)
        layout_cartao.addWidget(self.log_box)

        linha_salvar = QHBoxLayout()
        linha_salvar.addStretch()
        self.btn_salvar = QPushButton("💾  Salvar planilha pronta...")
        self.btn_salvar.setEnabled(False)
        self.btn_salvar.clicked.connect(self.salvar_como)
        linha_salvar.addWidget(self.btn_salvar)
        layout_cartao.addLayout(linha_salvar)

        layout_ext.addWidget(cartao(conteudo_cartao), stretch=1)

        rodape = QLabel(f"Banco de cores: {self.caminho_cores}")
        rodape.setStyleSheet("color: #9AA3B2; font-size: 11px;")
        layout_ext.addWidget(rodape)

    def log(self, mensagem):
        self.log_box.append(mensagem)

    def selecionar_arquivo(self):
        caminho, _ = QFileDialog.getOpenFileName(
            self, "Selecione o arquivo exportado do Bling", "", "Planilhas Excel (*.xlsx *.xls);;Todos os arquivos (*.*)"
        )
        if not caminho:
            return

        self.label_arquivo.setText(os.path.basename(caminho))
        self.log_box.clear()
        self.btn_salvar.setEnabled(False)
        self.df_atual = None

        base = os.path.splitext(os.path.basename(caminho))[0]
        self.nome_sugerido = f"{base}_PRONTO_PARA_IMPORTAR.xlsx"

        self.log(f"Lendo arquivo: {caminho}")
        try:
            df = nucleo.ler_planilha(caminho)
        except Exception as e:
            self.log(f"\nERRO: {e}")
            QMessageBox.critical(self, "Erro ao ler arquivo", str(e))
            return

        df["Código"] = df["Código"].apply(nucleo.limpo)
        linha_pai_idx = nucleo.detectar_linha_pai(df)

        if linha_pai_idx is not None:
            codigo_pai = nucleo.limpo(df.loc[linha_pai_idx, "Código"])
            rotulo = codigo_pai if codigo_pai else "(ainda sem código)"
            self.log(f"PAI encontrado na linha {linha_pai_idx + 2}: código = {rotulo}")
            categoria = nucleo.limpo(df.loc[linha_pai_idx, "Categoria do produto"])
            self._processar_e_abrir_cores(df, linha_pai_idx, categoria)
        else:
            self.log("Nenhum PAI já cadastrado foi encontrado neste arquivo.")
            dialogo = DialogoNovoPai(self)
            if dialogo.exec() == QDialog.DialogCode.Accepted and dialogo.dados:
                idx = nucleo.criar_linha_pai(df, dialogo.dados)
                self.log("PAI criado numa nova linha.")
                self._processar_e_abrir_cores(df, idx, dialogo.dados["categoria"])

    def _processar_e_abrir_cores(self, df, linha_pai_idx, categoria):
        try:
            df = nucleo.processar_variacoes(df, linha_pai_idx, categoria, self.log)
        except Exception as e:
            self.log(f"\nERRO: {e}")
            QMessageBox.critical(self, "Erro ao processar", str(e))
            return

        codigo_pai = nucleo.limpo(df.loc[linha_pai_idx, "Código"])
        marca = nucleo.limpo(df.loc[linha_pai_idx, "Marca"])

        if not codigo_pai:
            self.log(
                "\nO PAI ainda não tem 'Código' preenchido — não dá pra gerar os "
                "códigos das variações ainda. Preencha o Código do PAI, exporte de "
                "novo e rode o programa novamente."
            )
            self.df_atual = df
            self.btn_salvar.setEnabled(True)
            return

        tela_cores = TelaCores(df, linha_pai_idx, codigo_pai, marca, self.banco_cores, self)
        if tela_cores.exec() == QDialog.DialogCode.Accepted and tela_cores.resultado_ok:
            nucleo.salvar_cores(self.caminho_cores, self.banco_cores)
            self.log(f"\n{tela_cores.total_gerado} variação(ões) preenchida(s) com Código e Descrição.")
            if tela_cores.linhas_sem_tamanho:
                self.log(
                    f"ATENÇÃO: não identifiquei o tamanho automaticamente nas linhas "
                    f"{tela_cores.linhas_sem_tamanho} — preencha essas manualmente."
                )
            self.df_atual = df
            self.btn_salvar.setEnabled(True)
            self.log("\nPronto! Clique em 'Salvar planilha pronta...' para escolher onde salvar.")
        else:
            self.df_atual = df
            self.btn_salvar.setEnabled(True)
            self.log("\nGeração de cores cancelada — os demais campos já preenchidos continuam disponíveis para salvar.")

    def salvar_como(self):
        if self.df_atual is None:
            return
        caminho_saida, _ = QFileDialog.getSaveFileName(
            self, "Salvar planilha pronta para importar", self.nome_sugerido, "Planilha Excel (*.xlsx)"
        )
        if not caminho_saida:
            return
        try:
            nucleo.salvar_planilha(self.df_atual, caminho_saida)
            self.log(f"\nArquivo salvo em: {caminho_saida}")
            QMessageBox.information(self, "Sucesso", f"Planilha salva em:\n{caminho_saida}")
        except Exception as e:
            QMessageBox.critical(self, "Erro ao salvar", str(e))


def main():
    app = QApplication(sys.argv)
    app.setStyleSheet(FOLHA_ESTILO)
    janela = JanelaPrincipal()
    janela.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
