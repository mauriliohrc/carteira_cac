#!/usr/bin/env bash
# Gera o logo de perfil, 10 posts de feed (1080x1080) e 10 stories (1080x1920).
# Uso: ./fontes/gerar_tudo.sh   (rodar a partir de store/social)
set -euo pipefail
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
cd "$(dirname "$0")/.."   # store/social

python3 fontes/perfil.py
python3 fontes/feed.py
python3 fontes/stories.py

shot () {  # $1=html  $2=largura  $3=altura
  local n="${1%.html}"
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --force-device-scale-factor=1 --window-size="$2,$3" \
    --default-background-color=00000000 --virtual-time-budget=4500 \
    --screenshot="$n.png" "file://$PWD/$1" >/dev/null 2>&1
  echo "png: $n.png"
}

for f in perfil/*.html;  do shot "$f" 1080 1080; done
for f in feed/*.html;    do shot "$f" 1080 1080; done
for f in stories/*.html; do shot "$f" 1080 1920; done

echo "OK — perfil/ feed/ stories/ gerados."
