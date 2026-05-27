import { error } from '@sveltejs/kit';
import { streamText, type ModelMessage } from 'ai';
import {
  getConversation, listMessages, addMessage,
  getModelWithProvider, getSystemPrompt, getSettings, tokensUsedToday, logInteraction,
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
// NOTE: keep these in sync with BODY_SIZE_LIMIT in the Dockerfile — 5×5 MB of
// raw image becomes ~33 MB once base64-encoded into the JSON body.
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

function isAbortError(e: unknown): boolean {
  return e instanceof Error &&
    (e.name === 'AbortError' || e.name === 'ResponseAborted' || e.name === 'TimeoutError');
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export const POST: RequestHandler = async (event) => {
  const { request, locals } = event;
  if (!locals.user) throw error(401, 'login required');
  const userId = locals.user.id;

  const body = await request.json().catch(() => ({}));
  const conversationId: string = body?.conversationId;
  const content: string = (body?.content ?? '').toString();
  const attachments = sanitizeAttachments(body?.attachments);
  const requestedTools: string[] = Array.isArray(body?.enabledTools)
    ? body.enabledTools.map((t: unknown) => String(t))
    : [];
  if (!conversationId || (!content.trim() && attachments.length === 0)) {
    throw error(400, 'conversationId, and content or attachments required');
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

  // Resolve the provider model *before* we persist anything, so a
  // misconfiguration (missing key, etc.) fails the request without leaving an
  // orphaned user message in the thread.
  let languageModel;
  try {
    languageModel = getProviderModel(model.provider, model.model_id, model.api_style);
  } catch (e) {
    if (e instanceof ProviderConfigError) throw error(503, e.message);
    throw e;
  }

  // Per-user daily token budget (0 = unlimited).
  const settings = await getSettings();
  if (settings.user_daily_token_limit > 0) {
    const used = await tokensUsedToday(userId);
    if (used >= settings.user_daily_token_limit) {
      throw error(
        429,
        `daily token limit reached (${used}/${settings.user_daily_token_limit}). Resets at UTC midnight.`
      );
    }
  }

  // Persist user message (with attachments) + load history for the model.
  await addMessage(conversationId, 'user', content, { attachments });
  const history = await listMessages(conversationId);

  // Windowing: only feed the model the last N non-system messages (0 = all).
  // Keeps cost/latency bounded on long threads and avoids re-uploading old
  // image attachments on every turn.
  let convo = history.filter((m) => m.role !== 'system');
  if (settings.history_window > 0 && convo.length > settings.history_window) {
    convo = convo.slice(-settings.history_window);
  }
  // Some providers (notably Anthropic) require the first message to be the
  // user's; drop any leading assistant turn the window may have sliced into.
  while (convo.length && convo[0].role === 'assistant') convo.shift();

  const messages: ModelMessage[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt.content });
  for (const m of convo) {
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

  const tools = buildTools(model.provider, model.api_style, enabledToolIds);
  const meta = getMeta(event);
  const t0 = Date.now();

  const result = streamText({
    model: languageModel,
    messages,
    ...(tools ? { tools } : {}),
    // Cancel the upstream provider call if the client disconnects / presses stop.
    abortSignal: request.signal,
    onError: ({ error: err }) => {
      if (isAbortError(err)) return;
      console.error('[chat] stream error', err);
      logInteraction({
        userId, conversationId, modelId: conv.model_id, ...meta,
        status: 'error', errorMessage: errMessage(err).slice(0, 500),
        latencyMs: Date.now() - t0
      }).catch(() => {});
    },
    onFinish: async ({ text, usage, sources }) => {
      // If the client aborted, the partial is persisted by the stream loop's
      // `finally` below. And don't write an empty row when a turn errored out.
      if (request.signal.aborted || !text.trim()) return;
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
          userId, conversationId, modelId: conv.model_id, ...meta,
          status: 'ok',
          promptTokens: usage?.inputTokens,
          completionTokens: usage?.outputTokens,
          latencyMs: Date.now() - t0
        });
      } catch (e) {
        console.error('[chat] persistence failed', e);
      }
    }
  });

  // Hand-rolled stream over fullStream so we can (a) surface a mid-stream
  // provider error to the client inline — textStream swallows errors silently —
  // and (b) persist the partial text exactly once when the user presses stop.
  const encoder = new TextEncoder();
  let accumulated = '';
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            accumulated += part.text;
            controller.enqueue(encoder.encode(part.text));
          } else if (part.type === 'error') {
            controller.enqueue(
              encoder.encode(`${accumulated ? '\n\n' : ''}⚠ ${errMessage(part.error)}`)
            );
          }
          // 'abort' parts end the stream; the finally block handles persistence.
        }
      } catch (err) {
        if (!isAbortError(err)) {
          controller.enqueue(encoder.encode(`${accumulated ? '\n\n' : ''}⚠ ${errMessage(err)}`));
        }
      } finally {
        // Client pressed stop / disconnected: persist whatever we have, once.
        // onFinish is guarded against the aborted case so this is the sole write.
        if (request.signal.aborted && accumulated.trim()) {
          await addMessage(conversationId, 'assistant', accumulated + '\n\n_(stopped)_', {
            modelId: conv.model_id
          }).catch(() => {});
        }
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
  });
};
