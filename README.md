# chatmaxx

yap yap yap yap with an LLM of your choice

## Run it

```sh
cp .env.example .env
# at minimum: set ADMIN_PASSWORD and one provider key (e.g. ANTHROPIC_API_KEY)
docker compose up --build
```

- App: <http://localhost:3000>
- Admin: <http://localhost:3000/admin>

Migrations run automatically on container start.

## Providers

| Provider   | Env var                          | Notes                                    |
|------------|----------------------------------|------------------------------------------|
| Anthropic  | `ANTHROPIC_API_KEY`              | Native SDK                               |
| OpenAI     | `OPENAI_API_KEY`                 | Chat + Responses API (tools)             |
| Google     | `GOOGLE_GENERATIVE_AI_API_KEY`   | Native SDK (Gemini)                      |
| OpenRouter | `OPENROUTER_API_KEY`             | One key, many models                     |
| Cerebras   | `CEREBRAS_API_KEY`               | OpenAI-compatible                        |
| Moonshot   | `MOONSHOT_API_KEY`               | OpenAI-compatible                        |
| DeepSeek   | `DEEPSEEK_API_KEY`               | OpenAI-compatible                        |
| Ollama     | _(none)_                         | Set `OLLAMA_BASE_URL` if not on the host |

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
    components/             # AuthGate, Sidebar, ChatPane, Sparkles, LineChart
    server/                 # db, repo, providers, tools, admin-auth, user-auth,
                            #   login-throttle, request-meta
    client/                 # session (auth), markdown (render pipeline), theme
    styles/global.css       # paper palette + grainy noise overlay
migrations/                 # ordered *.sql files (idempotent)
scripts/migrate.mjs         # tiny ordered-file migrator
docker/entrypoint.sh        # waits for db, runs migrations, then starts app
```
