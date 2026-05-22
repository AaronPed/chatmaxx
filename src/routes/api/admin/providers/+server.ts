import { json, error } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import { PROVIDER_KINDS } from '$lib/server/providers';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const rows = await sql`
    select * from providers order by sort_order asc, label asc
  `;
  return json(rows);
};

function validateBody(b: any) {
  const name = String(b?.name ?? '').trim().toLowerCase();
  const label = String(b?.label ?? '').trim();
  const kind = String(b?.kind ?? '');
  const base_url = b?.base_url ? String(b.base_url).trim() : null;
  const api_key_env = b?.api_key_env ? String(b.api_key_env).trim() : null;
  const supports_responses_api = !!b?.supports_responses_api;
  const default_system_prompt_id = b?.default_system_prompt_id ?? null;
  const enabled = b?.enabled !== false;
  const sort_order = Number.isFinite(b?.sort_order) ? Number(b.sort_order) : 100;

  if (!name || !/^[a-z0-9_-]+$/.test(name)) throw error(400, 'name must be a slug (a-z0-9_-)');
  if (!label) throw error(400, 'label required');
  if (!PROVIDER_KINDS.includes(kind as any)) {
    throw error(400, `kind must be one of: ${PROVIDER_KINDS.join(', ')}`);
  }
  if (kind === 'openai-compatible' && !base_url) {
    throw error(400, 'base_url required for openai-compatible providers');
  }
  if (kind !== 'openai-compatible' && supports_responses_api) {
    throw error(400, 'Responses API is only meaningful for openai-compatible providers');
  }
  return {
    name, label, kind, base_url, api_key_env,
    supports_responses_api, default_system_prompt_id, enabled, sort_order
  };
}

export const POST: RequestHandler = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const v = validateBody(b);
  const rows = await sql`
    insert into providers
      (name, label, kind, base_url, api_key_env, supports_responses_api,
       default_system_prompt_id, enabled, sort_order)
    values
      (${v.name}, ${v.label}, ${v.kind}, ${v.base_url}, ${v.api_key_env},
       ${v.supports_responses_api}, ${v.default_system_prompt_id}, ${v.enabled}, ${v.sort_order})
    on conflict (name) do update set
      label = excluded.label,
      kind = excluded.kind,
      base_url = excluded.base_url,
      api_key_env = excluded.api_key_env,
      supports_responses_api = excluded.supports_responses_api,
      default_system_prompt_id = excluded.default_system_prompt_id,
      enabled = excluded.enabled,
      sort_order = excluded.sort_order,
      updated_at = now()
    returning *
  `;
  return json(rows[0]);
};
