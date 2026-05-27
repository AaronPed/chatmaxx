import { json, error } from '@sveltejs/kit';
import { renameFolder, deleteFolder } from '$lib/server/repo';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request }) => {
  const body = await request.json().catch(() => ({}));
  const userId: string = body?.userId;
  const name: string = body?.name;
  if (!userId || !name?.trim()) throw error(400, 'userId and name required');
  await renameFolder(params.id, userId, name);
  return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, url }) => {
  const userId = url.searchParams.get('userId');
  if (!userId) throw error(400, 'userId required');
  await deleteFolder(params.id, userId);
  return json({ ok: true });
};
