import { json, error } from '@sveltejs/kit';
import {
  getConversation, listMessages, deleteConversation, renameConversation, moveConversation
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
  if (!userId) throw error(400, 'userId required');

  // Title rename and/or folder move — either may be present.
  if (typeof body?.title === 'string' && body.title.trim()) {
    await renameConversation(params.id, userId, body.title);
  }
  if ('folderId' in body) {
    const folderId: string | null = body.folderId ?? null;
    try {
      await moveConversation(params.id, userId, folderId);
    } catch {
      throw error(404, 'folder not found');
    }
  }
  if (!('title' in body) && !('folderId' in body)) {
    throw error(400, 'nothing to update');
  }
  return json({ ok: true });
};
