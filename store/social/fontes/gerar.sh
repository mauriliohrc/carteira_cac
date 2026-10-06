#!/usr/bin/env bash
# Regera as 7 artes 1080x1920 a partir dos screenshots de store/screenshots/6.9.
# Uso: ./fontes/gerar.sh   (rodar a partir de store/social)
set -euo pipefail
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
cd "$(dirname "$0")/.."
python3 fontes/gerar.py
for f in fontes/*.html; do
  n=$(basename "$f" .html)
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --force-device-scale-factor=1 --window-size=1080,1920 \
    --virtual-time-budget=4000 --screenshot="$n.png" "file://$PWD/$f" >/dev/null 2>&1
  echo "png: $n"
done
