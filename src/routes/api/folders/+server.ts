import { json, error } from '@sveltejs/kit';
import { listFolders, createFolder } from '$lib/server/repo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const userId = url.searchParams.get('userId');
  if (!userId) throw error(400, 'userId required');
  return json(await listFolders(userId));
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const userId: string = body?.userId;
  const name: string = body?.name ?? 'New folder';
  if (!userId) throw error(400, 'userId required');
  return json(await createFolder(userId, name));
};
