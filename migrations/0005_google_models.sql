-- Seed Gemini models against the (new) providers table.
-- Disabled until GOOGLE_GENERATIVE_AI_API_KEY is set.

insert into models (provider_id, model_id, label, enabled, sort_order, api_style)
select p.id, v.model_id, v.label, false, v.sort_order, 'chat'
from providers p
join (values
  ('gemini-2.5-pro',   'Gemini 2.5 Pro',   25),
  ('gemini-2.5-flash', 'Gemini 2.5 Flash', 26)
) as v(model_id, label, sort_order) on true
where p.name = 'google'
on conflict (provider_id, model_id) do nothing;
