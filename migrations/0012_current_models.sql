-- Seed the current model generation next to the older rows, which stay as they
-- are. Anthropic models start enabled like the original seed; the rest stay
-- disabled until their key is set.

insert into models (provider_id, model_id, label, enabled, sort_order, api_style)
select p.id, v.model_id, v.label, v.enabled, v.sort_order, 'chat'
from (values
  ('anthropic', 'claude-opus-5-5',       'Claude Opus 5.5',       true,   7),
  ('anthropic', 'claude-sonnet-5-5',     'Claude Sonnet 5.5',     true,   8),
  ('anthropic', 'claude-haiku-5-5',      'Claude Haiku 5.5',      true,   9),
  ('google',    'gemini-3.8-flash',      'Gemini 3.8 Flash',      false, 23),
  ('google',    'gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite', false, 24),
  ('openai',    'gpt-6.2-sol',           'GPT-6.2 Sol',           false, 38),
  ('openai',    'gpt-6-luna',            'GPT-6 Luna',            false, 39),
  ('cerebras',  'gpt-oss-120b',          'Cerebras GPT-OSS 120B', false, 69)
) as v(provider, model_id, label, enabled, sort_order)
join providers p on p.name = v.provider
on conflict (provider_id, model_id) do nothing;

-- The Anthropic provider was seeded without its key variable, so a missing key
-- showed as configured in the admin UI.
update providers set api_key_env = 'ANTHROPIC_API_KEY'
 where name = 'anthropic' and api_key_env is null;
