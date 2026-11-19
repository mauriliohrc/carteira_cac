#!/usr/bin/env bash
# ============================================================================
# Build de RELEASE local (loja) — iOS (.ipa app-store) e Android (.aab).
# Sai em publicacoes/CarteiraCAC-<versao>-build<ios>.ipa e -vc<android>.aab.
#
#   scripts/build-release.sh            # as duas plataformas
#   scripts/build-release.sh ios        # só iOS
#   scripts/build-release.sh android    # só Android
#
# Pré-requisito: segredos de assinatura restaurados (`npm run setup`) — a
# keystore de upload (Android) e o certificado/perfil de distribuição (iOS).
# O preflight ABORTA se faltar, para nunca gerar um artefato mal-assinado.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
RAIZ="$(pwd)"
ALVO="${1:-both}"

VERSAO=$(node -e "console.log(require('./app.json').expo.version)")
IOS_BUILD=$(node -e "console.log(require('./app.json').expo.ios.buildNumber)")
AND_VC=$(node -e "console.log(require('./app.json').expo.android.versionCode)")
mkdir -p publicacoes

echo "▶ Carteira CAC $VERSAO  (iOS build $IOS_BUILD / Android vc $AND_VC)"

build_ios() {
  echo "── iOS ────────────────────────────────────────────────"
  # Preflight: com uma conta Admin logada no Xcode, o -allowProvisioningUpdates
  # cria o certificado de distribuição e o perfil na hora. Só avisamos se o cert
  # ainda não existe (será criado durante o archive/export).
  if ! security find-identity -v -p codesigning | grep -q "Apple Distribution"; then
    echo "• (sem Apple Distribution ainda — será criado via -allowProvisioningUpdates)"
  fi
  local ARCH="$RAIZ/ios/build/CarteiraCAC.xcarchive"
  local EXP="$RAIZ/ios/build/export"
  rm -rf "$ARCH" "$EXP"
  echo "• archive…"
  xcodebuild -workspace ios/CarteiraCAC.xcworkspace -scheme CarteiraCAC \
    -configuration Release -destination 'generic/platform=iOS' \
    -archivePath "$ARCH" -allowProvisioningUpdates archive
  echo "• export (app-store)…"
  xcodebuild -exportArchive -archivePath "$ARCH" \
    -exportOptionsPlist ios/exportOptions.plist -exportPath "$EXP" \
    -allowProvisioningUpdates
  local IPA
  IPA=$(ls "$EXP"/*.ipa | head -1)
  local DEST="publicacoes/CarteiraCAC-${VERSAO}-build${IOS_BUILD}.ipa"
  cp "$IPA" "$DEST"
  echo "✓ $DEST"
}

build_android() {
  echo "── Android ────────────────────────────────────────────"
  # Preflight: a assinatura de release exige a propriedade CC_STORE_FILE
  # (senão o build.gradle cai na keystore de DEBUG, inútil para a Play).
  if ! grep -qs CC_STORE_FILE "$HOME/.gradle/gradle.properties" android/gradle.properties; then
    echo "✗ CC_STORE_FILE não encontrado (keystore de upload ausente)." >&2
    echo "  Rode 'npm run setup -- --force' e tente de novo." >&2
    exit 1
  fi
  ( cd android && ./gradlew --no-daemon :app:bundleRelease )
  local AAB="android/app/build/outputs/bundle/release/app-release.aab"
  local DEST="publicacoes/CarteiraCAC-${VERSAO}-vc${AND_VC}.aab"
  cp "$AAB" "$DEST"
  echo "✓ $DEST"
}

case "$ALVO" in
  ios) build_ios ;;
  android) build_android ;;
  both) build_ios; build_android ;;
  *) echo "uso: $0 [ios|android|both]" >&2; exit 2 ;;
esac

echo "▶ pronto. Artefatos em publicacoes/:"
ls -lh publicacoes/CarteiraCAC-${VERSAO}-* 2>/dev/null || true
