#!/bin/sh
# Wait for Postgres, run migrations, then exec the requested command (usually `node build`).
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] DATABASE_URL is required" >&2
  exit 1
fi

# Poll until Postgres accepts a connection.
i=0
until node -e "const p=require('postgres')(process.env.DATABASE_URL,{max:1,connect_timeout:3});p\`select 1\`.then(()=>p.end()).then(()=>process.exit(0)).catch(()=>process.exit(1))" 2>/dev/null; do
  i=$((i+1))
  if [ "$i" -gt 40 ]; then
    echo "[entrypoint] postgres did not come up in time" >&2
    exit 1
  fi
  echo "[entrypoint] waiting for postgres ($i)…"
  sleep 1
done

echo "[entrypoint] running migrations"
node ./scripts/migrate.mjs

echo "[entrypoint] starting app: $*"
exec "$@"
