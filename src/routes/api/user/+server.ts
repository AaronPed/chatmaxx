import { json, error } from '@sveltejs/kit';
import { upsertUser, getUser } from '$lib/server/repo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) throw error(400, 'id required');
  const u = await getUser(id);
  if (!u) throw error(404, 'not found');
  return json(u);
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const nickname = typeof body?.nickname === 'string' ? body.nickname : '';
  const existingId = typeof body?.id === 'string' ? body.id : undefined;
  if (!nickname.trim()) throw error(400, 'nickname required');
  const u = await upsertUser(nickname, existingId);
  return json(u);
};
