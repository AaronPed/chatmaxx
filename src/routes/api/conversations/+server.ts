import { json, error } from '@sveltejs/kit';
import { listConversations, createConversation, getModelWithProvider } from '$lib/server/repo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const userId = url.searchParams.get('userId');
  if (!userId) throw error(400, 'userId required');
  return json(await listConversations(userId));
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const userId: string = body?.userId;
  const modelId: number = Number(body?.modelId);
  if (!userId || !modelId) throw error(400, 'userId and modelId required');
  const m = await getModelWithProvider(modelId);
  if (!m) throw error(404, 'model not found');
  // System-prompt fallback chain: model default → provider default → none.
  const systemPromptId =
    m.default_system_prompt_id ??
    m.provider.default_system_prompt_id ??
    null;
  const conv = await createConversation(userId, modelId, systemPromptId);
  return json(conv);
};
