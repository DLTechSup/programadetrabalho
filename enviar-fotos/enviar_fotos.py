"""Enviar Fotos: envia uma pasta (Marca / Referência / arquivos) para o Google Drive.

Roda sem supervisão: depois de clicar em "Compartilhar" ninguém precisa ficar na frente.
Falhas de rede pausam e retomam sozinhas; reabrir o programa continua de onde parou.
"""
import io
import json
import logging
import mimetypes
import os
import queue
import socket
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime
from logging.handlers import RotatingFileHandler

import google_auth_httplib2
import httplib2
from google.auth.exceptions import GoogleAuthError, RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload

# ----------------------------------------------------------------------------
# Configuração
# ----------------------------------------------------------------------------
STATUS_URL = ""  # URL "raw" de um arquivo de texto com "ativo" ou "desativado". Vazio = sem interruptor.
NOME_DESTINATARIO = "o responsável pelo projeto"  # aparece na tela: para quem as fotos vão
PASTA_DESTINO = "Fotos da Loja"  # pasta raiz no Drive
TAMANHO_CHUNK = 5 * 1024 * 1024
PROGRESSO_A_CADA_ARQUIVOS = 25
PROGRESSO_A_CADA_SEGUNDOS = 60
INTERVALO_STATUS_SEGUNDOS = 60
FECHAR_SOZINHO_SEGUNDOS = 60  # 0 = não fecha sozinho
NOME_PROGRESSO = "_progresso.txt"

ESCOPOS = ["https://www.googleapis.com/auth/drive.file"]
IGNORADOS = {"thumbs.db", "desktop.ini", ".ds_store"}
MIME_PASTA = "application/vnd.google-apps.folder"
MOTIVOS_QUOTA = {"storageQuotaExceeded", "quotaExceeded", "teamDriveFileLimitExceeded"}
TAMANHO_MAX_LOG = 2 * 1024 * 1024


# ----------------------------------------------------------------------------
# Utilitários
# ----------------------------------------------------------------------------
def pasta_do_programa():
    """Pasta do .exe (ou do script), onde fica o log."""
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def caminho_recurso(nome):
    base = getattr(sys, "_MEIPASS", None) or os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, nome)


