// Lets the client append a message directly (e.g. a manually-saved note). The
// "stopped mid-stream" case is now persisted server-side by the chat endpoint,
// so this is no longer on that hot path.

import { json, error } from '@sveltejs/kit';
import { getConversation, addMessage } from '$lib/server/repo';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.user) throw error(401, 'login required');
  const body = await request.json().catch(() => ({}));
  const role: string = body?.role;
  const content: string = (body?.content ?? '').toString();
  if ((role !== 'assistant' && role !== 'user') || !content.trim()) {
    throw error(400, 'role and content required');
  }
  const conv = await getConversation(params.id, locals.user.id);
  if (!conv) throw error(404, 'conversation not found');
  const m = await addMessage(params.id, role, content.slice(0, 200_000), {
    modelId: conv.model_id
  });
  return json(m);
};
