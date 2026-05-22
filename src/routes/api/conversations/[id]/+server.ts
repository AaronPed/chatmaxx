import { json, error } from '@sveltejs/kit';
import {
  getConversation, listMessages, deleteConversation, renameConversation
} from '$lib/server/repo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
  const userId = url.searchParams.get('userId');
  if (!userId) throw error(400, 'userId required');
  const conv = await getConversation(params.id, userId);
  if (!conv) throw error(404, 'not found');
  const messages = await listMessages(conv.id);
  return json({ conversation: conv, messages });
};

export const DELETE: RequestHandler = async ({ params, url }) => {
  const userId = url.searchParams.get('userId');
  if (!userId) throw error(400, 'userId required');
  await deleteConversation(params.id, userId);
  return json({ ok: true });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const body = await request.json().catch(() => ({}));
  const userId: string = body?.userId;
  const title: string = body?.title;
  if (!userId || !title) throw error(400, 'userId and title required');
  await renameConversation(params.id, userId, title);
  return json({ ok: true });
};
