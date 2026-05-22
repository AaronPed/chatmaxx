-- Make providers a first-class DB entity. Adding a new provider becomes an
-- INSERT (in the admin UI) instead of a code change, as long as it speaks one
-- of the three kinds we know how to drive.

create table if not exists providers (
  id                        serial primary key,
  name                      text not null unique,        -- slug, e.g. 'openai', 'fireworks'
  label                     text not null,               -- shown in admin UI
  kind                      text not null check (kind in ('anthropic','google','openai-compatible')),
  base_url                  text,                        -- required when kind = openai-compatible
  api_key_env               text,                        -- env var to read; null = keyless
  supports_responses_api    boolean not null default false,
  default_system_prompt_id  int references system_prompts(id) on delete set null,
  enabled                   boolean not null default true,
  sort_order                int not null default 100,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Seed the built-in providers. Anyone can add more via /admin/providers.
insert into providers (name, label, kind, base_url, api_key_env, supports_responses_api, sort_order)
values
  ('anthropic',  'Anthropic',  'anthropic',          null,                                null,                            false, 10),
  ('openai',     'OpenAI',     'openai-compatible',  'https://api.openai.com/v1',         'OPENAI_API_KEY',                true,  20),
  ('google',     'Google',     'google',             null,                                'GOOGLE_GENERATIVE_AI_API_KEY',  false, 30),
  ('openrouter', 'OpenRouter', 'openai-compatible',  'https://openrouter.ai/api/v1',      'OPENROUTER_API_KEY',            true,  40),
  ('ollama',     'Ollama',     'openai-compatible',  'http://ollama:11434/v1',            null,                            false, 50),
  ('cerebras',   'Cerebras',   'openai-compatible',  'https://api.cerebras.ai/v1',        'CEREBRAS_API_KEY',              false, 60),
  ('moonshot',   'Moonshot',   'openai-compatible',  'https://api.moonshot.cn/v1',        'MOONSHOT_API_KEY',              false, 70),
  ('deepseek',   'DeepSeek',   'openai-compatible',  'https://api.deepseek.com/v1',       'DEEPSEEK_API_KEY',              false, 80)
on conflict (name) do nothing;

-- Migrate models.provider (text) → models.provider_id (fk).
alter table models add column if not exists provider_id int references providers(id) on delete restrict;

update models m
   set provider_id = p.id
  from providers p
 where p.name = m.provider
   and m.provider_id is null;

-- Any orphan rows referencing a provider name we don't know about? Park them
-- on a synthetic 'unknown' provider rather than failing the migration.
do $$
begin
  if exists (select 1 from models where provider_id is null) then
    insert into providers (name, label, kind, base_url, enabled)
    values ('unknown', 'Unknown', 'openai-compatible', 'http://localhost', false)
    on conflict (name) do nothing;
    update models set provider_id = (select id from providers where name = 'unknown')
     where provider_id is null;
  end if;
end$$;

alter table models alter column provider_id set not null;
alter table models drop constraint if exists models_provider_model_id_key;
alter table models drop column if exists provider;
alter table models add constraint models_provider_model_unique unique (provider_id, model_id);
