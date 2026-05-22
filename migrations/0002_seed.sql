-- default system prompt + a couple of starter models (disabled by default until keys are set)

insert into system_prompts (name, content)
values
  ('Default', 'You are a helpful, concise assistant. Use plain prose. Avoid lists unless asked.')
on conflict (name) do nothing;

insert into models (provider, model_id, label, enabled, sort_order)
values
  ('anthropic',  'claude-opus-4-7',          'Claude Opus 4.7',         true,  10),
  ('anthropic',  'claude-sonnet-4-6',        'Claude Sonnet 4.6',       true,  20),
  ('anthropic',  'claude-haiku-4-5-20251001','Claude Haiku 4.5',        true,  30),
  ('openai',     'gpt-4o',                   'GPT-4o',                  false, 40),
  ('openrouter', 'openrouter/auto',          'OpenRouter (auto)',       false, 50),
  ('ollama',     'llama3.1',                 'Llama 3.1 (local)',       false, 60),
  ('cerebras',   'llama3.1-70b',             'Cerebras Llama 3.1 70B',  false, 70),
  ('moonshot',   'moonshot-v1-128k',         'Moonshot v1 128k',        false, 80),
  ('deepseek',   'deepseek-chat',            'DeepSeek Chat',           false, 90)
on conflict (provider, model_id) do nothing;
