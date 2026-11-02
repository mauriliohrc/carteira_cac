#!/usr/bin/env bash
#
# Lista as habitualidades de um atirador direto do banco de produção.
#
# Uso (rode de dentro de servidor/):
#   ./scripts/habitualidades.sh <CPF> [opções]
#
# Opções:
#   --hoje              só as lançadas/com data de hoje
#   --data YYYY-MM-DD   só as de uma data específica (campo "data" da prática)
#   --ultimas N         as N mais recentes (padrão: 10)
#   --todas             todas
#
# Exemplos:
#   ./scripts/habitualidades.sh 01342191129 --hoje
#   ./scripts/habitualidades.sh 01342191129 --ultimas 5
#   ./scripts/habitualidades.sh 01342191129 --data 2026-10-14
#
# Abre o túnel SSH (127.0.0.1:3307 -> api.carteiracac.com:3306) automaticamente
# se ele ainda não estiver de pé. Credenciais vêm do servidor/.env (DATABASE_URL).

set -euo pipefail

CPF="${1:-}"
if [[ -z "$CPF" ]]; then
  echo "Uso: $0 <CPF> [--hoje | --data YYYY-MM-DD | --ultimas N | --todas]" >&2
  exit 1
fi
shift || true
CPF="${CPF//[^0-9]/}"  # só dígitos

MODO="ultimas"; ARG="10"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --hoje)    MODO="hoje"; shift ;;
    --todas)   MODO="todas"; shift ;;
    --data)    MODO="data"; ARG="${2:?data faltando}"; shift 2 ;;
    --ultimas) MODO="ultimas"; ARG="${2:?N faltando}"; shift 2 ;;
    *) echo "Opção desconhecida: $1" >&2; exit 1 ;;
  esac
done

# Raiz de servidor/ (este script vive em servidor/scripts/)
DIR_SERVIDOR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$DIR_SERVIDOR/.env"
[[ -f "$ENV_FILE" ]] || { echo "Não achei $ENV_FILE" >&2; exit 1; }

# Decodifica %XX (ex.: %40 -> @) de credenciais vindas da URL.
urldecode() { printf '%b' "${1//%/\\x}"; }

URL="$(grep -E '^DATABASE_URL' "$ENV_FILE" | head -1 | sed -E 's/^DATABASE_URL=//; s/"//g')"
DB_USER="$(urldecode "$(echo "$URL" | sed -E 's|mysql://([^:]+):.*|\1|')")"
DB_PASS="$(urldecode "$(echo "$URL" | sed -E 's|mysql://[^:]+:([^@]*)@.*|\1|')")"
DB_HOST="$(echo "$URL" | sed -E 's|.*@([^:/]+):?([0-9]*)/.*|\1|')"
DB_PORT="$(echo "$URL" | sed -E 's|.*@[^:/]+:([0-9]+)/.*|\1|')"
DB_NAME="$(echo "$URL" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')"
[[ -n "$DB_PORT" ]] || DB_PORT="3306"

# Garante o túnel SSH se o banco aponta pra 127.0.0.1 e a porta está fechada.
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

SQL="SELECT r.dados FROM registros_sync r
     JOIN usuarios_app u ON u.id = r.usuarioId
     WHERE u.cpf='$CPF' AND r.tipo='habitualidades' AND r.removido=0
     ORDER BY r.atualizadoEm DESC;"

NOME="$(mysql -u"$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -P "$DB_PORT" "$DB_NAME" -N -B \
  -e "SELECT nome FROM usuarios_app WHERE cpf='$CPF';" 2>/dev/null)"
if [[ -z "$NOME" ]]; then
  echo "Nenhum atirador com CPF $CPF." >&2
  exit 1
fi

PYCODE="$(cat << 'PY'
import json, os, sys, datetime

MODO=os.environ["MODO"]; ARG=os.environ["ARG"]
NOME=os.environ["NOME"]; CPF=os.environ["CPF"]

GRUPO={
 'CC_RESTRITA':'Arma curta restrita (CC-R)',
 'CC_PERMITIDA':'Arma curta permitida (CC-P)',
 'CLR_RESTRITA':'Arma longa restrita (CLR-R)',
 'CLR_PERMITIDA':'Arma longa permitida (CLR-P)',
}
HOJE=datetime.date.today().isoformat()

def brt(iso):
    try:
        dt=datetime.datetime.fromisoformat(iso.replace('Z','+00:00'))
        return dt.astimezone(datetime.timezone(datetime.timedelta(hours=-3)))
    except Exception:
        return None

recs=[]
for line in sys.stdin:
    line=line.strip()
    if line:
        try: recs.append(json.loads(line))
        except Exception: pass

recs.sort(key=lambda r: r.get('criado_em') or '', reverse=True)

if MODO=="hoje":
    sel=[r for r in recs if r.get('data')==HOJE or
         (brt(r.get('criado_em','')) and brt(r['criado_em']).strftime('%Y-%m-%d')==HOJE)]
    titulo=f"habitualidades de hoje ({HOJE})"
elif MODO=="data":
    sel=[r for r in recs if r.get('data')==ARG]
    titulo=f"habitualidades com data {ARG}"
elif MODO=="todas":
    sel=recs; titulo="todas as habitualidades"
else:
    try: n=int(ARG)
    except Exception: n=10
    sel=recs[:n]; titulo=f"últimas {len(sel)} habitualidades"

print(f"\n{NOME} (CPF {CPF}) — {titulo}: {len(sel)}\n")
for i,r in enumerate(sel,1):
    t=brt(r.get('criado_em',''))
    hora=t.strftime('%d/%m/%Y %H:%M') if t else '--'
    data=r.get('data') or '--'
    try:
        d=datetime.date.fromisoformat(data); data=d.strftime('%d/%m/%Y')
    except Exception: pass
    armas=r.get('_armas') or []
    print(f"{i}) data {data} | lançada {hora} BRT | tipo {r.get('tipo')} | "
          f"local {r.get('local_nome') or '—'} | origem {r.get('origem') or '—'} | {len(armas)} arma(s)")
    for a in armas:
        cat=GRUPO.get(a.get('grupo'), a.get('grupo') or '—')
        print(f"     - [{cat}] {a.get('arma_nome')}")
    if r.get('observacoes'):
        print(f"     obs: {r['observacoes']}")
    print()
PY
)"

mysql -u"$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -P "$DB_PORT" "$DB_NAME" -N -B \
  -e "$SQL" 2>/dev/null \
| MODO="$MODO" ARG="$ARG" NOME="$NOME" CPF="$CPF" python3 -c "$PYCODE"
