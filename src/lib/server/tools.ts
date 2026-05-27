// Built-in tool registry for OpenAI's Responses API. These run server-side at
// OpenAI — we just declare them; the model invokes + executes them within a
// single response and the SDK streams the final answer (plus sources for web
// search) back to us.
//
// Tool availability depends on (provider + api_style), not on the specific
// model id: a model is "tool-capable" when it uses the Responses API on a
// provider flagged as supporting it. We can't know per-model which tools a
// given OpenAI model supports, so we expose the set and let OpenAI reject an
// unsupported combination (surfaced to the user as a normal error).

import type { ProviderConfig, ApiStyle } from './providers';

export interface ToolDescriptor {
  id: string;
  label: string;
  description: string;
}

export const TOOL_IDS = ['web_search', 'code_interpreter', 'image_generation'] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export const OPENAI_RESPONSES_TOOLS: ToolDescriptor[] = [
  { id: 'web_search',       label: 'Web search',       description: 'Search the live web and cite sources.' },
  { id: 'code_interpreter', label: 'Code interpreter', description: 'Run Python in a sandbox to compute, analyze, or plot.' },
  { id: 'image_generation', label: 'Image generation', description: 'Generate images inline from the prompt.' }
];

/** Tools the given provider+style can offer the user. Empty = none. */
export function availableTools(provider: ProviderConfig, apiStyle: ApiStyle): ToolDescriptor[] {
  if (apiStyle !== 'responses') return [];
  if (!provider.supports_responses_api) return [];
  // Only OpenAI's own Responses endpoint is known to serve these built-ins.
  // (OpenRouter etc. proxy /responses but don't reliably expose the tools.)
  if (provider.kind === 'openai-compatible' && provider.name === 'openai') {
    return OPENAI_RESPONSES_TOOLS;
  }
  return [];
}

export function isToolId(s: string): s is ToolId {
  return (TOOL_IDS as readonly string[]).includes(s);
}
