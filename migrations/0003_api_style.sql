-- Lets a model row pick between OpenAI-style Chat Completions and the newer
-- Responses API where the provider supports it (currently OpenAI + OpenRouter).
-- Other providers ignore the column.

alter table models
  add column if not exists api_style text not null default 'chat'
    check (api_style in ('chat', 'responses'));
