import { json, error } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const rows = await sql`
    select m.*, p.name as provider_name, p.label as provider_label,
           p.supports_responses_api, p.api_key_env, p.kind as provider_kind
    from models m
    join providers p on p.id = m.provider_id
    order by m.sort_order asc, m.label asc
  `;
  return json(rows);
};

export const POST: RequestHandler = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const provider_id = Number(b?.provider_id);
  const model_id = String(b?.model_id ?? '').trim();
  const label = String(b?.label ?? '').trim() || model_id;
  const enabled = !!b?.enabled;
  const default_system_prompt_id = b?.default_system_prompt_id ?? null;
  const sort_order = Number(b?.sort_order ?? 100);
  if (!provider_id) throw error(400, 'provider_id required');
  if (!model_id) throw error(400, 'model_id required');

  // Validate api_style against the provider's capabilities.
  const provider = await sql<{ supports_responses_api: boolean }[]>`
    select supports_responses_api from providers where id = ${provider_id}
  `;
  if (!provider[0]) throw error(400, 'provider not found');
  const wantsResponses = b?.api_style === 'responses';
  const api_style = wantsResponses && provider[0].supports_responses_api ? 'responses' : 'chat';

  const rows = await sql`
    insert into models (provider_id, model_id, label, enabled, default_system_prompt_id, sort_order, api_style)
    values (${provider_id}, ${model_id}, ${label}, ${enabled}, ${default_system_prompt_id}, ${sort_order}, ${api_style})
    on conflict (provider_id, model_id) do update set
      label = excluded.label,
      enabled = excluded.enabled,
      default_system_prompt_id = excluded.default_system_prompt_id,
      sort_order = excluded.sort_order,
      api_style = excluded.api_style,
      updated_at = now()
    returning *
  `;
  return json(rows[0]);
};
