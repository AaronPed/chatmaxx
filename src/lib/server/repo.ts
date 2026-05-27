// Thin data-access layer over postgres-js. No ORM — small, explicit queries.

import { sql } from './db';
import { uuidv7 } from 'uuidv7';
import type { ProviderConfig, ProviderKind } from './providers';

export interface User { id: string; nickname: string; created_at: string; }
export type Provider = ProviderConfig;
export interface Model {
  id: number; provider_id: number; model_id: string; label: string;
  enabled: boolean; default_system_prompt_id: number | null;
  sort_order: number; api_style: 'chat' | 'responses';
}
/** A Model row joined with its Provider, ready for the chat endpoint. */
export interface ModelWithProvider extends Model {
  provider: Provider;
}
export interface SystemPrompt { id: number; name: string; content: string; }
export interface Folder {
  id: string; user_id: string; name: string;
  sort_order: number; created_at: string;
}
export interface Conversation {
  id: string; user_id: string; title: string;
  model_id: number | null; system_prompt_id: number | null;
  folder_id: string | null;
  created_at: string; updated_at: string;
}
export interface Attachment {
  name: string;
  mime_type: string;
  data_url: string;   // "data:image/png;base64,..."
  size: number;       // bytes (approx, of decoded payload)
}
export interface Source { url: string; title: string; }
export interface Message {
  id: string; conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string; model_id: number | null;
  prompt_tokens: number | null; completion_tokens: number | null;
  attachments: Attachment[];
  sources: Source[];
  created_at: string;
}

export const newId = () => uuidv7();

export async function upsertUser(nickname: string, existingId?: string): Promise<User> {
  const clean = nickname.trim().slice(0, 60);
  if (!clean) throw new Error('nickname required');
  if (existingId) {
    const rows = await sql<User[]>`
      update users set nickname = ${clean}
      where id = ${existingId}
      returning *
    `;
    if (rows[0]) return rows[0];
  }
  const id = newId();
  const rows = await sql<User[]>`
    insert into users (id, nickname) values (${id}, ${clean}) returning *
  `;
  return rows[0];
}

export async function getUser(id: string): Promise<User | null> {
  const rows = await sql<User[]>`select * from users where id = ${id}`;
  return rows[0] ?? null;
}

export async function listEnabledModels(): Promise<Model[]> {
  return sql<Model[]>`
    select m.* from models m
    join providers p on p.id = m.provider_id
    where m.enabled = true and p.enabled = true
    order by m.sort_order asc, m.label asc
  `;
}

export async function listAllModels(): Promise<Model[]> {
  return sql<Model[]>`select * from models order by sort_order asc, label asc`;
}

export async function getModel(id: number): Promise<Model | null> {
  const rows = await sql<Model[]>`select * from models where id = ${id}`;
  return rows[0] ?? null;
}

export async function getModelWithProvider(id: number): Promise<ModelWithProvider | null> {
  const rows = await sql<(Model & { p_id: number; p_name: string; p_label: string;
    p_kind: ProviderKind; p_base_url: string | null; p_api_key_env: string | null;
    p_supports_responses_api: boolean; p_default_system_prompt_id: number | null;
    p_enabled: boolean })[]>`
    select m.*,
           p.id   as p_id,
           p.name as p_name,
           p.label as p_label,
           p.kind as p_kind,
           p.base_url as p_base_url,
           p.api_key_env as p_api_key_env,
           p.supports_responses_api as p_supports_responses_api,
           p.default_system_prompt_id as p_default_system_prompt_id,
           p.enabled as p_enabled
      from models m
      join providers p on p.id = m.provider_id
     where m.id = ${id}
  `;
  const r = rows[0];
  if (!r) return null;
  const provider: Provider = {
    id: r.p_id, name: r.p_name, label: r.p_label, kind: r.p_kind,
    base_url: r.p_base_url, api_key_env: r.p_api_key_env,
    supports_responses_api: r.p_supports_responses_api,
    default_system_prompt_id: r.p_default_system_prompt_id,
    enabled: r.p_enabled
  };
  return {
    id: r.id, provider_id: r.provider_id, model_id: r.model_id, label: r.label,
    enabled: r.enabled, default_system_prompt_id: r.default_system_prompt_id,
    sort_order: r.sort_order, api_style: r.api_style,
    provider
  };
}

export async function listProviders(): Promise<Provider[]> {
  return sql<Provider[]>`
    select id, name, label, kind, base_url, api_key_env,
           supports_responses_api, default_system_prompt_id, enabled
      from providers
     order by sort_order asc, label asc
  `;
}

export async function getProvider(id: number): Promise<Provider | null> {
  const rows = await sql<Provider[]>`
    select id, name, label, kind, base_url, api_key_env,
           supports_responses_api, default_system_prompt_id, enabled
      from providers where id = ${id}
  `;
  return rows[0] ?? null;
}

export async function getSystemPrompt(id: number | null): Promise<SystemPrompt | null> {
  if (!id) return null;
  const rows = await sql<SystemPrompt[]>`select * from system_prompts where id = ${id}`;
  return rows[0] ?? null;
}

export async function listSystemPrompts(): Promise<SystemPrompt[]> {
  return sql<SystemPrompt[]>`select * from system_prompts order by name asc`;
}

// ---- global settings (singleton row) ----

export interface Settings {
  title_enabled: boolean;
  title_model_id: number | null;
  title_prompt: string;
}

