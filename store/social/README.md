# Artes para Stories / Status — Carteira CAC

7 imagens **1080×1920** (Instagram Stories e Status do WhatsApp), na identidade do app:
verde `#0F3D1E`, ouro `#D8AE3A`, creme `#FBFAF3`, logo do escudo e os screenshots reais
de `store/screenshots/6.9/`.

Área segura respeitada: nada de texto nos 210 px de cima nem nos 220 px de baixo
(onde ficam o avatar do Stories e a barra de resposta do WhatsApp).

## Ordem de publicação

| # | Arquivo | Destaque | Screenshot usado |
|---|---|---|---|
| 1 | `1-capa.png` | Abertura da marca — "Seu acervo sempre em ordem" | Painel |
| 2 | `2-vencimentos.png` | Alerta diário no último mês antes de vencer | Avisos |
| 3 | `3-acervo.png` | Acervo inteiro numa tela, com status por arma | Acervo |
| 4 | `4-ficha.png` | Ficha completa: série, SIGMA, calibre, guarda | Ficha da arma |
| 5 | `5-documentos.png` | CRAF/guia com anexo em PDF ou foto, offline | Documento |
| 6 | `6-seguranca.png` | PIN, Face ID, sem servidor e sem coleta | Segurança |
| 7 | `7-premium.png` | Grátis para começar + chamada de download | Premium |

Publique uma por dia, ou as 7 em sequência como uma sequência de Stories (a 1 abre e a 7 fecha com o CTA).

## Legendas sugeridas (para o texto do post / link da figurinha)

1. Sua carteira de CAC organizada num app só. 🇧🇷 Link na bio.
2. Documento vencido é dor de cabeça na hora errada. O app avisa todo dia no último mês.
3. Atirador, caçador ou colecionador: cada arma com o status do documento à vista.
4. Marca, modelo, calibre, nº de série, SIGMA e local de guarda — tudo numa ficha.
5. Anexe o PDF ou a foto do CRAF e da guia. Abre no estande mesmo sem sinal.
6. Sem servidor, sem nuvem, sem coleta. PIN de 6 dígitos e Face ID.
7. Comece grátis hoje. Link direto: https://apps.apple.com/br/app/carteira-cac/id6814230068

Figurinha de link (Stories) / link do Status:
`https://apps.apple.com/br/app/carteira-cac/id6814230068`

Hashtags: `#CAC #ClubeDeTiro #TiroEsportivo #Colecionador #Cacador #Atirador #CRAF #CR #ArmasLegais`

## Como regerar

```bash
cd store/social && ./fontes/gerar.sh
```

O layout vive em `fontes/gerar.py` (HTML + CSS) e é rasterizado pelo Chrome headless.
Para trocar um recorte, ajuste `janela(arquivo, x, y, largura)` — coordenadas na imagem
original de 1320×2868.
