-- Per-message attachments. Stored inline as base64 data URLs in jsonb.
-- Shape: [ { "name": "...", "mime_type": "image/png", "data_url": "data:...", "size": 12345 }, ... ]
-- We cap size at the application layer (5 MB / file, 5 files / message).

alter table messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;
