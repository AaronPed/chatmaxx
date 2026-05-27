-- Two admin-tunable knobs added to the singleton settings row:
--   user_daily_token_limit — per-user prompt+completion token budget per UTC
--                            day (0 = unlimited). Enforced before each turn.
--   history_window         — max number of (non-system) messages sent to the
--                            model per turn (0 = send the whole thread).
--                            Defaults to 20 so long chats stay bounded in cost
--                            and latency out of the box.

alter table settings
  add column if not exists user_daily_token_limit int not null default 0,
  add column if not exists history_window         int not null default 20;
