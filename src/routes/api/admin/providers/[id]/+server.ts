import { json, error } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import { PROVIDER_KINDS } from '$lib/server/providers';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request }) => {
  const id = Number(params.id);
  if (!id) throw error(400, 'invalid id');
  const b = await request.json().catch(() => ({}));

  let label: string | null = null;
  let kind: string | null = null;
  let supportsResponses: boolean | null = null;
  let enabled: boolean | null = null;
  let sortOrder: number | null = null;
  let baseUrlProvided = false;
  let baseUrlValue: string | null = null;
  let apiKeyEnvProvided = false;
  let apiKeyEnvValue: string | null = null;
  let promptIdProvided = false;
  let promptIdValue: number | null = null;

  if (typeof b.label === 'string') label = b.label.trim();
  if (typeof b.kind === 'string') {
    if (!PROVIDER_KINDS.includes(b.kind)) throw error(400, 'invalid kind');
    kind = b.kind;
  }
  if ('base_url' in b) {
    baseUrlProvided = true;
    baseUrlValue = b.base_url ? String(b.base_url).trim() : null;
  }
  if ('api_key_env' in b) {
    apiKeyEnvProvided = true;
    apiKeyEnvValue = b.api_key_env ? String(b.api_key_env).trim() : null;
  }
  if (typeof b.supports_responses_api === 'boolean') supportsResponses = b.supports_responses_api;
  if ('default_system_prompt_id' in b) {
    promptIdProvided = true;
    promptIdValue = b.default_system_prompt_id ?? null;
  }
  if (typeof b.enabled === 'boolean') enabled = b.enabled;
  if (typeof b.sort_order === 'number') sortOrder = b.sort_order;

  if (
    label === null && kind === null && supportsResponses === null && enabled === null &&
    sortOrder === null && !baseUrlProvided && !apiKeyEnvProvided && !promptIdProvided
  ) {
    throw error(400, 'no fields');
  }

  const rows = await sql`
    update providers set
      label = coalesce(${label}, label),
      kind = coalesce(${kind}, kind),
      base_url = ${baseUrlProvided ? baseUrlValue : sql`base_url`},
      api_key_env = ${apiKeyEnvProvided ? apiKeyEnvValue : sql`api_key_env`},
      supports_responses_api = coalesce(${supportsResponses}, supports_responses_api),
      default_system_prompt_id = ${promptIdProvided ? promptIdValue : sql`default_system_prompt_id`},
      enabled = coalesce(${enabled}, enabled),
      sort_order = coalesce(${sortOrder}, sort_order),
      updated_at = now()
    where id = ${id}
    returning *
  `;
  if (!rows[0]) throw error(404, 'not found');
  return json(rows[0]);
};

export const DELETE: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  if (!id) throw error(400, 'invalid id');
  const usage = await sql<{ n: number }[]>`select count(*)::int as n from models where provider_id = ${id}`;
  if ((usage[0]?.n ?? 0) > 0) {
    throw error(409, `${usage[0].n} model(s) still reference this provider — delete or reassign them first`);
  }
  await sql`delete from providers where id = ${id}`;
  return json({ ok: true });
};
