import { json, error } from '@sveltejs/kit';
import {
  getConversation, listMessages, deleteConversation, renameConversation, moveConversation
} from '$lib/server/repo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'login required');
  const conv = await getConversation(params.id, locals.user.id);
  if (!conv) throw error(404, 'not found');
  const messages = await listMessages(conv.id);
  return json({ conversation: conv, messages });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'login required');
  await deleteConversation(params.id, locals.user.id);
  return json({ ok: true });
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'login required');
  const userId = locals.user.id;
  const body = await request.json().catch(() => ({}));

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
