# Impressos — Carteira CAC

Material A4 para impressão, pensado para fixar nas **entidades e clubes de tiro**.
QR code grande apontando para a página de download, identidade visual da marca
(verde `#0F3D1E`, ouro `#D8AE3A`, creme, escudo) e chamada curta e direta.

## Arquivos

| Arquivo | Uso |
|---|---|
| `cartaz-a4-retrato.pdf` | **Para a gráfica** — A4 retrato (210×297 mm), 1 página |
| `cartaz-a4-paisagem.pdf` | **Para a gráfica** — A4 paisagem (297×210 mm), 1 página |
| `cartaz-a4-retrato.png` | Prévia / uso em tela (retrato) |
| `cartaz-a4-paisagem.png` | Prévia / uso em tela (paisagem) |

Os PDFs são A4 exato (`MediaBox` 595×842 pt), sangria 0 e fundo colorido com
`print-color-adjust: exact` — mande imprimir **em escala 100% / tamanho real**,
sem "ajustar à página".

## QR code

- Aponta para **https://www.carteiracac.com/download** (a página que detecta
  iPhone/Android e redireciona para a loja certa).
- Gerado como **vetor (SVG)** com correção de erro nível **H** (até ~30% de
  tolerância), então continua legível mesmo com desgaste ou impressão pequena.
- Fica dentro de um cartão creme para garantir contraste na leitura.

> Trocar o destino do QR: altere a constante `URL` em `fontes/gerar.js` e regere.

## Como regerar

```bash
cd store/impressos && ./fontes/gerar.sh
```

Gera os 2 HTML, imprime cada um em PDF A4 (Chrome headless, `--print-to-pdf`,
orientação definida pelo `@page size` no CSS) e exporta os PNG de prévia.

Depende da lib `qrcode` (Node). O script aponta para a instalação do scratchpad
via a constante `QR_LIB` em `fontes/gerar.js`; se ela sumir, reinstale:

```bash
npm install qrcode   # e ajuste QR_LIB para o caminho do node_modules
```
