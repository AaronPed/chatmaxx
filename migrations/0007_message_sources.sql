-- Web-search (and other tool) citations attached to an assistant message.
-- Shape: [ { "url": "...", "title": "..." }, ... ]

alter table messages
  add column if not exists sources jsonb not null default '[]'::jsonb;
