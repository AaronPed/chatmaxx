// Provider factory. Takes a Provider row from the DB and returns a Vercel AI
// SDK LanguageModel for the given modelId.
//
// We support three "kinds" — anything new the user wants to add via /admin/providers
// has to map onto one of these:
//   - 'anthropic'           → @ai-sdk/anthropic (Messages API)
//   - 'google'              → @ai-sdk/google (Gemini generateContent)
//   - 'openai-compatible'   → @ai-sdk/openai with a configurable baseURL
//                             (covers OpenAI, OpenRouter, Ollama, Cerebras,
//                             Moonshot, DeepSeek, Fireworks, Groq, Together,
//                             Anthropic-via-AWS Bedrock proxies, …)
//
// Adding a brand-new wire format (e.g. native Cohere) would need a code change
// here; everything else is data.

import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV1 } from 'ai';

export type ProviderKind = 'anthropic' | 'google' | 'openai-compatible';
export const PROVIDER_KINDS: ProviderKind[] = ['anthropic', 'google', 'openai-compatible'];

export type ApiStyle = 'chat' | 'responses';

export interface ProviderConfig {
  id: number;
  name: string;
  label: string;
  kind: ProviderKind;
  base_url: string | null;
  api_key_env: string | null;
  supports_responses_api: boolean;
  default_system_prompt_id: number | null;
  enabled: boolean;
}

export class ProviderConfigError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ProviderConfigError';
  }
}

export function getModel(
  provider: ProviderConfig,
  modelId: string,
  apiStyle: ApiStyle = 'chat'
): LanguageModelV1 {
  if (provider.kind === 'anthropic') {
    const apiKey = readKey(provider, true);
    return createAnthropic({ apiKey })(modelId);
  }

  if (provider.kind === 'google') {
    const apiKey = readKey(provider, true);
    return createGoogleGenerativeAI({ apiKey })(modelId);
  }

  // openai-compatible
  if (!provider.base_url) {
    throw new ProviderConfigError(`provider '${provider.name}' has no base_url`);
  }
  const apiKey = readKey(provider, false);
  const client = createOpenAI({
    apiKey: apiKey ?? 'unused',
    baseURL: provider.base_url,
    // 'strict' only on OpenAI itself — every other vendor advertises Chat
    // Completions but tends to deviate in small ways.
    compatibility: provider.name === 'openai' ? 'strict' : 'compatible'
  });

  if (apiStyle === 'responses') {
    if (!provider.supports_responses_api) {
      throw new ProviderConfigError(
        `provider '${provider.name}' is not flagged as supporting the Responses API`
      );
    }
    return client.responses(modelId);
  }
  return client(modelId);
}

/** Pull the configured env var. If `required`, throws when absent. */
function readKey(provider: ProviderConfig, required: boolean): string | undefined {
  if (!provider.api_key_env) return undefined;
  const v = process.env[provider.api_key_env];
  if (!v && required) {
    throw new ProviderConfigError(`${provider.api_key_env} is not set`);
  }
  return v;
}

/** Returns whether the provider has its API key (if any) set in the environment. */
export function providerKeyOk(provider: ProviderConfig): boolean {
  if (!provider.api_key_env) return true;
  return !!process.env[provider.api_key_env];
}
