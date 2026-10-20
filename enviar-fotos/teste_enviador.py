"""Testes do motor de envio com um Drive simulado (não usa internet nem tkinter).
Rodar:  python -I teste_enviador.py   (ou: python -m unittest teste_enviador)
"""
import os
import re
import tempfile
import threading
import unittest

import httplib2
from googleapiclient.errors import HttpError

import enviar_fotos as ef


class Req:
    def __init__(self, drive, fn):
        self.drive, self.fn = drive, fn

    def execute(self):
        return self.fn()

    def next_chunk(self):
        self.drive.chunks += 1
        if self.drive.falhas:
            self.drive.falhas -= 1
            raise OSError("sem internet")
        return None, self.fn()


class DriveFalso:
    def __init__(self):
        self.itens = {}  # id -> dict(name, parents, mime, data)
        self.n = 0
        self.falhas = 0
        self.chunks = 0

    def files(self):
        return self

    def _novo(self, body, media):
        self.n += 1
        i = f"id{self.n}"
        dados = media.getbytes(0, media.size()) if media else b""
        self.itens[i] = dict(id=i, name=body["name"], parents=body["parents"],
                             mimeType=body.get("mimeType", "x"), data=dados)
        return {"id": i}

    def create(self, body, media_body=None, fields=None):
        return Req(self, lambda: self._novo(body, media_body))

    def update(self, fileId, media_body=None, fields=None):
        def f():
            self.itens[fileId]["data"] = media_body.getbytes(0, media_body.size())
            return {"id": fileId}
        return Req(self, f)

    def list(self, q, **kw):
        def f():
            pai = re.search(r"'([^']+)' in parents", q).group(1)
            nome = re.search(r"name='((?:[^'\\]|\\.)*)'", q)
            nome = re.sub(r"\\(.)", r"\1", nome.group(1)) if nome else None
            if pai == "root":
                pai = None
            achados = [dict(i, size=str(len(i["data"]))) for i in self.itens.values()
                       if (i["parents"][0] if i["parents"][0] != "root" else None) == pai
                       and (nome is None or i["name"] == nome)]
            return {"files": achados}
        return Req(self, f)


def montar(base, arquivos):
    for rel, conteudo in arquivos.items():
        c = os.path.join(base, *rel.split("/"))
        os.makedirs(os.path.dirname(c), exist_ok=True)
        with open(c, "wb") as f:
            f.write(conteudo)


ARQUIVOS = {
    "Nike/AB-123/a.jpg": b"aaa", "Nike/AB-123/b.jpg": b"bbbb",
    "D'Água/Ref 1/ç é.png": b"cc", "Thumbs.db": b"x", "Nike/vazio.jpg": b"",
    "solto.jpg": b"s",
}


class Testes(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        montar(self.tmp.name, ARQUIVOS)
        self.drive = DriveFalso()
        self.eventos = []

    def tearDown(self):
        self.tmp.cleanup()

    def novo(self, **kw):
        e = ef.Enviador(self.drive, self.tmp.name, self.eventos.append, **kw)
        e.espera_inicial = e.espera_max = 0.01
        return e

    def nomes(self):
        return sorted(i["name"] for i in self.drive.itens.values())

    def test_escanear_ignora_lixo_e_conta_marcas(self):
        arqs, marcas = ef.escanear(self.tmp.name)
        self.assertEqual(len(arqs), 4)
        self.assertEqual(marcas, 2)

    def test_escapar_consulta(self):
        self.assertEqual(ef.escapar_consulta("D'Água\\x"), "D\\'Água\\\\x")

    def test_estrutura_e_progresso(self):
        self.assertEqual(self.novo().executar(), "concluido")
        n = self.nomes()
        for esperado in ("Fotos da Loja", "Nike", "AB-123", "D'Água", "Ref 1", "ç é.png", "solto.jpg", "_progresso.txt"):
            self.assertIn(esperado, n)
        self.assertNotIn("Thumbs.db", n)
        prog = [i for i in self.drive.itens.values() if i["name"] == "_progresso.txt"]
        self.assertEqual(len(prog), 1)
        self.assertIn(b"Status: conclu\xc3\xaddo", prog[0]["data"])
        self.assertIn(b"Arquivos: 4 / 4", prog[0]["data"])

    def test_retomada_nao_duplica_e_atualiza_tamanho_diferente(self):
        self.novo().executar()
        total = len(self.drive.itens)
        montar(self.tmp.name, {"Nike/AB-123/a.jpg": b"aaaaaa"})  # mudou de tamanho
        self.assertEqual(self.novo().executar(), "concluido")
        self.assertEqual(len(self.drive.itens), total)
        a = [i for i in self.drive.itens.values() if i["name"] == "a.jpg"][0]
        self.assertEqual(a["data"], b"aaaaaa")

    def test_queda_de_internet_pausa_e_retoma(self):
        self.drive.falhas = 6
        self.assertEqual(self.novo().executar(), "concluido")
        self.assertTrue(any(e == ("status", "pausado por falta de internet") for e in self.eventos))
        self.assertEqual(self.nomes().count("a.jpg"), 1)

    def test_http_429_e_500_sao_repetidos(self):
        erros = [HttpError(httplib2.Response({"status": c}), b"{}") for c in (429, 500, 503)]
        orig = self.drive.list

        def lista(q, **kw):
            r = orig(q, **kw)
            if erros:
                raise erros.pop()
            return r
        self.drive.list = lista
        self.assertEqual(self.novo().executar(), "concluido")

    def test_cancelar(self):
        e = self.novo()
        e.parar.set(); e.motivo = "cancelado"
        self.assertEqual(e.executar(), "cancelado")

    def test_interruptor_remoto(self):
        e = self.novo(checar_status=lambda: "desativado")
        ef.INTERVALO_STATUS_SEGUNDOS, antigo = 0.01, ef.INTERVALO_STATUS_SEGUNDOS
        try:
            self.drive.falhas = 10 ** 6  # preso "sem internet": só o interruptor tira daqui
            t = threading.Thread(target=e.vigiar_interruptor, args=(threading.Event(),))
            t.start()
            self.assertEqual(e.executar(), "desativado")
            t.join()
        finally:
            ef.INTERVALO_STATUS_SEGUNDOS = antigo

    def test_status_url_vazia_libera(self):
        self.assertEqual(ef.verificar_status(""), "ativo")


if __name__ == "__main__":
    unittest.main()
