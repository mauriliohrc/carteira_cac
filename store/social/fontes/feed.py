#!/usr/bin/env python3
# Gera 10 posts 1080x1080 (feed do Instagram) da Carteira CAC.
# Identidade: verde #0F3D1E, ouro #D8AE3A, creme #FBFAF3, escudo + screenshots reais.
# Saida: store/social/feed/*.png
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parents[2]      # .../store
PROJ = RAIZ.parent
SHOTS = RAIZ / "screenshots" / "6.9"
LOGO = PROJ / "assets" / "logo.png"
SAIDA = RAIZ / "social" / "feed"
SAIDA.mkdir(parents=True, exist_ok=True)

BASE = """<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
:root{{
  --verde:#0F3D1E; --verde2:#0A2712; --verde3:#061A0B;
  --ouro:#D8AE3A; --ouro2:#F4D06A; --ouro3:#B8891F;
  --creme:#FBFAF3; --sage:#C6D9BC;
}}
html,body{{width:1080px;height:1080px;overflow:hidden}}
body{{
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",Arial,sans-serif;
  color:var(--creme);
  background:
    radial-gradient(760px 620px at 82% 10%, rgba(30,106,52,.55), transparent 60%),
    radial-gradient(640px 560px at 4% 100%, rgba(216,174,58,.12), transparent 62%),
    linear-gradient(162deg, var(--verde) 0%, var(--verde2) 56%, var(--verde3) 100%);
  position:relative;
}}
.losango{{position:absolute;right:-240px;top:120px;width:640px;height:640px;
  transform:rotate(45deg);border:20px solid var(--ouro);opacity:.09;border-radius:52px}}
.losango.b{{right:auto;left:-320px;bottom:-280px;top:auto;width:520px;height:520px;opacity:.06;border-width:16px}}

/* ---------- marca ---------- */
.marca{{position:absolute;top:66px;left:72px;display:flex;align-items:center;gap:18px}}
.marca img{{width:64px;height:64px;display:block;filter:drop-shadow(0 7px 16px rgba(0,0,0,.45))}}
.marca .nome{{font-size:23px;font-weight:800;letter-spacing:7px;color:var(--ouro2)}}
.marca .nome small{{display:block;font-size:14px;font-weight:600;letter-spacing:3px;
  color:var(--sage);opacity:.75;margin-top:6px}}
.fio{{position:absolute;top:158px;left:72px;width:936px;height:2px;
  background:linear-gradient(90deg,rgba(216,174,58,.7),rgba(216,174,58,0))}}

/* ---------- etiqueta ---------- */
.etq{{display:flex;align-items:center;gap:14px;
  font-size:19px;font-weight:800;letter-spacing:5px;color:var(--ouro)}}
.etq i{{display:block;width:40px;height:5px;border-radius:3px;background:var(--ouro);font-style:normal}}

/* ---------- rodape ---------- */
.pilula{{display:inline-flex;align-items:center;gap:14px;
  background:linear-gradient(180deg,var(--ouro2),var(--ouro));color:#17120A;
  font-size:28px;font-weight:800;padding:22px 42px;border-radius:18px;
  box-shadow:0 16px 38px rgba(0,0,0,.45)}}
.obs{{margin-top:16px;font-size:19px;letter-spacing:2.5px;font-weight:600;color:var(--sage);opacity:.9}}

{extra}
</style></head><body>
<div class="losango"></div><div class="losango b"></div>
<div class="marca"><img src="{logo}"><div class="nome">CARTEIRA CAC<small>ACERVO EM ORDEM</small></div></div>
<div class="fio"></div>
{corpo}
</body></html>"""

