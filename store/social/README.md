# Social — Carteira CAC

Artes para Instagram (e Status do WhatsApp) na identidade do app:
verde `#0F3D1E`, ouro `#D8AE3A`, creme `#FBFAF3`, o escudo da marca e os
screenshots reais de `store/screenshots/6.9/`.

## Estrutura

```
social/
├── perfil/     logo redondo p/ foto de perfil (1080×1080)
├── feed/       10 posts quadrados do feed (1080×1080)
├── stories/    10 stories / status (1080×1920)
└── fontes/     HTML + scripts geradores (não publicar)
```

> As 7 imagens soltas na raiz (`1-capa.png`…`7-premium.png`) são a versão
> anterior e foram **substituídas** pela pasta `stories/` (mesmo conteúdo + 3 artes
> novas). Pode apagá-las quando quiser.

---

## Perfil

`perfil/logo-instagram.png` — escudo centralizado sobre o verde da marca, com anel
dourado marcando a área de recorte circular. Use direto como foto de perfil do
Instagram e do WhatsApp (o app recorta em círculo automaticamente).

---

## Feed (1080×1080) — ordem e legendas sugeridas

| # | Arquivo | Tema | Legenda |
|---|---|---|---|
| 1 | `01-capa.png` | Marca / abertura | Sua carteira de CAC organizada num app só. 🇧🇷 CRAF, guia, laudo e CR com aviso antes de cada vencimento. **Link na bio.** |
| 2 | `02-vencimentos.png` | Avisos | Documento vencido é dor de cabeça na hora errada. No último mês antes de vencer, o app avisa **todos os dias** — mesmo fechado. |
| 3 | `03-acervo.png` | Acervo | Todo o seu acervo numa tela só, com o status de cada arma à vista: em dia, vencendo ou vencido. |
| 4 | `04-ficha.png` | Ficha da arma | Marca, modelo, calibre, nº de série, SIGMA/SINARM, local de guarda e fotos — cada arma com a ficha completa. |
| 5 | `05-documentos.png` | Documentos | Anexe o PDF ou a foto do CRAF e da guia. Abre no estande **mesmo sem internet.** |
| 6 | `06-seguranca.png` | Segurança | Só você abre: PIN de 6 dígitos, Face ID ou digital. Sem servidor, sem nuvem, sem coleta de dados. |
| 7 | `07-clubes.png` | Clubes parceiros | É sócio de um clube ou entidade parceira? Você tem direito ao **Premium anual exclusivo** dentro do app. Seu clube quer ser parceiro? Chama a gente. |
| 8 | `08-publico.png` | Público | Atirador, caçador ou colecionador: um só app para organizar o acervo de qualquer categoria. |
| 9 | `09-gratis.png` | Comece grátis | 1 arma grátis para sempre, sem cartão. No Premium: acervo ilimitado, alertas diários e backup. |
| 10 | `10-baixe.png` | Download | Seu acervo organizado, seguro e sempre em dia. Baixe grátis na App Store — busque por "Carteira CAC". |

## Stories (1080×1920)

Mesmos 10 temas na proporção vertical. Área segura respeitada: nada vital nos
~210 px do topo (avatar do Stories) nem nos ~220 px da base (barra de resposta /
link do Status). Arquivos `01-capa.png` … `10-baixe.png`.

Publique um por dia, **ou** os 10 em sequência como uma série (a 01 abre, a 10
fecha com o CTA de download).

---

## Link e hashtags

Figurinha de link (Stories) / link do Status / link na bio:
`https://apps.apple.com/br/app/carteira-cac/id6814230068`

Hashtags: `#CAC #ClubeDeTiro #TiroEsportivo #Colecionador #Cacador #Atirador #CRAF #CR #ArmasLegais`

---

## Como regerar

```bash
cd store/social && ./fontes/gerar_tudo.sh
```

- `fontes/perfil.py` — logo de perfil
- `fontes/feed.py` — 10 posts quadrados (layout A: texto + celular; layout B: declaração)
- `fontes/stories.py` — 10 stories (celular, recorte ou blocos)
- `fontes/gerar_tudo.sh` — roda os três e rasteriza tudo com o Chrome headless

Para trocar o recorte de um screenshot, ajuste `janela(arquivo, x, y, largura)`
(coordenadas na imagem original de 1320×2868) ou `fone(arquivo)` para o celular inteiro.
