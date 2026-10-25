#!/usr/bin/env bash
# Postgres 16 desechable para las pruebas de integración de la API
# (pnpm --filter @atleta/api test:integration). Ver docs/mcp.md.
#
#   scripts/test-db.sh          # levanta (o reutiliza) la BD e imprime TEST_DATABASE_URL
#   scripts/test-db.sh stop     # la detiene y borra
#
# Usa Docker (postgres:16-alpine en el puerto 55432) si está disponible; si no, los
# binarios locales de /usr/lib/postgresql/16/bin corriendo como el usuario `postgres`
# (initdb no corre como root). Las pruebas BORRAN la BD: no apuntes a una real.
set -euo pipefail

PORT="${TEST_DB_PORT:-55432}"
NAME="atleta-test-db"
URL="postgres://atleta:atleta@127.0.0.1:${PORT}/atleta_test"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
DATA_DIR="${TEST_DB_DATA_DIR:-/tmp/atleta-test-db}"

wait_ready() {
  for _ in $(seq 1 60); do
    if pg_isready -h 127.0.0.1 -p "$PORT" -q 2>/dev/null || \
       (command -v docker >/dev/null && docker exec "$NAME" pg_isready -U atleta -q 2>/dev/null); then
      return 0
    fi
    sleep 0.5
  done
  echo "Postgres no respondió en el puerto $PORT" >&2
  exit 1
}

if [[ "${1:-}" == "stop" ]]; then
  if command -v docker >/dev/null && docker inspect "$NAME" >/dev/null 2>&1; then
    docker rm -f "$NAME" >/dev/null
  elif [[ -d "$DATA_DIR" ]]; then
    su postgres -c "$PG_BIN/pg_ctl -D $DATA_DIR stop -m fast" || true
    rm -rf "$DATA_DIR"
  fi
  echo "BD de pruebas detenida"
  exit 0
fi

if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
  if ! docker inspect "$NAME" >/dev/null 2>&1; then
    docker run -d --name "$NAME" -p "${PORT}:5432" \
      -e POSTGRES_USER=atleta -e POSTGRES_PASSWORD=atleta -e POSTGRES_DB=atleta_test \
      postgres:16-alpine >/dev/null
  else
    docker start "$NAME" >/dev/null
  fi
elif [[ -x "$PG_BIN/initdb" ]]; then
  if [[ ! -d "$DATA_DIR" ]]; then
    mkdir -p "$DATA_DIR" && chown postgres "$DATA_DIR"
    su postgres -c "$PG_BIN/initdb -D $DATA_DIR -U postgres --auth=trust >/dev/null"
  fi
  if ! su postgres -c "$PG_BIN/pg_ctl -D $DATA_DIR status" >/dev/null 2>&1; then
    su postgres -c "$PG_BIN/pg_ctl -D $DATA_DIR -o '-p $PORT -k /tmp' -l $DATA_DIR/server.log start" >/dev/null
  fi
  wait_ready
  psql -h 127.0.0.1 -p "$PORT" -U postgres -tc "select 1 from pg_roles where rolname = 'atleta'" | grep -q 1 || \
    psql -h 127.0.0.1 -p "$PORT" -U postgres -qc "create role atleta login superuser password 'atleta'"
  psql -h 127.0.0.1 -p "$PORT" -U postgres -tc "select 1 from pg_database where datname = 'atleta_test'" | grep -q 1 || \
    psql -h 127.0.0.1 -p "$PORT" -U postgres -qc "create database atleta_test owner atleta"
else
  echo "Se necesita Docker o Postgres 16 en $PG_BIN" >&2
  exit 1
fi

wait_ready
echo "TEST_DATABASE_URL=$URL"
echo "Ejemplo: TEST_DATABASE_URL=$URL pnpm --filter @atleta/api test:integration"
