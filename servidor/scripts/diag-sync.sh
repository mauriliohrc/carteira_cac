#!/usr/bin/env bash
#
# Diagnóstico de sincronização: mostra o que a conta tem no ESPELHO da nuvem.
#
# Uso (rode de dentro de servidor/):
#   ./scripts/diag-sync.sh <email-ou-cpf>
#
# Conta registros_sync por tipo (e tombstones) + arquivos_sync da conta.
# Abre o túnel SSH (127.0.0.1:3307 -> api.carteiracac.com:3306) se preciso.

set -euo pipefail

ALVO="${1:-}"
if [[ -z "$ALVO" ]]; then
  echo "Uso: $0 <email-ou-cpf>" >&2
  exit 1
fi

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
    echo "• Abrindo túnel SSH ($DB_PORT -> api.carteiracac.com:3306)..." >&2
    ssh -f -N -o BatchMode=yes -o ConnectTimeout=8 \
      -L "$DB_PORT:127.0.0.1:3306" app@api.carteiracac.com
    sleep 1
    nc -z -G 3 "$DB_HOST" "$DB_PORT" >/dev/null 2>&1 \
      || { echo "Não consegui abrir o túnel." >&2; exit 1; }
  fi
fi

m() { mysql -u"$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -P "$DB_PORT" "$DB_NAME" -N -B -e "$1" 2>/dev/null; }

DIG="${ALVO//[^0-9]/}"
INFO="$(m "SELECT id, nome, email, cpf, emailVerificado, criadoEm FROM usuarios_app WHERE email='$ALVO' OR cpf='$DIG' LIMIT 1;")"
if [[ -z "$INFO" ]]; then
  echo "Nenhum usuário com '$ALVO'." >&2
  exit 1
fi
USR="$(echo "$INFO" | cut -f1)"

echo
echo "Usuário: $(echo "$INFO" | cut -f2) | $(echo "$INFO" | cut -f3) | CPF $(echo "$INFO" | cut -f4) | emailVerificado=$(echo "$INFO" | cut -f5) | criado $(echo "$INFO" | cut -f6)"
echo "usuarioId: $USR"
echo
echo "== registros_sync por tipo (ativos vs removidos) =="
m "SELECT tipo,
          SUM(removido=0) AS ativos,
          SUM(removido=1) AS removidos,
          MIN(carimboServidor) AS primeiro,
          MAX(carimboServidor) AS ultimo
   FROM registros_sync WHERE usuarioId='$USR' GROUP BY tipo ORDER BY tipo;" \
  | awk -F'\t' 'BEGIN{printf "%-20s %7s %10s  %-26s %-26s\n","tipo","ativos","removidos","primeiro","ultimo"}
                {printf "%-20s %7s %10s  %-26s %-26s\n",$1,$2,$3,$4,$5}'
echo
echo "Total registros_sync: $(m "SELECT COUNT(*) FROM registros_sync WHERE usuarioId='$USR';")"
echo "Total arquivos_sync:  $(m "SELECT COUNT(*) FROM arquivos_sync WHERE usuarioId='$USR';")"
echo
