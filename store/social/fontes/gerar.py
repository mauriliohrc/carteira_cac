#!/usr/bin/env python3
# Gera as 7 artes 1080x1920 (Stories / Status) da Carteira CAC.
# Uso: python3 gerar.py   (depois o gerar.sh chama o Chrome headless)
import os, pathlib

RAIZ = pathlib.Path(__file__).resolve().parents[2]      # .../CAC_BRASIL/store
PROJ = RAIZ.parent
SHOTS = RAIZ / "screenshots" / "6.9"
LOGO = PROJ / "assets" / "logo.png"
SAIDA = pathlib.Path(__file__).resolve().parent

LOJA = "https://apps.apple.com/br/app/carteira-cac/id6814230068?l=en-GB"

BASE = """<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
:root{{
  --verde:#0F3D1E; --verde2:#0A2712; --verde3:#061A0B;
  --ouro:#D8AE3A; --ouro2:#F4D06A; --ouro3:#B8891F;
  --creme:#FBFAF3; --sage:#C6D9BC;
}}
html,body{{width:1080px;height:1920px;overflow:hidden}}
body{{
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",Arial,sans-serif;
  color:var(--creme);
  background:
    radial-gradient(900px 700px at 78% 16%, rgba(30,106,52,.55), transparent 62%),
    radial-gradient(760px 620px at 10% 92%, rgba(216,174,58,.13), transparent 64%),
    linear-gradient(165deg, var(--verde) 0%, var(--verde2) 55%, var(--verde3) 100%);
  position:relative;
}}
.losango{{position:absolute;right:-300px;top:280px;width:820px;height:820px;
  transform:rotate(45deg);border:24px solid var(--ouro);opacity:.09;border-radius:64px}}
.losango.b{{right:auto;left:-420px;top:1180px;width:640px;height:640px;opacity:.06;border-width:20px}}

/* ---------- topo ---------- */
.marca{{position:absolute;top:104px;left:78px;display:flex;align-items:center;gap:22px}}
.marca img{{width:78px;height:78px;display:block;
  filter:drop-shadow(0 8px 20px rgba(0,0,0,.45))}}
.marca .nome{{font-size:27px;font-weight:800;letter-spacing:9px;color:var(--ouro2)}}
.marca .nome small{{display:block;font-size:17px;font-weight:600;letter-spacing:3.5px;
  color:var(--sage);opacity:.75;margin-top:7px}}
.fio{{position:absolute;top:216px;left:78px;width:924px;height:2px;
  background:linear-gradient(90deg,rgba(216,174,58,.75),rgba(216,174,58,0))}}

/* ---------- texto ---------- */
.etq{{position:absolute;top:286px;left:78px;display:flex;align-items:center;gap:16px;
  font-size:23px;font-weight:800;letter-spacing:6px;color:var(--ouro)}}
.etq i{{display:block;width:46px;height:5px;border-radius:3px;background:var(--ouro);font-style:normal}}
h1{{position:absolute;top:348px;left:78px;width:930px;
  font-size:{h1}px;line-height:1.04;letter-spacing:-2.4px;font-weight:800;color:var(--creme);
  text-shadow:0 6px 28px rgba(0,0,0,.35)}}
.sub{{position:absolute;top:{suby}px;left:78px;width:{subw}px;
  font-size:35px;line-height:1.42;color:var(--sage);font-weight:500}}
.sub b{{color:var(--ouro2);font-weight:700}}

/* ---------- celular (layout A) ---------- */
.fone{{position:absolute;left:50%;transform:translateX(-50%);top:{fy}px;
  width:676px;height:{fh}px;border-radius:72px;overflow:hidden;
  border:9px solid rgba(216,174,58,.55);background:#0b1a0f;
  box-shadow:0 48px 110px rgba(0,0,0,.62), 0 0 0 2px rgba(0,0,0,.35)}}
.fone img{{display:block;width:100%}}

/* ---------- recorte (layout B) ---------- */
.janela{{position:absolute;left:50%;transform:translateX(-50%);top:{jy}px;
  width:904px;height:{jh}px;border-radius:44px;overflow:hidden;
  border:6px solid rgba(216,174,58,.5);background:#fff;
  box-shadow:0 44px 100px rgba(0,0,0,.6)}}
.janela img{{display:block;position:absolute}}

/* ---------- rodapé ---------- */
.scrim{{position:absolute;left:0;right:0;bottom:0;height:{sh}px;
  background:linear-gradient(180deg,{stops})}}
.rodape{{position:absolute;left:0;right:0;bottom:224px;text-align:center}}
.pilula{{display:inline-flex;align-items:center;gap:16px;
  background:linear-gradient(180deg,var(--ouro2),var(--ouro));color:#17120A;
  font-size:34px;font-weight:800;letter-spacing:.2px;padding:27px 52px;border-radius:22px;
  box-shadow:0 18px 44px rgba(0,0,0,.45)}}
.rodape .obs{{margin-top:22px;font-size:24px;letter-spacing:2.5px;font-weight:600;
  color:var(--sage);opacity:.9}}
{extra}
</style></head><body>
<div class="losango"></div><div class="losango b"></div>
<div class="marca">
  <img src="{logo}">
  <div class="nome">CARTEIRA CAC<small>ACERVO EM ORDEM</small></div>
</div>
<div class="fio"></div>
{corpo}
<div class="scrim"></div>
<div class="rodape">
  <div class="pilula">{cta}</div>
  <div class="obs">{obs}</div>
</div>
</body></html>"""


