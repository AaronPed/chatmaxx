import { json, error } from '@sveltejs/kit';
import { renameFolder, deleteFolder } from '$lib/server/repo';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'login required');
  const body = await request.json().catch(() => ({}));
  const name: string = body?.name;
  if (!name?.trim()) throw error(400, 'name required');
  await renameFolder(params.id, locals.user.id, name);
  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'login required');
  await deleteFolder(params.id, locals.user.id);
  return json({ ok: true });
};
