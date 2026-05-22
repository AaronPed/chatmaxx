import { json, error } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const rows = await sql`select * from system_prompts order by name asc`;
  return json(rows);
};

export const POST: RequestHandler = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const name = String(b?.name ?? '').trim();
  const content = String(b?.content ?? '');
  if (!name || !content) throw error(400, 'name and content required');
  const rows = await sql`
    insert into system_prompts (name, content) values (${name}, ${content})
    on conflict (name) do update set
      content = excluded.content,
      updated_at = now()
    returning *
  `;
  return json(rows[0]);
};
