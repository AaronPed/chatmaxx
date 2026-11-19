// Generate a title for a conversation using the admin-configured "titler"
// model. Called by the client after the first exchange. Always returns a
// usable title — falls back to the first line of the first user message when
// auto-titling is disabled, unconfigured, or the model call fails.

import { json, error } from '@sveltejs/kit';
import { generateText } from 'ai';
import {
  getConversation, listMessages, renameConversation,
  getSettings, getModelWithProvider
} from '$lib/server/repo';
import { getModel as getProviderModel } from '$lib/server/providers';
import type { RequestHandler } from './$types';

function firstLineTitle(text: string): string {
  return text.split('\n')[0].trim().slice(0, 80) || 'New conversation';
}

function cleanTitle(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')   // strip wrapping quotes
    .replace(/[.\s]+$/g, '')           // trailing dots / space
    .split('\n')[0]
    .slice(0, 80)
    .trim();
}

export const POST: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401, 'login required');
  const userId = locals.user.id;

  const conv = await getConversation(params.id, userId);
  if (!conv) throw error(404, 'conversation not found');

  const messages = await listMessages(conv.id);
  const firstUser = messages.find((m) => m.role === 'user');
  const firstAssistant = messages.find((m) => m.role === 'assistant');
  const fallback = firstLineTitle(firstUser?.content ?? conv.title);

  const settings = await getSettings();
  let title = fallback;

  if (settings.title_enabled && settings.title_model_id) {
    try {
      const model = await getModelWithProvider(settings.title_model_id);
      if (model) {
        const lm = getProviderModel(model.provider, model.model_id, model.api_style);
        const convo = [
          `User: ${(firstUser?.content ?? '').slice(0, 800)}`,
          firstAssistant ? `Assistant: ${firstAssistant.content.slice(0, 800)}` : ''
        ].filter(Boolean).join('\n');
        const { text } = await generateText({
          model: lm,
          instructions: settings.title_prompt,
          prompt: `${convo}\n\nTitle:`,
          // Room for models that reason before answering; cleanTitle trims the result.
          maxOutputTokens: 512
        });
        const cleaned = cleanTitle(text);
        if (cleaned) title = cleaned;
      }
    } catch (e) {
      console.error('[autotitle] generation failed, using fallback', e);
    }
  }

  await renameConversation(conv.id, userId, title);
  return json({ title });
};
