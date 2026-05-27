-- End-user authentication: email + username (the existing `nickname`) + password.
-- Identity used to be a client-supplied UUID; it is now a server-side session
-- cookie backed by `user_sessions`, mirroring the admin auth model.
--
-- Every user must have credentials, so email/password_hash are NOT NULL. (Any
-- pre-auth dev data is expected to be wiped — this is a fresh schema.)

alter table users add column if not exists email         text not null;
alter table users add column if not exists password_hash text not null;

create unique index if not exists users_email_unique on users (lower(email));

create table if not exists user_sessions (
  id          text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists user_sessions_user_idx    on user_sessions (user_id);
create index if not exists user_sessions_expires_idx on user_sessions (expires_at);
