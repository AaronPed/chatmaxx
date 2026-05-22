# chatmaxx

A quiet little chat app: Times New Roman, paper-colored, a touch of grain, and
a Postgres-backed history. SvelteKit + TypeScript, one container.

## Run it

```sh
cp .env.example .env
# at minimum: set ADMIN_PASSWORD and one provider key (e.g. ANTHROPIC_API_KEY)
docker compose up --build
```

- App: <http://localhost:3000>
- Admin: <http://localhost:3000/admin>

Migrations run automatically on container start.

## Configure models

Sign in to `/admin`, open **Models**, enable the ones whose keys you've set, and
edit labels / sort order. Seeded defaults cover Anthropic (enabled) plus a row
per other provider (disabled). Add more rows for any model ID your provider
exposes.

## Providers

| Provider   | Env var                | Notes                                      |
|------------|------------------------|--------------------------------------------|
| Anthropic  | `ANTHROPIC_API_KEY`    | Native SDK                                 |
| OpenAI     | `OPENAI_API_KEY`       |                                            |
| OpenRouter | `OPENROUTER_API_KEY`   | One key, many models                       |
| Cerebras   | `CEREBRAS_API_KEY`     | OpenAI-compatible                          |
| Moonshot   | `MOONSHOT_API_KEY`     | OpenAI-compatible                          |
| DeepSeek   | `DEEPSEEK_API_KEY`     | OpenAI-compatible                          |
| Ollama     | _(none)_               | Set `OLLAMA_BASE_URL` if not on the host   |

## Local development (without Docker)

```sh
npm install
# start Postgres separately, then:
export DATABASE_URL=postgres://chatmaxx:chatmaxx@localhost:5432/chatmaxx
export ADMIN_PASSWORD=dev
npm run migrate
npm run dev
```

## Structure

```
src/
  routes/
    +page.svelte            # chat UI
    admin/                  # admin pages (protected by hook)
    api/                    # JSON + streaming endpoints
  lib/
    components/             # NicknameGate, Sidebar, ChatPane
    server/                 # db, repo, providers, admin-auth, request-meta
    client/                 # session (localStorage)
    styles/global.css       # paper palette + grainy noise overlay
migrations/                 # ordered *.sql files (idempotent)
scripts/migrate.mjs         # tiny ordered-file migrator
docker/entrypoint.sh        # waits for db, runs migrations, then starts app
```

## What gets logged

Each chat turn writes a row to `interactions` with a hashed-IP fingerprint
(`ip_hash` = sha256 of `IP_HASH_SALT + ip`, truncated), user agent, country
header (if any), referer, model, latency, and token usage. The admin dashboard
aggregates these.
