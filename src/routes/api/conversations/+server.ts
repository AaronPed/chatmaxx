import { json, error } from '@sveltejs/kit';
import { listConversations, createConversation, getModelWithProvider } from '$lib/server/repo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, 'login required');
  return json(await listConversations(locals.user.id));
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'login required');
  const body = await request.json().catch(() => ({}));
  const modelId: number = Number(body?.modelId);
  if (!modelId) throw error(400, 'modelId required');
  const m = await getModelWithProvider(modelId);
  if (!m) throw error(404, 'model not found');
  // System-prompt fallback chain: model default → provider default → none.
  const systemPromptId =
    m.default_system_prompt_id ??
    m.provider.default_system_prompt_id ??
    null;
  const conv = await createConversation(locals.user.id, modelId, systemPromptId);
  return json(conv);
};
