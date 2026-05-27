-- Global app settings (single row). Currently holds the "titler" config:
-- which model auto-names new conversations, and how.

create table if not exists settings (
  id             int primary key default 1,
  title_enabled  boolean not null default true,
  title_model_id int references models(id) on delete set null,
  title_prompt   text not null default
    'You write short, descriptive conversation titles. Given the start of a chat, reply with ONLY a 3–6 word title in Title Case. No quotes, no trailing punctuation, no preamble.',
  updated_at     timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);

insert into settings (id) values (1) on conflict (id) do nothing;
