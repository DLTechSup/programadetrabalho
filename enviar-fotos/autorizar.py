"""Roda UMA vez, na máquina do dono: faz o login Google e gera o token.json.

Pré-requisito: credentials.json (cliente OAuth tipo "App para computador") nesta pasta.
O token.json gerado dá acesso de envio ao Drive do dono: não publique nem compartilhe.
"""
import os
import sys

from google_auth_oauthlib.flow import InstalledAppFlow

ESCOPOS = ["https://www.googleapis.com/auth/drive.file"]
PASTA = os.path.dirname(os.path.abspath(__file__))
CREDENCIAIS = os.path.join(PASTA, "credentials.json")
TOKEN = os.path.join(PASTA, "token.json")


def main():
    if not os.path.exists(CREDENCIAIS):
        print("Não encontrei credentials.json nesta pasta. Veja o passo a passo no LEIA-ME.md.")
        sys.exit(1)
    fluxo = InstalledAppFlow.from_client_secrets_file(CREDENCIAIS, ESCOPOS)
    # offline + consent => o Google devolve um refresh token mesmo em novas autorizações
    creds = fluxo.run_local_server(port=0, access_type="offline", prompt="consent")
    if not creds.refresh_token:
        print("O Google não devolveu refresh token. Revogue o acesso em "
              "myaccount.google.com/permissions e rode de novo.")
        sys.exit(1)
    with open(TOKEN, "w", encoding="utf-8") as f:
        f.write(creds.to_json())
    print("Pronto! token.json gerado. Agora rode GERAR-EXE.bat.")


if __name__ == "__main__":
    main()
