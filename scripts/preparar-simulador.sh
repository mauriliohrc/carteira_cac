#!/usr/bin/env bash
#
# Prepara o iOS Simulator e sobe o CAC Brasil nele.
#
# Rode DEPOIS que o Xcode terminar de instalar pela App Store.
# Vai pedir sua senha de administrador uma vez (o macOS exige para apontar as
# ferramentas de linha de comando e aceitar a licença do Xcode).
#
#   ./scripts/preparar-simulador.sh
#
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
XCODE="/Applications/Xcode.app"

passo() { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }
erro()  { printf '\n\033[1;31mx\033[0m %s\n' "$1" >&2; }

# ------------------------------------------------------------------ 1. Xcode
if [ ! -d "$XCODE" ]; then
  erro "Xcode não encontrado em $XCODE."
  cat <<'FIM'

   Instale pela App Store (é gratuito, ~8 GB de download):

     open 'macappstore://apps.apple.com/app/id497799835'

   Quando terminar, rode este script de novo.
FIM
  exit 1
fi
passo "Xcode encontrado em $XCODE"

# ------------------------------------------- 2. apontar as ferramentas de CLI
ATUAL="$(xcode-select -p 2>/dev/null || echo '')"
if [ "$ATUAL" != "$XCODE/Contents/Developer" ]; then
  passo "Apontando as ferramentas de linha de comando para o Xcode (pede sua senha)"
  sudo xcode-select -s "$XCODE/Contents/Developer"
else
  passo "Ferramentas de linha de comando já apontam para o Xcode"
fi

# ------------------------------------------------ 3. licença e primeiro boot
passo "Aceitando a licença e rodando a primeira inicialização do Xcode"
sudo xcodebuild -license accept
sudo xcodebuild -runFirstLaunch

# ----------------------------------------------------- 4. runtime do iOS
if ! xcrun simctl list runtimes 2>/dev/null | grep -q "iOS"; then
  passo "Baixando a plataforma iOS (runtime do simulador)"
  xcodebuild -downloadPlatform iOS
else
  passo "Runtime do iOS já instalado"
fi

passo "Simuladores disponíveis"
xcrun simctl list devices available | grep -A 20 -- "-- iOS" | head -25

# ------------------------------------------------------ 5. node do projeto
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$HOME/.nvm/nvm.sh"
  nvm use >/dev/null 2>&1 || true
fi
passo "Node em uso: $(node -v)"

# ------------------------------------------------------- 6. subir o app
cd "$RAIZ"
passo "Compilando e abrindo o CAC Brasil no simulador (a primeira vez demora)"
npx expo run:ios
