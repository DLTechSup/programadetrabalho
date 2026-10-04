# -*- coding: utf-8 -*-
"""Gera tests/referencia.json rodando o nucleo.py ORIGINAL (Python) sobre um
corpus de descrições. O teste em TypeScript compara a nova versão contra isso.
pandas é substituído por um stub mínimo (só `isna` é usado nessas funções)."""
import json, os, random, sys, types

stub = types.ModuleType("pandas")
stub.isna = lambda v: v != v
sys.modules["pandas"] = stub
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "legado-python"))
import nucleo  # noqa: E402

BASES = ["SANDALIA RASTEIRA", "TENIS RUNNING", "CHINELO SLIDE", "BOTA COTURNO", "SAPATILHA", "TENIS KIDS ROSA"]
CORES = ["PRETO", "BRANCO OFF", "Caramelo", "preto/branco", "OFF-WHITE", "cappuccino-marinho", "Café", "AVELÃ", "Rosê", "verde sálvia", "azul sport/branco", "Cinza Chumbo"]
TAMS = ["33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "14", "50", "51", "13", "P", "M", "GG", "U", "XGG"]

corpus = []
def add(d, c=None): corpus.append([d, c])

rng = random.Random(42)
fixos = [
    "SANDALIA 1234.567 PRETO 38", "TENIS 33/34 PRETO", "BOTA N 35/36 CARAMELO 12345", "SAPATO 3334 AZUL",
    "SAPATO 2122 AZUL", "CHINELO CAB. PRETO TAM:37", "CHINELO CAB PRETO/BRANCO 123 tam.38", "RASTEIRA CABEDAL CAMEL 45 tam:36",
    "SANDALIA TAM.=38. PRETO", "SANDALIA TAM = 39 NUDE 1234567", "SAPATILHA 36=1 COMB1: PRETO/OURO", "SAPATILHA 37=2 NUDE",
    "TENIS 38=3 COMB12:Branco", "BOLSA PRETA U", "CAMISETA BRANCA GG", "MOCHILA AZUL UN", "SANDALIA ROSA", "",
    "   ", "SAPATO 99", "SAPATO 12", "TAMANHO 37 BEGE", "Cor:Preto;Tamanho:37", "SANDALIA PRETO TAMANHO: 40",
    "TENIS tam 38 branco", "TENIS TAM39 BRANCO", "XYZ", "SANDALIA ROSA 33/34 1234", "SANDALIA 35/36", "A 3536 B",
    "SANDALIA NATURAL CAB. OFF WHITE 12 tam:35", "SAPATO 7891234 PRETO 37", "SAPATO 1.234-5 PRETO 37",
    "Tênis Café Expresso 38", "avelã onça 36", "d'agua marinho 39", "SANDALIA 1/2 PRETO 38",
]
for d in fixos: add(d)
for _ in range(900):
    base = rng.choice(BASES); cor = rng.choice(CORES); t = rng.choice(TAMS)
    ref = str(rng.randint(1000, 9999999))
    fmt = rng.randint(0, 9)
    t2 = rng.choice(["33/34", "35/36", "37/38", "3334", "3536"])
    d = [
        f"{base} {ref} {cor} {t}", f"{base} {cor} {t}", f"{base} {cor} {t2}", f"{base} {t2} {cor}",
        f"{base} CAB. {cor} {ref} tam:{t}", f"{base} {cor} tam.{t}", f"{base} TAM.={t}. {cor} {ref}",
        f"{base} {t}={rng.randint(1,9)} COMB{rng.randint(1,9)}: {cor}", f"{base} {t}={rng.randint(1,9)} {cor}",
        f"{base} N {t2} {cor}",
    ][fmt]
    c = rng.choice([None, None, f"{ref}-{rng.choice(['LUNMHO','GRENPT','AB12','12345','X1'])}-{t}", f"{ref}-ABC-{t}"])
    add(d, c)

saida = []
for d, c in corpus:
    r = nucleo.analisar_linha(d, c)
    saida.append({"descricao": d, "cod": c, "tamanho": r[0], "chave": r[1], "sugestao": r[2], "veio": r[3]})

nomes = ["Cor:Preto", "cor : Azul ;Tamanho:37", "  ;Verde;  ", "Branco;tamanho: 38", "Rosa", "COR:  ", "Off White ;TAMANHO:39 x"]
limpar = [[n, nucleo.limpar_nome_cor(n)] for n in nomes]

with open(os.path.join(os.path.dirname(__file__), "referencia.json"), "w", encoding="utf-8") as f:
    json.dump({"analises": saida, "limpar": limpar}, f, ensure_ascii=False)
print(len(saida), "casos gerados")
