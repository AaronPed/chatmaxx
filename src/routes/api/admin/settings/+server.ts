import { json, error } from '@sveltejs/kit';
import { getSettings, updateSettings } from '$lib/server/repo';
import { sql } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  return json(await getSettings());
};

export const PATCH: RequestHandler = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  const patch: Parameters<typeof updateSettings>[0] = {};

  if (typeof b.title_enabled === 'boolean') patch.title_enabled = b.title_enabled;
  if (typeof b.title_prompt === 'string') {
    if (!b.title_prompt.trim()) throw error(400, 'title_prompt cannot be empty');
    patch.title_prompt = b.title_prompt;
  }
  if ('title_model_id' in b) {
    const id = b.title_model_id == null ? null : Number(b.title_model_id);
    if (id !== null) {
      const m = await sql<{ id: number }[]>`select id from models where id = ${id}`;
      if (!m[0]) throw error(400, 'title_model_id does not exist');
    }
    patch.title_model_id = id;
  }
  if (Object.keys(patch).length === 0) throw error(400, 'nothing to update');
  return json(await updateSettings(patch));
};
