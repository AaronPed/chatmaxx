import { error } from '@sveltejs/kit';
import { streamText, type ModelMessage } from 'ai';
import {
  getConversation, listMessages, addMessage,
  getModelWithProvider, getSystemPrompt, logInteraction,
  type Attachment, type Source
} from '$lib/server/repo';
import {
  getModel as getProviderModel, buildTools, ProviderConfigError
} from '$lib/server/providers';
import { availableTools } from '$lib/server/tools';
import { getMeta } from '$lib/server/request-meta';
import type { RequestHandler } from './$types';

// Cross-provider safe limits. Anthropic & OpenAI accept images at these sizes;
// PDFs / audio / text would each need provider-specific handling so we leave
// non-image MIME types for a follow-up.
const MAX_FILES = 5;
const MAX_BYTES_PER_FILE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp'
]);

function sanitizeAttachments(raw: unknown): Attachment[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length > MAX_FILES) {
    throw error(400, `at most ${MAX_FILES} attachments per message`);
  }
  return raw.map((a, i) => {
    if (typeof a !== 'object' || a === null) throw error(400, `attachment ${i}: invalid`);
    const name = String((a as any).name ?? `file-${i}`).slice(0, 200);
    const mime_type = String((a as any).mime_type ?? '');
    const data_url = String((a as any).data_url ?? '');
    if (!ALLOWED_IMAGE_MIME.has(mime_type)) {
      throw error(400, `attachment ${i}: ${mime_type || 'unknown'} not supported (images only)`);
    }
    if (!data_url.startsWith('data:')) {
      throw error(400, `attachment ${i}: must be a data URL`);
    }
    const b64 = data_url.split(',')[1] ?? '';
    const size = Math.floor((b64.length * 3) / 4);
    if (size > MAX_BYTES_PER_FILE) {
      throw error(400, `attachment ${i}: ${(size / 1024 / 1024).toFixed(1)} MB exceeds 5 MB limit`);
    }
    return { name, mime_type, data_url, size };
  });
}

export const POST: RequestHandler = async (event) => {
  const { request } = event;
  const body = await request.json().catch(() => ({}));
  const userId: string = body?.userId;
  const conversationId: string = body?.conversationId;
  const content: string = (body?.content ?? '').toString();
  const attachments = sanitizeAttachments(body?.attachments);
  const requestedTools: string[] = Array.isArray(body?.enabledTools)
    ? body.enabledTools.map((t: unknown) => String(t))
    : [];
  if (!userId || !conversationId || (!content.trim() && attachments.length === 0)) {
    throw error(400, 'userId, conversationId, and content or attachments required');
  }

  const conv = await getConversation(conversationId, userId);
  if (!conv) throw error(404, 'conversation not found');
  if (!conv.model_id) throw error(400, 'conversation has no model');

  const model = await getModelWithProvider(conv.model_id);
  if (!model) throw error(404, 'model not found');

  const systemPromptId =
    conv.system_prompt_id ??
    model.default_system_prompt_id ??
    model.provider.default_system_prompt_id ??
    null;
  const systemPrompt = await getSystemPrompt(systemPromptId);

  // Only allow tools the model actually supports.
  const allowed = new Set(availableTools(model.provider, model.api_style).map((t) => t.id));
  const enabledToolIds = requestedTools.filter((t) => allowed.has(t));

  // Persist user message (with attachments) + load full history for the model.
  await addMessage(conversationId, 'user', content, { attachments });
  const history = await listMessages(conversationId);

  const messages: ModelMessage[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt.content });
  for (const m of history) {
    if (m.role === 'system') continue;
    if (m.role === 'user' && m.attachments && m.attachments.length > 0) {
      // Mixed-content message: text first, then each image as raw bytes.
      const parts: Array<
        | { type: 'text'; text: string }
        | { type: 'image'; image: Uint8Array; mediaType: string }
      > = [];
      if (m.content) parts.push({ type: 'text', text: m.content });
      for (const a of m.attachments) {
        const b64 = (a.data_url.split(',', 2)[1] ?? '');
        parts.push({
          type: 'image',
          image: new Uint8Array(Buffer.from(b64, 'base64')),
          mediaType: a.mime_type
        });
      }
      messages.push({ role: 'user', content: parts });
    } else {
      messages.push({ role: m.role as 'user' | 'assistant', content: m.content });
    }
  }

  let languageModel;
  try {
    languageModel = getProviderModel(model.provider, model.model_id, model.api_style);
  } catch (e) {
    if (e instanceof ProviderConfigError) throw error(503, e.message);
    throw e;
  }

  const tools = buildTools(model.provider, model.api_style, enabledToolIds);

  const meta = getMeta(event);
  const t0 = Date.now();
  const result = streamText({
    model: languageModel,
    messages,
    ...(tools ? { tools } : {}),
    onFinish: async ({ text, usage, sources }) => {
      try {
        const cited: Source[] = (sources ?? [])
          .filter((s): s is Extract<typeof s, { sourceType: 'url' }> => s.sourceType === 'url')
          .map((s) => ({ url: s.url, title: s.title || s.url }));
        await addMessage(conversationId, 'assistant', text, {
          modelId: conv.model_id,
          promptTokens: usage?.inputTokens,
          completionTokens: usage?.outputTokens,
          sources: cited
        });
        await logInteraction({
          userId, conversationId, modelId: conv.model_id,
          ...meta,
          status: 'ok',
          promptTokens: usage?.inputTokens,
          completionTokens: usage?.outputTokens,
          latencyMs: Date.now() - t0
        });
        // Titling is handled by the client calling /autotitle after the first
        // exchange (so the LLM-generated name can replace the placeholder).
      } catch (e) {
        console.error('[chat] persistence failed', e);
      }
    }
  });

  return result.toTextStreamResponse();
};
