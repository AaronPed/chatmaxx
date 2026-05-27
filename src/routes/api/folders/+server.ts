import { json, error } from '@sveltejs/kit';
import { listFolders, createFolder } from '$lib/server/repo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, 'login required');
  return json(await listFolders(locals.user.id));
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'login required');
  const body = await request.json().catch(() => ({}));
  const name: string = body?.name ?? 'New folder';
  return json(await createFolder(locals.user.id, name));
};