def fone(shot):
    """Celular com sangria até a base."""
    return f'<div class="fone"><img src="{SHOTS/shot}"></div>'


def janela(shot, x, y, w):
    """Recorte ampliado de uma região do screenshot (coords da imagem 1320x2868)."""
    esc = 892 / w                      # 904 - 2*6 de borda
    return (f'<div class="janela"><img src="{SHOTS/shot}" '
            f'style="width:{1320*esc:.1f}px;left:{-x*esc:.1f}px;top:{-y*esc:.1f}px"></div>')


POSTS = [
    # 1 — capa da marca
    dict(arq="1-capa", h1=92, suby=620, subw=880, fy=790, fh=1130, jy=0, jh=0, sh=700, stops="rgba(6,26,11,0),rgba(6,26,11,.42) 18%,rgba(6,26,11,.88) 44%,rgba(6,26,11,.985) 60%,rgba(6,26,11,1) 100%",
         etq="A CARTEIRA DIGITAL DO CAC",
         titulo="Seu acervo<br>sempre em ordem.",
         sub="CRAF, guia de tráfego, laudo e CR num app só —<br>com <b>aviso antes de cada vencimento</b>.",
         corpo=fone("1-painel.png"),
         cta="⬇  Baixe grátis na App Store",
         obs="BUSQUE POR “CARTEIRA CAC”"),

    # 2 — avisos
    dict(arq="2-vencimentos", h1=90, suby=612, subw=900, fy=0, fh=0, jy=735, jh=785, sh=380, stops="rgba(6,26,11,0),rgba(6,26,11,.85) 52%,rgba(6,26,11,.99) 100%",
         etq="AVISOS",
         titulo="Nunca mais perca<br>um vencimento.",
         sub="No último mês antes de vencer, o app avisa <b>todos os dias</b> — mesmo fechado.",
         corpo=janela("5-avisos.png", 20, 702, 1280),
         cta="⬇  Baixe grátis na App Store",
         obs="CRAF · GUIA · LAUDO · CR"),

    # 3 — acervo
    dict(arq="3-acervo", h1=90, suby=612, subw=900, fy=790, fh=1130, jy=0, jh=0, sh=700, stops="rgba(6,26,11,0),rgba(6,26,11,.42) 18%,rgba(6,26,11,.88) 44%,rgba(6,26,11,.985) 60%,rgba(6,26,11,1) 100%",
         etq="ACERVO",
         titulo="Todo o seu acervo<br>numa tela só.",
         sub="Atirador, caçador ou colecionador: cada arma com o <b>status do documento à vista</b>.",
         corpo=fone("2-acervo.png"),
         cta="⬇  Baixe grátis na App Store",
         obs="ATIRADOR · CAÇADOR · COLECIONADOR"),

    # 4 — ficha da arma
    dict(arq="4-ficha", h1=88, suby=612, subw=900, fy=0, fh=0, jy=735, jh=785, sh=380, stops="rgba(6,26,11,0),rgba(6,26,11,.85) 52%,rgba(6,26,11,.99) 100%",
         etq="FICHA DA ARMA",
         titulo="Cada arma com<br>a ficha completa.",
         sub="Marca, modelo, calibre, nº de série, <b>SIGMA/SINARM</b>, local de guarda e fotos.",
         corpo=janela("3-arma.png", 10, 392, 1300),
         cta="⬇  Baixe grátis na App Store",
         obs="SÉRIE · SIGMA · CALIBRE · GUARDA"),

    # 5 — documentos
    dict(arq="5-documentos", h1=88, suby=612, subw=900, fy=790, fh=1130, jy=0, jh=0, sh=700, stops="rgba(6,26,11,0),rgba(6,26,11,.42) 18%,rgba(6,26,11,.88) 44%,rgba(6,26,11,.985) 60%,rgba(6,26,11,1) 100%",
         etq="DOCUMENTOS",
         titulo="CRAF e guia<br>na palma da mão.",
         sub="Anexe o PDF ou a foto de cada documento. <b>Abre mesmo sem internet.</b>",
         corpo=fone("4-documento.png"),
         cta="⬇  Baixe grátis na App Store",
         obs="FUNCIONA OFFLINE"),

    # 6 — segurança
    dict(arq="6-seguranca", h1=90, suby=612, subw=900, fy=790, fh=1130, jy=0, jh=0, sh=700, stops="rgba(6,26,11,0),rgba(6,26,11,.42) 18%,rgba(6,26,11,.88) 44%,rgba(6,26,11,.985) 60%,rgba(6,26,11,1) 100%",
         etq="SEGURANÇA",
         titulo="Só você abre.<br>Só no seu aparelho.",
         sub="PIN de 6 dígitos, Face ID ou digital. <b>Sem servidor e sem coleta de dados.</b>",
         corpo=fone("6-seguranca.png"),
         cta="⬇  Baixe grátis na App Store",
         obs="PIN · FACE ID · BACKUP AES-256"),

    # 7 — premium / chamada final
    dict(arq="7-premium", h1=86, suby=600, subw=900, fy=0, fh=0, jy=735, jh=785, sh=380, stops="rgba(6,26,11,0),rgba(6,26,11,.85) 52%,rgba(6,26,11,.99) 100%",
         etq="PREMIUM",
         titulo="Comece grátis.<br>Libere o acervo inteiro.",
         sub="1 arma grátis para sempre. No Premium: <b>acervo ilimitado</b>, alertas e backup do acervo.",
         corpo=janela("7-premium.png", 20, 570, 1280),
         cta="⬇  BAIXAR NA APP STORE",
         obs="APPS.APPLE.COM → CARTEIRA CAC"),
]

for p in POSTS:
    html = BASE.format(
        logo=LOGO, h1=p["h1"], suby=p["suby"], subw=p["subw"],
        fy=p["fy"] or 0, fh=p["fh"] or 0, jy=p["jy"] or 0, jh=p["jh"] or 0,
        sh=p["sh"], stops=p["stops"],
        extra="",
        corpo=f'<div class="etq"><i></i>{p["etq"]}</div>\n<h1>{p["titulo"]}</h1>\n'
              f'<div class="sub">{p["sub"]}</div>\n{p["corpo"]}',
        cta=p["cta"], obs=p["obs"],
    )
    (SAIDA / f'{p["arq"]}.html').write_text(html, encoding="utf-8")
    print("html:", p["arq"])