# ---------- Layout A: texto a esquerda + celular inclinado a direita ----------
CSS_A = """
.col{position:absolute;left:72px;top:232px;width:486px}
.col h1{margin-top:22px;font-size:__H1__px;line-height:1.05;letter-spacing:-1.6px;
  font-weight:800;color:var(--creme);text-shadow:0 5px 22px rgba(0,0,0,.32)}
.col .sub{margin-top:26px;font-size:27px;line-height:1.4;color:var(--sage);font-weight:500;width:462px}
.col .sub b{color:var(--ouro2);font-weight:700}
.rodape{position:absolute;left:72px;bottom:74px}
.fone{position:absolute;right:30px;top:214px;width:452px;height:792px;
  border-radius:54px;overflow:hidden;border:8px solid rgba(216,174,58,.5);background:#0b1a0f;
  transform:rotate(-3deg);
  box-shadow:0 40px 90px rgba(0,0,0,.6),0 0 0 2px rgba(0,0,0,.32)}
.fone img{display:block;width:100%}
"""

def layout_a(p):
    extra = CSS_A.replace("__H1__", str(p["h1"]))
    corpo = (
        f'<div class="col"><div class="etq"><i></i>{p["etq"]}</div>'
        f'<h1>{p["titulo"]}</h1><div class="sub">{p["sub"]}</div></div>'
        f'<div class="fone"><img src="{SHOTS/p["shot"]}"></div>'
        f'<div class="rodape"><div class="pilula">{p["cta"]}</div>'
        f'<div class="obs">{p["obs"]}</div></div>'
    )
    return extra, corpo

# ---------- Layout B: declaracao centralizada (sem screenshot) ----------
CSS_B = """
.centro{position:absolute;left:90px;right:90px;top:272px;text-align:center}
.centro .etq{justify-content:center}
.centro h1{margin-top:26px;font-size:__H1__px;line-height:1.06;letter-spacing:-1.8px;
  font-weight:800;color:var(--creme);text-shadow:0 5px 22px rgba(0,0,0,.32)}
.centro .sub{margin:30px auto 0;font-size:30px;line-height:1.46;color:var(--sage);
  font-weight:500;max-width:820px}
.centro .sub b{color:var(--ouro2);font-weight:700}
.chips{display:flex;justify-content:center;gap:20px;margin-top:44px;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:12px;
  background:rgba(251,250,243,.06);border:1.5px solid rgba(216,174,58,.45);
  color:var(--creme);font-size:25px;font-weight:700;letter-spacing:.5px;
  padding:18px 32px;border-radius:999px}
.chip b{color:var(--ouro2)}
.rodape{position:absolute;left:0;right:0;bottom:80px;text-align:center}
.selo{position:absolute;left:50%;top:150px;transform:translateX(-50%);
  width:90px;height:90px;filter:drop-shadow(0 10px 24px rgba(0,0,0,.5));opacity:.96}
"""

def layout_b(p):
    extra = CSS_B.replace("__H1__", str(p["h1"]))
    chips = ""
    if p.get("chips"):
        chips = '<div class="chips">' + "".join(
            f'<div class="chip">{c}</div>' for c in p["chips"]) + "</div>"
    selo = f'<img class="selo" src="{LOGO}">' if p.get("selo") else ""
    corpo = (
        f'{selo}<div class="centro"><div class="etq"><i></i>{p["etq"]}<i></i></div>'
        f'<h1>{p["titulo"]}</h1><div class="sub">{p["sub"]}</div>{chips}</div>'
        f'<div class="rodape"><div class="pilula">{p["cta"]}</div>'
        f'<div class="obs">{p["obs"]}</div></div>'
    )
    return extra, corpo


