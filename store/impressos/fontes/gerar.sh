#!/usr/bin/env bash
# Gera os cartazes A4 (retrato + paisagem) em PDF pronto para gráfica + PNG de prévia.
# Uso: ./fontes/gerar.sh   (rodar a partir de store/impressos)
set -euo pipefail
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
cd "$(dirname "$0")/.."   # store/impressos

node fontes/gerar.js

for nome in cartaz-a4-retrato cartaz-a4-paisagem; do
  # PDF A4 exato (a orientação vem do @page size no CSS)
  "$CHROME" --headless --disable-gpu --no-sandbox --no-pdf-header-footer \
    --print-to-pdf="$nome.pdf" "file://$PWD/$nome.html" >/dev/null 2>&1
  echo "pdf: $nome.pdf"
done

# PNG de prévia (A4 @ ~150dpi)
"$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=794,1123 --virtual-time-budget=3000 \
  --screenshot="cartaz-a4-retrato.png" "file://$PWD/cartaz-a4-retrato.html" >/dev/null 2>&1
echo "png: cartaz-a4-retrato.png"
"$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=1123,794 --virtual-time-budget=3000 \
  --screenshot="cartaz-a4-paisagem.png" "file://$PWD/cartaz-a4-paisagem.html" >/dev/null 2>&1
echo "png: cartaz-a4-paisagem.png"

echo "OK — cartazes gerados em store/impressos/"