export async function getSettings(): Promise<Settings> {
  const rows = await sql<Settings[]>`
    select title_enabled, title_model_id, title_prompt from settings where id = 1
  `;
  return rows[0] ?? { title_enabled: true, title_model_id: null, title_prompt: '' };
}

export async function updateSettings(s: Partial<Settings>): Promise<Settings> {
  const rows = await sql<Settings[]>`
    update settings set
      title_enabled  = coalesce(${s.title_enabled ?? null}, title_enabled),
      title_model_id = ${'title_model_id' in s ? s.title_model_id ?? null : sql`title_model_id`},
      title_prompt   = coalesce(${s.title_prompt ?? null}, title_prompt),
      updated_at     = now()
    where id = 1
    returning title_enabled, title_model_id, title_prompt
  `;
  return rows[0];
}

export async function listConversations(userId: string): Promise<Conversation[]> {
  return sql<Conversation[]>`
    select * from conversations
    where user_id = ${userId}
    order by updated_at desc
    limit 100
  `;
}

export async function createConversation(
  userId: string, modelId: number, systemPromptId: number | null
): Promise<Conversation> {
  const id = newId();
  const rows = await sql<Conversation[]>`
    insert into conversations (id, user_id, model_id, system_prompt_id)
    values (${id}, ${userId}, ${modelId}, ${systemPromptId})
    returning *
  `;
  return rows[0];
}

export async function getConversation(id: string, userId: string): Promise<Conversation | null> {
  const rows = await sql<Conversation[]>`
    select * from conversations where id = ${id} and user_id = ${userId}
  `;
  return rows[0] ?? null;
}

export async function deleteConversation(id: string, userId: string): Promise<void> {
  await sql`delete from conversations where id = ${id} and user_id = ${userId}`;
}

export async function renameConversation(id: string, userId: string, title: string): Promise<void> {
  await sql`
    update conversations set title = ${title.slice(0, 200)}, updated_at = now()
    where id = ${id} and user_id = ${userId}
  `;
}

/** Move a conversation into a folder (or out of one when folderId is null). */
export async function moveConversation(
  id: string, userId: string, folderId: string | null
): Promise<void> {
  if (folderId) {
    // Guard: the folder must belong to the same user.
    const owns = await sql<{ id: string }[]>`
      select id from folders where id = ${folderId} and user_id = ${userId}
    `;
    if (!owns[0]) throw new Error('folder not found');
  }
  await sql`
    update conversations set folder_id = ${folderId}
    where id = ${id} and user_id = ${userId}
  `;
}

// ---- folders ----

export async function listFolders(userId: string): Promise<Folder[]> {
  return sql<Folder[]>`
    select * from folders where user_id = ${userId}
    order by sort_order asc, lower(name) asc
  `;
}

export async function createFolder(userId: string, name: string): Promise<Folder> {
  const clean = name.trim().slice(0, 80) || 'New folder';
  const id = newId();
  const rows = await sql<Folder[]>`
    insert into folders (id, user_id, name) values (${id}, ${userId}, ${clean})
    returning *
  `;
  return rows[0];
}

export async function renameFolder(id: string, userId: string, name: string): Promise<void> {
  const clean = name.trim().slice(0, 80);
  if (!clean) throw new Error('name required');
  await sql`
    update folders set name = ${clean} where id = ${id} and user_id = ${userId}
  `;
}

export async function deleteFolder(id: string, userId: string): Promise<void> {
  // ON DELETE SET NULL unfiles the conversations automatically.
  await sql`delete from folders where id = ${id} and user_id = ${userId}`;
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  return sql<Message[]>`
    select * from messages
    where conversation_id = ${conversationId}
    order by created_at asc
  `;
}

export async function addMessage(
  conversationId: string,
  role: Message['role'],
  content: string,
  opts: {
    modelId?: number | null;
    promptTokens?: number;
    completionTokens?: number;
    attachments?: Attachment[];
    sources?: Source[];
  } = {}
): Promise<Message> {
  const id = newId();
  const attachments = JSON.stringify(opts.attachments ?? []);
  const sources = JSON.stringify(opts.sources ?? []);
  const rows = await sql<Message[]>`
    insert into messages
      (id, conversation_id, role, content, model_id,
       prompt_tokens, completion_tokens, attachments, sources)
    values
      (${id}, ${conversationId}, ${role}, ${content}, ${opts.modelId ?? null},
       ${opts.promptTokens ?? null}, ${opts.completionTokens ?? null},
       ${attachments}::jsonb, ${sources}::jsonb)
    returning *
  `;
  await sql`update conversations set updated_at = now() where id = ${conversationId}`;
  return rows[0];
}

export interface InteractionLog {
  userId: string | null;
  conversationId: string | null;
  modelId: number | null;
  ipHash: string | null;
  userAgent: string | null;
  country: string | null;
  referer: string | null;
  status: 'ok' | 'error';
  errorMessage?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  latencyMs?: number | null;
}

export async function logInteraction(i: InteractionLog): Promise<void> {
  await sql`
    insert into interactions
      (id, user_id, conversation_id, model_id, ip_hash, user_agent, country, referer,
       status, error_message, prompt_tokens, completion_tokens, latency_ms)
    values
      (${newId()}, ${i.userId}, ${i.conversationId}, ${i.modelId}, ${i.ipHash},
       ${i.userAgent}, ${i.country}, ${i.referer}, ${i.status}, ${i.errorMessage ?? null},
       ${i.promptTokens ?? null}, ${i.completionTokens ?? null}, ${i.latencyMs ?? null})
  `;
}
