import { json, error } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request }) => {
  const id = Number(params.id);
  if (!id) throw error(400, 'invalid id');
  const b = await request.json().catch(() => ({}));
  const name: string | undefined = typeof b.name === 'string' ? b.name.trim() : undefined;
  const content: string | undefined = typeof b.content === 'string' ? b.content : undefined;
  const rows = await sql`
    update system_prompts set
      name    = coalesce(${name ?? null}, name),
      content = coalesce(${content ?? null}, content),
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
  await sql`delete from system_prompts where id = ${id}`;
  return json({ ok: true });
};