def configurar_log():
    log = logging.getLogger("enviar_fotos")
    if log.handlers:
        return log
    log.setLevel(logging.INFO)
    destino = os.path.join(pasta_do_programa(), "log_envio.txt")
    try:
        handler = RotatingFileHandler(destino, maxBytes=TAMANHO_MAX_LOG, backupCount=1, encoding="utf-8")
    except OSError:  # pasta sem permissão de escrita
        handler = RotatingFileHandler(os.path.join(tempfile.gettempdir(), "log_envio.txt"),
                                      maxBytes=TAMANHO_MAX_LOG, backupCount=1, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(message)s", "%d/%m/%Y %H:%M:%S"))
    log.addHandler(handler)
    return log


def escapar_consulta(texto):
    """Escapa um valor para uso entre aspas simples numa consulta (q=) do Drive."""
    return texto.replace("\\", "\\\\").replace("'", "\\'")


def formatar_tamanho(n):
    for unidade in ("B", "KB", "MB", "GB"):
        if n < 1024 or unidade == "GB":
            return f"{n:.0f} {unidade}" if unidade == "B" else f"{n:.2f} {unidade}"
        n /= 1024


def impedir_suspensao(ligar):
    """Mantém o Windows acordado enquanto o envio roda."""
    try:
        import ctypes
        ctypes.windll.kernel32.SetThreadExecutionState(0x80000001 if ligar else 0x80000000)
    except (AttributeError, OSError, ImportError):
        pass  # não é Windows


def escanear(pasta):
    """Lista os arquivos a enviar: [(caminho, partes_da_pasta_relativa, nome, tamanho)]."""
    arquivos = []
    for raiz, dirs, nomes in os.walk(pasta):
        dirs.sort(key=str.lower)
        rel = os.path.relpath(raiz, pasta)
        partes = [] if rel == "." else rel.split(os.sep)
        for nome in sorted(nomes, key=str.lower):
            if nome.lower() in IGNORADOS:
                continue
            caminho = os.path.join(raiz, nome)
            try:
                tamanho = os.path.getsize(caminho)
            except OSError:
                continue
            if tamanho > 0:
                arquivos.append((caminho, partes, nome, tamanho))
    marcas = sum(1 for d in os.scandir(pasta) if d.is_dir())
    return arquivos, marcas


def verificar_status(url=None):
    """'ativo', 'desativado' ou None (não deu para verificar ou resposta não reconhecida)."""
    url = STATUS_URL if url is None else url
    if not url:
        return "ativo"
    sep = "&" if "?" in url else "?"
    try:
        req = urllib.request.Request(f"{url}{sep}t={int(time.time())}", headers={"Cache-Control": "no-cache"})
        with urllib.request.urlopen(req, timeout=15) as r:
            texto = r.read(200).decode("utf-8", "ignore").strip().lower()
    except (urllib.error.URLError, OSError, ValueError):
        return None
    if texto.startswith("desativado"):
        return "desativado"
    if texto.startswith("ativo"):
        return "ativo"
    return None


def carregar_credenciais():
    """Carrega o token embutido e renova. Levanta RefreshError (revogado) ou erro de rede."""
    with open(caminho_recurso("token.json"), encoding="utf-8") as f:
        info = json.load(f)
    creds = Credentials.from_authorized_user_info(info, ESCOPOS)
    creds.refresh(Request())
    return creds


def acesso_revogado(exc):
    texto = str(exc).lower()
    return any(t in texto for t in ("invalid_grant", "unauthorized_client", "invalid_client"))


def criar_servico(creds):
    http = google_auth_httplib2.AuthorizedHttp(creds, http=httplib2.Http(timeout=60))
    return build("drive", "v3", http=http, cache_discovery=False)


# ----------------------------------------------------------------------------
# Motor de envio (sem tkinter: testável)
# ----------------------------------------------------------------------------
class Interrompido(Exception):
    pass


class Enviador:
    def __init__(self, servico, pasta_local, emitir, checar_status=verificar_status, log=None):
        self.drive = servico
        self.pasta_local = pasta_local
        self.emitir = emitir
        self.checar_status = checar_status
        self.log = log or configurar_log()
        self.parar = threading.Event()
        self.motivo = None  # "cancelado" | "desativado"
        self.espera_inicial = 2
        self.espera_max = 60
        self.status = "enviando"
        self._filhos = {}  # id da pasta -> {"pastas": {nome: id}, "arquivos": {nome: (id, tamanho)}}
        self._pastas = {}  # tupla de nomes -> id
        self._raiz = None
        self._id_progresso = None
        self._ultimo_progresso = 0.0
        self._feitos = 0
        self._total = 0
        self._bytes = 0
        self._bytes_total = 0
        self._marca = ""

    # -- controle --------------------------------------------------------------
    def interromper(self, motivo):
        self.motivo = self.motivo or motivo
        self.parar.set()

    def _checar_parada(self):
        if self.parar.is_set():
            raise Interrompido()

    def _registrar(self, texto):
        self.log.info(texto)
        self.emitir(("log", texto))

    def _definir_status(self, status):
        if status != self.status:
            self.status = status
            self.emitir(("status", status))

    # -- chamadas ao Drive com retry infinito ---------------------------------------
    def _com_retry(self, fn, descricao):
        espera = self.espera_inicial
        while True:
            self._checar_parada()
            try:
                resultado = fn()
                self._definir_status("enviando")
                return resultado
            except Interrompido:
                raise
            except RefreshError as e:
                if acesso_revogado(e):
                    self.interromper("desativado")
                    raise Interrompido()
                novo, texto = "pausado por falta de internet", f"falha ao renovar acesso ({e})"
            except GoogleAuthError as e:  # inclui TransportError (sem rede ao renovar)
                novo, texto = "pausado por falta de internet", f"falha de autenticação ({e})"
            except HttpError as e:
                codigo = e.resp.status
                if codigo == 403 and self._motivo_http(e) in MOTIVOS_QUOTA:
                    novo, texto = "erro", "sem espaço no Drive (libere espaço; continuo tentando)"
                elif codigo in (401, 403, 408, 429) or codigo >= 500:
                    novo, texto = "pausado (aguardando o Google)", f"HTTP {codigo}"
                else:
                    raise
            except (OSError, httplib2.HttpLib2Error, socket.timeout) as e:
                novo, texto = "pausado por falta de internet", f"{type(e).__name__}: {e}"
            self._definir_status(novo)
            self._registrar(f"{descricao}: {texto}. Nova tentativa em {espera}s.")
            if self.parar.wait(espera):
                raise Interrompido()
            espera = min(espera * 2, self.espera_max)

    @staticmethod
    def _motivo_http(erro):
        try:
            return json.loads(erro.content)["error"]["errors"][0]["reason"]
        except (ValueError, KeyError, IndexError, TypeError):
            return ""

    # -- estrutura no Drive ---------------------------------------------------------
    def _listar(self, id_pasta):
        if id_pasta in self._filhos:
            return self._filhos[id_pasta]
        pastas, arquivos, token = {}, {}, None
        while True:
            resp = self._com_retry(lambda: self.drive.files().list(
                q=f"'{id_pasta}' in parents and trashed=false", spaces="drive", pageSize=1000,
                fields="nextPageToken, files(id, name, mimeType, size)", pageToken=token).execute(),
                "listar pasta")
            for f in resp.get("files", []):
                if f["mimeType"] == MIME_PASTA:
                    pastas.setdefault(f["name"], f["id"])
                else:
                    arquivos.setdefault(f["name"], (f["id"], int(f.get("size", 0))))
            token = resp.get("nextPageToken")
            if not token:
                break
        self._filhos[id_pasta] = {"pastas": pastas, "arquivos": arquivos}
        return self._filhos[id_pasta]

    def _criar_pasta(self, nome, id_pai):
        return self._com_retry(lambda: self.drive.files().create(
            body={"name": nome, "mimeType": MIME_PASTA, "parents": [id_pai]}, fields="id").execute(),
            f"criar pasta '{nome}'")["id"]

    def _pasta_raiz(self):
        resp = self._com_retry(lambda: self.drive.files().list(
            q=f"name='{escapar_consulta(PASTA_DESTINO)}' and mimeType='{MIME_PASTA}' "
              f"and 'root' in parents and trashed=false",
            spaces="drive", fields="files(id)").execute(), "procurar pasta raiz")
        if resp.get("files"):
            return resp["files"][0]["id"]
        return self._criar_pasta(PASTA_DESTINO, "root")

    def _id_da_pasta(self, partes):
        if not partes:
            return self._raiz
        chave = tuple(partes)
        if chave in self._pastas:
            return self._pastas[chave]
        pai = self._id_da_pasta(partes[:-1])
        filhos = self._listar(pai)["pastas"]
        if partes[-1] not in filhos:
            filhos[partes[-1]] = self._criar_pasta(partes[-1], pai)
        self._pastas[chave] = filhos[partes[-1]]
        return self._pastas[chave]

    # -- upload ------------------------------------------------------------------
    def _enviar_arquivo(self, caminho, id_pasta, nome, id_existente):
        tipo = mimetypes.guess_type(nome)[0] or "application/octet-stream"
        for tentativa in range(5):
            media = MediaFileUpload(caminho, mimetype=tipo, chunksize=TAMANHO_CHUNK, resumable=True)
            if id_existente:
                req = self.drive.files().update(fileId=id_existente, media_body=media, fields="id")
            else:
                req = self.drive.files().create(body={"name": nome, "parents": [id_pasta]},
                                                media_body=media, fields="id")
            try:
                resposta = None
                while resposta is None:
                    _, resposta = self._com_retry(req.next_chunk, f"enviar '{nome}'")
                return resposta["id"]
            except HttpError as e:
                if e.resp.status == 404 and tentativa < 4:  # sessão de upload expirou: recomeça o arquivo
                    self._registrar(f"Sessão de envio de '{nome}' expirou; recomeçando o arquivo.")
                    id_existente = None  # se o arquivo antigo sumiu, cria de novo
                    continue
                raise

    # -- _progresso.txt --------------------------------------------------------------
    def _texto_progresso(self, status):
        return (f"Status: {status}\n"
                f"Arquivos: {self._feitos} / {self._total}\n"
                f"Marca atual: {self._marca}\n"
                f"No Drive: {formatar_tamanho(self._bytes)} de {formatar_tamanho(self._bytes_total)}\n"
                f"Última atualização: {datetime.now():%d/%m/%Y %H:%M:%S}\n")

    def _gravar_progresso(self, status, insistir=False):
        dados = self._texto_progresso(status).encode("utf-8")

        def gravar():
            media = MediaIoBaseUpload(io.BytesIO(dados), mimetype="text/plain", resumable=False)
            if self._id_progresso:
                self.drive.files().update(fileId=self._id_progresso, media_body=media, fields="id").execute()
            else:
                criado = self.drive.files().create(
                    body={"name": NOME_PROGRESSO, "parents": [self._raiz]}, media_body=media,
                    fields="id").execute()
                self._id_progresso = criado["id"]

        self._ultimo_progresso = time.monotonic()
        if insistir:
            self._com_retry(gravar, "gravar progresso")
            return
        try:  # durante o envio normal, uma falha aqui não pode travar os uploads
            gravar()
        except (HttpError, OSError, httplib2.HttpLib2Error, GoogleAuthError) as e:
            self.log.info(f"Não consegui atualizar {NOME_PROGRESSO}: {e}")

    # -- execução --------------------------------------------------------------------
    def executar(self):
        """Roda o envio completo. Retorna 'concluido', 'cancelado', 'desativado' ou 'erro'."""
        try:
            return self._executar()
        except Interrompido:
            estado = self.motivo or "cancelado"
        except Exception as e:  # erro inesperado: registra, tenta avisar no Drive
            self.log.exception("Erro inesperado")
            self._registrar(f"Erro inesperado: {type(e).__name__}: {e}")
            estado = "erro"
        rotulo = {"cancelado": "cancelado", "desativado": "erro (desativado remotamente)"}.get(estado, "erro")
        if self._raiz:
            self._gravar_progresso(rotulo)
        self._registrar(f"Fim: {estado}")
        return estado

    def _executar(self):
        arquivos, _ = escanear(self.pasta_local)
        self._total = len(arquivos)
        self._bytes_total = sum(a[3] for a in arquivos)
        self._registrar(f"Início: {self._total} arquivos, {formatar_tamanho(self._bytes_total)}")
        self._raiz = self._pasta_raiz()
        anterior = self._listar(self._raiz)["arquivos"].get(NOME_PROGRESSO)
        self._id_progresso = anterior[0] if anterior else None  # reaproveita ao retomar
        self._gravar_progresso("enviando")
        anteriores = []
        for caminho, partes, nome, tamanho in arquivos:
            self._checar_parada()
            if partes != anteriores and anteriores:
                self._registrar(f"Pasta concluída: {'/'.join(anteriores)}")
            anteriores = partes
            self._marca = partes[0] if partes else "(raiz)"
            id_pasta = self._id_da_pasta(partes)
            existente = self._listar(id_pasta)["arquivos"].get(nome)
            self.emitir(("progresso", self._feitos, self._total, "/".join(partes + [nome])))
            if existente and existente[1] == tamanho:
                pass  # já está no Drive
            else:
                self._enviar_arquivo(caminho, id_pasta, nome, existente[0] if existente else None)
            self._feitos += 1
            self._bytes += tamanho
            self.emitir(("progresso", self._feitos, self._total, "/".join(partes + [nome])))
            if (self._feitos % PROGRESSO_A_CADA_ARQUIVOS == 0
                    or time.monotonic() - self._ultimo_progresso >= PROGRESSO_A_CADA_SEGUNDOS):
                self._gravar_progresso("enviando")
        if anteriores:
            self._registrar(f"Pasta concluída: {'/'.join(anteriores)}")
        self._gravar_progresso("concluído", insistir=True)
        self._registrar("Fim: concluído")
        return "concluido"

    def vigiar_interruptor(self, terminou):
        """Roda numa thread: a cada minuto confere o interruptor remoto."""
        while not terminou.wait(INTERVALO_STATUS_SEGUNDOS):
            if self.checar_status() == "desativado":
                self._registrar("Interruptor remoto: DESATIVADO. Parando o envio.")
                self.interromper("desativado")
                return


def executar_envio(pasta, emitir):
    """Worker completo: checa interruptor, autentica, envia. Emite ('fim', estado, mensagem)."""
    log = configurar_log()
    impedir_suspensao(True)
    terminou = threading.Event()
    try:
        if STATUS_URL:
            situacao = verificar_status()
            if situacao != "ativo":
                msg = ("Programa desativado pelo responsável." if situacao == "desativado"
                       else "Não consegui verificar se o envio está liberado (sem internet?). Nada foi enviado.")
                log.info(msg)
                emitir(("fim", "desativado" if situacao == "desativado" else "nao_iniciado", msg))
                return
        try:
            creds = carregar_credenciais()
        except RefreshError as e:
            msg = ("Programa desativado: o acesso foi revogado." if acesso_revogado(e)
                   else "Não consegui autenticar. Tente novamente.")
            log.info(f"{msg} ({e})")
            emitir(("fim", "desativado" if acesso_revogado(e) else "nao_iniciado", msg))
            return
        except (GoogleAuthError, OSError) as e:
            log.info(f"Sem internet ao autenticar: {e}")
            emitir(("fim", "nao_iniciado", "Sem internet para iniciar. Nada foi enviado."))
            return
        enviador = Enviador(criar_servico(creds), pasta, emitir, log=log)
        emitir(("enviador", enviador))
        if STATUS_URL:
            threading.Thread(target=enviador.vigiar_interruptor, args=(terminou,), daemon=True).start()
        estado = enviador.executar()
        mensagens = {
            "concluido": "Concluído! Pode fechar o programa.",
            "cancelado": "Envio cancelado. Abra de novo para continuar de onde parou.",
            "desativado": "Programa desativado pelo responsável. O envio foi interrompido.",
            "erro": "O envio parou por um erro. Veja o arquivo log_envio.txt.",
        }
        emitir(("fim", estado, mensagens[estado]))
    except Exception as e:
        log.exception("Falha inesperada")
        emitir(("fim", "erro", f"O envio parou por um erro: {e}"))
    finally:
        terminou.set()
        impedir_suspensao(False)


# ----------------------------------------------------------------------------
# Interface
# ----------------------------------------------------------------------------
def main():
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk

    log = configurar_log()
    eventos = queue.Queue()
    estado = {"pasta": None, "arquivos": 0, "marcas": 0, "bytes": 0, "enviador": None, "rodando": False}

    root = tk.Tk()
    root.title("Enviar Fotos")
    root.geometry("620x560")
    root.minsize(560, 520)
    corpo = ttk.Frame(root, padding=16)
    corpo.pack(fill="both", expand=True)

    ttk.Label(corpo, text="Enviar fotos para o Google Drive", font=("Segoe UI", 16, "bold")).pack(anchor="w")
    ttk.Label(corpo, wraplength=560, justify="left",
              text=f"As fotos da pasta escolhida serão enviadas para o Google Drive de {NOME_DESTINATARIO}. "
                   "Nada é apagado nem alterado neste computador.").pack(anchor="w", pady=(4, 12))

    ttk.Label(corpo, text="Passo 1: escolha a pasta com as fotos", font=("Segoe UI", 10, "bold")).pack(anchor="w")
    btn_pasta = ttk.Button(corpo, text="Selecionar pasta", state="disabled")
    btn_pasta.pack(anchor="w", pady=4)
    lbl_resumo = ttk.Label(corpo, text="Verificando se o envio está liberado...", wraplength=560, justify="left")
    lbl_resumo.pack(anchor="w", pady=(0, 10))

    ttk.Label(corpo, text="Passo 2: clique em Compartilhar", font=("Segoe UI", 10, "bold")).pack(anchor="w")
    btn_enviar = ttk.Button(corpo, text="Compartilhar", state="disabled")
    btn_enviar.pack(anchor="w", pady=4)

    barra = ttk.Progressbar(corpo, mode="determinate")
    barra.pack(fill="x", pady=(12, 2))
    lbl_contagem = ttk.Label(corpo, text="")
    lbl_contagem.pack(anchor="w")
    lbl_arquivo = ttk.Label(corpo, text="", wraplength=560)
    lbl_arquivo.pack(anchor="w")
    lbl_status = ttk.Label(corpo, text="", font=("Segoe UI", 10, "bold"))
    lbl_status.pack(anchor="w", pady=(4, 0))
    btn_cancelar = ttk.Button(corpo, text="Cancelar envio", state="disabled")
    btn_cancelar.pack(anchor="w", pady=6)

    ttk.Label(corpo, wraplength=560, justify="left", foreground="#8a4b00",
              text="Depois de clicar em Compartilhar, não deslogue, não desligue nem troque de usuário. "
                   "Bloquear a tela (Win+L) pode. Se a internet cair, o envio espera e continua sozinho."
              ).pack(anchor="w", pady=(4, 6))
    caixa_log = tk.Text(corpo, height=6, state="disabled", wrap="word", font=("Consolas", 8))
    caixa_log.pack(fill="both", expand=True)
    lbl_final = ttk.Label(corpo, text="", font=("Segoe UI", 12, "bold"), wraplength=560)
    lbl_final.pack(anchor="w", pady=(8, 0))

    def escrever_log(texto):
        caixa_log.config(state="normal")
        caixa_log.insert("end", f"{datetime.now():%H:%M:%S} {texto}\n")
        caixa_log.see("end")
        caixa_log.config(state="disabled")

    # -- verificação inicial (interruptor + acesso) em thread --------------------------
    def verificar_ao_abrir():
        situacao = verificar_status()
        if situacao == "desativado":
            return eventos.put(("bloqueio", "Programa desativado pelo responsável."))
        if situacao is None:
            return eventos.put(("sem_internet", "Sem internet (ou resposta inválida) na verificação. "
                                                "Conecte-se e clique em Tentar novamente."))
        try:
            carregar_credenciais()
        except RefreshError as e:
            if acesso_revogado(e):
                return eventos.put(("bloqueio", "Programa desativado: o acesso foi revogado."))
            return eventos.put(("sem_internet", f"Não consegui autenticar ({e}). Tente novamente."))
        except (GoogleAuthError, OSError) as e:
            return eventos.put(("sem_internet", f"Sem internet para autenticar ({e}). Tente novamente."))
        except Exception as e:
            return eventos.put(("bloqueio", f"Programa sem autorização embutida ({e})."))
        eventos.put(("liberado", None))

    btn_tentar = ttk.Button(corpo, text="Tentar novamente")

    def iniciar_verificacao():
        btn_tentar.pack_forget()
        lbl_resumo.config(text="Verificando se o envio está liberado...")
        threading.Thread(target=verificar_ao_abrir, daemon=True).start()

    btn_tentar.config(command=iniciar_verificacao)

    # -- escolha da pasta ------------------------------------------------------------
    def escolher_pasta():
        pasta = filedialog.askdirectory(title="Escolha a pasta com as fotos")
        if not pasta:
            return
        estado["pasta"] = None
        btn_enviar.config(state="disabled")
        lbl_resumo.config(text="Lendo a pasta...")

        def ler():
            try:
                arquivos, marcas = escanear(pasta)
                eventos.put(("resumo", (pasta, len(arquivos), marcas, sum(a[3] for a in arquivos))))
            except OSError as e:
                eventos.put(("resumo_erro", str(e)))

        threading.Thread(target=ler, daemon=True).start()

    def texto_resumo():
        return (f"Pasta: {estado['pasta']}\nMarcas (subpastas): {estado['marcas']}\n"
                f"Arquivos: {estado['arquivos']}\nTamanho total: {formatar_tamanho(estado['bytes'])}")

    def iniciar_envio():
        if not messagebox.askyesno(
                "Confirmar", f"Essa é a pasta com TODAS as fotos?\n\n{texto_resumo()}\n\n"
                             f"Elas serão enviadas para o Drive de {NOME_DESTINATARIO}."):
            return
        estado["rodando"] = True
        btn_pasta.config(state="disabled")
        btn_enviar.config(state="disabled")
        btn_cancelar.config(state="normal")
        barra.config(maximum=max(estado["arquivos"], 1), value=0)
        lbl_status.config(text="Status: enviando")
        log.info(f"Envio iniciado: {estado['pasta']}")
        threading.Thread(target=executar_envio, args=(estado["pasta"], eventos.put), daemon=True).start()

    def cancelar():
        if estado["enviador"] and messagebox.askyesno("Cancelar", "Cancelar o envio? Você poderá continuar depois."):
            estado["enviador"].interromper("cancelado")

    def fechar():
        if estado["rodando"] and not messagebox.askyesno(
                "Sair", "O envio ainda está em andamento. Sair agora interrompe o envio.\nSair mesmo assim?"):
            return
        if estado["enviador"]:
            estado["enviador"].interromper("cancelado")
        root.destroy()

    def contagem_regressiva(restante):
        if restante <= 0:
            return root.destroy()
        lbl_final.config(text=f"Concluído! Pode fechar o programa. (fecha sozinho em {restante}s)")
        root.after(1000, contagem_regressiva, restante - 1)

    # -- fila de eventos -------------------------------------------------------------
    def processar():
        try:
            while True:
                tipo, *dados = eventos.get_nowait()
                if tipo == "liberado":
                    lbl_resumo.config(text="Nenhuma pasta selecionada.")
                    btn_pasta.config(state="normal")
                elif tipo == "bloqueio":
                    lbl_resumo.config(text="")
                    lbl_final.config(text=dados[0])
                    messagebox.showerror("Enviar Fotos", dados[0])
                    root.destroy()
                    return
                elif tipo == "sem_internet":
                    lbl_resumo.config(text=dados[0])
                    btn_tentar.pack(anchor="w")
                elif tipo == "resumo":
                    estado.update(pasta=dados[0][0], arquivos=dados[0][1], marcas=dados[0][2], bytes=dados[0][3])
                    lbl_resumo.config(text=texto_resumo())
                    btn_enviar.config(state="normal" if estado["arquivos"] else "disabled")
                elif tipo == "resumo_erro":
                    lbl_resumo.config(text=f"Não consegui ler a pasta: {dados[0]}")
                elif tipo == "enviador":
                    estado["enviador"] = dados[0]
                elif tipo == "progresso":
                    barra.config(value=dados[0])
                    lbl_contagem.config(text=f"{dados[0]} de {dados[1]} arquivos")
                    lbl_arquivo.config(text=dados[2])
                elif tipo == "status":
                    lbl_status.config(text=f"Status: {dados[0]}")
                elif tipo == "log":
                    escrever_log(dados[0])
                elif tipo == "fim":
                    estado["rodando"] = False
                    btn_cancelar.config(state="disabled")
                    btn_pasta.config(state="normal")
                    btn_enviar.config(state="normal" if estado["pasta"] else "disabled")
                    lbl_status.config(text=f"Status: {dados[0]}")
                    lbl_final.config(text=dados[1])
                    if dados[0] == "concluido" and FECHAR_SOZINHO_SEGUNDOS:
                        contagem_regressiva(FECHAR_SOZINHO_SEGUNDOS)
        except queue.Empty:
            pass
        root.after(200, processar)

    btn_pasta.config(command=escolher_pasta)
    btn_enviar.config(command=iniciar_envio)
    btn_cancelar.config(command=cancelar)
    root.protocol("WM_DELETE_WINDOW", fechar)
    iniciar_verificacao()
    root.after(200, processar)
    root.mainloop()


if __name__ == "__main__":
    main()
