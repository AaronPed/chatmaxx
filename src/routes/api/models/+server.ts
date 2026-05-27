import { json } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import { availableTools } from '$lib/server/tools';
import type { ProviderKind, ApiStyle } from '$lib/server/providers';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  // Public dropdown. Includes api_style + the tools each model can offer so
  // the compose bar can show/disable the tools menu without another round trip.
  const rows = await sql<{
    id: number; model_id: string; label: string; api_style: ApiStyle;
    provider_name: string; provider_label: string;
    provider_kind: ProviderKind; supports_responses_api: boolean;
    default_system_prompt_id: number | null;
  }[]>`
    select m.id, m.model_id, m.label, m.api_style,
           p.name as provider_name, p.label as provider_label,
           p.kind as provider_kind, p.supports_responses_api,
           p.default_system_prompt_id
      from models m
      join providers p on p.id = m.provider_id
     where m.enabled = true and p.enabled = true
     order by m.sort_order asc, m.label asc
  `;

  return json(rows.map((r) => ({
    id: r.id,
    model_id: r.model_id,
    label: r.label,
    api_style: r.api_style,
    provider_name: r.provider_name,
    provider_label: r.provider_label,
    available_tools: availableTools(
      {
        id: 0, name: r.provider_name, label: r.provider_label,
        kind: r.provider_kind, base_url: null, api_key_env: null,
        supports_responses_api: r.supports_responses_api,
        default_system_prompt_id: r.default_system_prompt_id, enabled: true
      },
      r.api_style
    )
  })));
};
