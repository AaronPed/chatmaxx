import { sql } from '$lib/server/db';
import { PROVIDER_KINDS } from '$lib/server/providers';
import type { PageServerLoad } from './$types';

interface ProviderRow {
  id: number;
  name: string;
  label: string;
  kind: string;
  base_url: string | null;
  api_key_env: string | null;
  supports_responses_api: boolean;
  default_system_prompt_id: number | null;
  enabled: boolean;
  sort_order: number;
  enabled_models: number;
  total_models: number;
}

interface PromptOption { id: number; name: string; }

export const load: PageServerLoad = async () => {
  const [providers, prompts] = await Promise.all([
    sql<ProviderRow[]>`
      select p.*,
             (select count(*) from models where provider_id = p.id and enabled = true)::int as enabled_models,
             (select count(*) from models where provider_id = p.id)::int as total_models
        from providers p
       order by p.sort_order asc, p.label asc
    `,
    sql<PromptOption[]>`select id, name from system_prompts order by name asc`
  ]);

  const keyStatus: Record<string, boolean> = {};
  for (const p of providers) {
    keyStatus[p.name] = p.api_key_env ? !!process.env[p.api_key_env] : true;
  }
  return { providers, prompts, kinds: PROVIDER_KINDS, keyStatus };
};
