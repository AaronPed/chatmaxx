import { sql } from '$lib/server/db';
import type { PageServerLoad } from './$types';

interface ModelRow {
  id: number;
  provider_id: number;
  model_id: string;
  label: string;
  enabled: boolean;
  default_system_prompt_id: number | null;
  sort_order: number;
  api_style: 'chat' | 'responses';
  provider_name: string;
  provider_label: string;
  provider_supports_responses: boolean;
  provider_api_key_env: string | null;
  provider_kind: string;
}

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
}

interface PromptOption { id: number; name: string; }

export const load: PageServerLoad = async () => {
  const [models, providers, prompts] = await Promise.all([
    sql<ModelRow[]>`
      select m.*,
             p.name as provider_name,
             p.label as provider_label,
             p.supports_responses_api as provider_supports_responses,
             p.api_key_env as provider_api_key_env,
             p.kind as provider_kind
        from models m
        join providers p on p.id = m.provider_id
       order by p.sort_order asc, m.sort_order asc, m.label asc
    `,
    sql<ProviderRow[]>`select * from providers order by sort_order asc, label asc`,
    sql<PromptOption[]>`select id, name from system_prompts order by name asc`
  ]);

  const keyStatus: Record<string, boolean> = {};
  for (const p of providers) {
    keyStatus[p.name] = p.api_key_env ? !!process.env[p.api_key_env] : true;
  }
  return { models, providers, prompts, keyStatus };
};
