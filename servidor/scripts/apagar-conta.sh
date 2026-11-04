#!/usr/bin/env bash
#
# Apaga uma conta do app (usuarios_app) por e-mail. A exclusão em cascata do
# schema remove registros_sync, arquivos_sync, vínculos e leituras; dispositivos,
# usos de cupom, resultados e logs ficam órfãos (SetNull). Para TESTE.
#
# Uso (de dentro de servidor/):  ./scripts/apagar-conta.sh <email>

set -euo pipefail

ALVO="${1:-}"
[[ -z "$ALVO" ]] && { echo "Uso: $0 <email>" >&2; exit 1; }

DIR_SERVIDOR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$DIR_SERVIDOR/.env"
[[ -f "$ENV_FILE" ]] || { echo "Não achei $ENV_FILE" >&2; exit 1; }
urldecode() { printf '%b' "${1//%/\\x}"; }
URL="$(grep -E '^DATABASE_URL' "$ENV_FILE" | head -1 | sed -E 's/^DATABASE_URL=//; s/"//g')"
DB_USER="$(urldecode "$(echo "$URL" | sed -E 's|mysql://([^:]+):.*|\1|')")"
DB_PASS="$(urldecode "$(echo "$URL" | sed -E 's|mysql://[^:]+:([^@]*)@.*|\1|')")"
DB_HOST="$(echo "$URL" | sed -E 's|.*@([^:/]+):?([0-9]*)/.*|\1|')"
DB_PORT="$(echo "$URL" | sed -E 's|.*@[^:/]+:([0-9]+)/.*|\1|')"
DB_NAME="$(echo "$URL" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')"
[[ -n "$DB_PORT" ]] || DB_PORT="3306"
if [[ "$DB_HOST" == "127.0.0.1" || "$DB_HOST" == "localhost" ]]; then
  if ! nc -z -G 3 "$DB_HOST" "$DB_PORT" >/dev/null 2>&1; then
    echo "• Abrindo túnel SSH..." >&2
    ssh -f -N -o BatchMode=yes -o ConnectTimeout=8 -L "$DB_PORT:127.0.0.1:3306" app@api.carteiracac.com
    sleep 1
  fi
fi
m() { mysql -u"$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -P "$DB_PORT" "$DB_NAME" -N -B -e "$1" 2>/dev/null; }

INFO="$(m "SELECT id, nome, email, cpf FROM usuarios_app WHERE email='$ALVO' LIMIT 1;")"
[[ -z "$INFO" ]] && { echo "Nenhuma conta com e-mail '$ALVO'." >&2; exit 1; }
USR="$(echo "$INFO" | cut -f1)"

echo
echo "Vai apagar:"
echo "  nome : $(echo "$INFO" | cut -f2)"
echo "  email: $(echo "$INFO" | cut -f3)"
echo "  cpf  : $(echo "$INFO" | cut -f4)"
echo "  id   : $USR"
echo "  registros_sync: $(m "SELECT COUNT(*) FROM registros_sync WHERE usuarioId='$USR';") | arquivos_sync: $(m "SELECT COUNT(*) FROM arquivos_sync WHERE usuarioId='$USR';")"
echo

m "DELETE FROM usuarios_app WHERE id='$USR';"

RESTA="$(m "SELECT COUNT(*) FROM usuarios_app WHERE id='$USR';")"
if [[ "$RESTA" == "0" ]]; then
  echo "✓ Conta apagada."
else
  echo "✗ Algo impediu a exclusão (restou $RESTA)." >&2
  exit 1
fi