POSTS = [
    # 1 — capa / marca
    dict(arq="01-capa", layout="A", shot="1-painel.png", h1=62,
         etq="A CARTEIRA DIGITAL DO CAC",
         titulo="Seu acervo<br>sempre<br>em ordem.",
         sub="CRAF, guia, laudo e CR num app só — com <b>aviso antes de cada vencimento</b>.",
         cta="⬇  Baixe grátis", obs="BUSQUE POR “CARTEIRA CAC”"),

    # 2 — vencimentos
    dict(arq="02-vencimentos", layout="A", shot="5-avisos.png", h1=60,
         etq="AVISOS",
         titulo="Nunca mais<br>perca um<br>vencimento.",
         sub="No último mês antes de vencer, o app avisa <b>todos os dias</b> — mesmo fechado.",
         cta="⬇  Baixe grátis", obs="CRAF · GUIA · LAUDO · CR"),

    # 3 — acervo
    dict(arq="03-acervo", layout="A", shot="2-acervo.png", h1=60,
         etq="ACERVO",
         titulo="Todo o seu<br>acervo numa<br>tela só.",
         sub="Cada arma com o <b>status do documento à vista</b>: em dia, vencendo ou vencido.",
         cta="⬇  Baixe grátis", obs="VISÃO GERAL DO ACERVO"),

    # 4 — ficha da arma
    dict(arq="04-ficha", layout="A", shot="3-arma.png", h1=60,
         etq="FICHA DA ARMA",
         titulo="Cada arma<br>com a ficha<br>completa.",
         sub="Marca, calibre, nº de série, <b>SIGMA/SINARM</b>, local de guarda e fotos.",
         cta="⬇  Baixe grátis", obs="SÉRIE · SIGMA · CALIBRE · GUARDA"),

    # 5 — documentos
    dict(arq="05-documentos", layout="A", shot="4-documento.png", h1=60,
         etq="DOCUMENTOS",
         titulo="CRAF e guia<br>na palma<br>da mão.",
         sub="Anexe o PDF ou a foto de cada documento. <b>Abre mesmo sem internet.</b>",
         cta="⬇  Baixe grátis", obs="FUNCIONA OFFLINE"),

    # 6 — segurança
    dict(arq="06-seguranca", layout="A", shot="6-seguranca.png", h1=58,
         etq="SEGURANÇA",
         titulo="Só você abre.<br>Só no seu<br>aparelho.",
         sub="PIN de 6 dígitos, Face ID ou digital. <b>Sem servidor e sem coleta de dados.</b>",
         cta="⬇  Baixe grátis", obs="PIN · FACE ID · BACKUP AES-256"),

    # 7 — clubes parceiros
    dict(arq="07-clubes", layout="A", shot="8-paywall-parceiro.png", h1=54,
         etq="CLUBES PARCEIROS",
         titulo="Sócio de<br>clube parceiro<br>tem plano<br>exclusivo.",
         sub="Clubes e entidades do tiro liberam o <b>Premium anual exclusivo</b> para os associados.",
         cta="⬇  Baixe grátis", obs="SEU CLUBE PODE SER PARCEIRO"),

    # 8 — público (declaração)
    dict(arq="08-publico", layout="B", h1=66, selo=True,
         etq="FEITO PARA O CAC BRASILEIRO",
         titulo="Atirador,<br>caçador ou<br>colecionador.",
         sub="Um só app para organizar o acervo de <b>qualquer categoria</b> — do primeiro CR ao acervo inteiro.",
         chips=["🎯 <b>Atirador</b>", "🌿 <b>Caçador</b>", "🏅 <b>Colecionador</b>"],
         cta="⬇  Baixe grátis", obs="CARTEIRACAC.COM"),

    # 9 — comece grátis (declaração)
    dict(arq="09-gratis", layout="B", h1=72, selo=True,
         etq="COMECE GRÁTIS",
         titulo="1 arma grátis.<br>Para sempre.",
         sub="Experimente sem pagar nada. No <b>Premium</b>: acervo ilimitado, alertas diários e backup.",
         cta="⬇  Baixe grátis", obs="SEM CARTÃO PARA COMEÇAR"),

    # 10 — chamada final de download (declaração)
    dict(arq="10-baixe", layout="B", h1=76, selo=True,
         etq="DISPONÍVEL AGORA",
         titulo="Baixe a<br>Carteira CAC.",
         sub="Seu acervo organizado, seguro e sempre em dia. <b>Grátis na App Store.</b>",
         cta="⬇  BAIXAR NA APP STORE", obs="BUSQUE POR “CARTEIRA CAC”"),
]

for p in POSTS:
    extra, corpo = (layout_a if p["layout"] == "A" else layout_b)(p)
    html = BASE.format(logo=LOGO, extra=extra, corpo=corpo)
    (SAIDA / f'{p["arq"]}.html').write_text(html, encoding="utf-8")
    print("html: feed/" + p["arq"])
