// Used by the client when the user presses "stop": we abort the SSE stream
// before the server's onFinish has run, so the partial assistant text never
// reached the DB. The client posts what it accumulated here.

import { json, error } from '@sveltejs/kit';
import { getConversation, addMessage } from '$lib/server/repo';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
  const body = await request.json().catch(() => ({}));
  const userId: string = body?.userId;
  const role: string = body?.role;
  const content: string = (body?.content ?? '').toString();
  if (!userId || (role !== 'assistant' && role !== 'user') || !content.trim()) {
    throw error(400, 'userId, role, content required');
  }
  const conv = await getConversation(params.id, userId);
  if (!conv) throw error(404, 'conversation not found');
  const m = await addMessage(params.id, role, content.slice(0, 200_000), {
    modelId: conv.model_id
  });
  return json(m);
};
