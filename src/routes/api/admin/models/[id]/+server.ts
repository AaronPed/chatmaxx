import { json, error } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request }) => {
  const id = Number(params.id);
  if (!id) throw error(400, 'invalid id');
  const b = await request.json().catch(() => ({}));

  let label: string | null = null;
  let enabled: boolean | null = null;
  let sortOrder: number | null = null;
  let apiStyle: 'chat' | 'responses' | null = null;
  let promptIdProvided = false;
  let promptIdValue: number | null = null;

  if (typeof b.label === 'string') label = b.label.trim();
  if (typeof b.enabled === 'boolean') enabled = b.enabled;
  if (typeof b.sort_order === 'number') sortOrder = b.sort_order;
  if ('default_system_prompt_id' in b) {
    promptIdProvided = true;
    promptIdValue = b.default_system_prompt_id ?? null;
  }
  if (b.api_style === 'chat' || b.api_style === 'responses') {
    if (b.api_style === 'responses') {
      const row = await sql<{ supports_responses_api: boolean; name: string }[]>`
        select p.supports_responses_api, p.name
          from models m join providers p on p.id = m.provider_id
         where m.id = ${id}
      `;
      if (!row[0]) throw error(404, 'not found');
      if (!row[0].supports_responses_api) {
        throw error(400, `provider '${row[0].name}' does not support the Responses API`);
      }
    }
    apiStyle = b.api_style;
  }

  if (label === null && enabled === null && sortOrder === null && apiStyle === null && !promptIdProvided) {
    throw error(400, 'no fields');
  }

  const rows = await sql`
    update models set
      label = coalesce(${label}, label),
      enabled = coalesce(${enabled}, enabled),
      default_system_prompt_id = ${promptIdProvided ? promptIdValue : sql`default_system_prompt_id`},
      sort_order = coalesce(${sortOrder}, sort_order),
      api_style = coalesce(${apiStyle}, api_style),
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
  await sql`delete from models where id = ${id}`;
  return json({ ok: true });
};
