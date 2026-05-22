-- chatmaxx schema

create extension if not exists pgcrypto;

create table if not exists users (
  id            uuid primary key,
  nickname      text not null,
  created_at    timestamptz not null default now()
);

create index if not exists users_nickname_idx on users (lower(nickname));

create table if not exists system_prompts (
  id            serial primary key,
  name          text not null unique,
  content       text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists models (
  id                        serial primary key,
  provider                  text not null,        -- anthropic | openai | openrouter | ollama | cerebras | moonshot | deepseek
  model_id                  text not null,        -- e.g. claude-opus-4-7
  label                     text not null,        -- shown in dropdown
  enabled                   boolean not null default true,
  default_system_prompt_id  int references system_prompts(id) on delete set null,
  sort_order                int not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (provider, model_id)
);

create table if not exists conversations (
  id                uuid primary key,
  user_id           uuid not null references users(id) on delete cascade,
  title             text not null default 'New conversation',
  model_id          int references models(id) on delete set null,
  system_prompt_id  int references system_prompts(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists conversations_user_idx
  on conversations (user_id, updated_at desc);

create table if not exists messages (
  id              uuid primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant','system')),
  content         text not null,
  model_id        int references models(id) on delete set null,
  prompt_tokens   int,
  completion_tokens int,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conv_idx
  on messages (conversation_id, created_at);

create table if not exists interactions (
  id                uuid primary key,
  user_id           uuid references users(id) on delete set null,
  conversation_id   uuid references conversations(id) on delete set null,
  model_id          int references models(id) on delete set null,
  ip_hash           text,
  user_agent        text,
  country           text,
  referer           text,
  status            text not null default 'ok',   -- ok | error
  error_message     text,
  prompt_tokens     int,
  completion_tokens int,
  latency_ms        int,
  ts                timestamptz not null default now()
);

create index if not exists interactions_ts_idx on interactions (ts desc);
create index if not exists interactions_model_idx on interactions (model_id, ts desc);

create table if not exists admin_sessions (
  id          text primary key,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
