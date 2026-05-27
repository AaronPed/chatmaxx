-- Conversation folders. A conversation lives in at most one folder; deleting a
-- folder unfiles (does not delete) its conversations.

create table if not exists folders (
  id          uuid primary key,
  user_id     uuid not null references users(id) on delete cascade,
  name        text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists folders_user_idx on folders (user_id, sort_order asc);

alter table conversations
  add column if not exists folder_id uuid references folders(id) on delete set null;

create index if not exists conversations_folder_idx on conversations (folder_id);
