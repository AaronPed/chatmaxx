<script lang="ts">
  import { onMount } from 'svelte';
  import { readUser, clearUser, type ClientUser } from '$lib/client/session';
  import NicknameGate from '$lib/components/NicknameGate.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import ChatPane from '$lib/components/ChatPane.svelte';

  interface ToolDescriptor { id: string; label: string; description: string; }
  interface Model {
    id: number; label: string; model_id: string;
    provider_name: string; provider_label: string;
    api_style?: 'chat' | 'responses';
    available_tools?: ToolDescriptor[];
  }
  interface ConvSummary { id: string; title: string; updated_at: string; model_id: number | null; }
  interface UIAttachment { name: string; mime_type: string; data_url: string; size: number; }
  interface UISource { url: string; title: string; }
  interface UIMessage {
    id: string; role: 'user' | 'assistant'; content: string;
    attachments?: UIAttachment[];
    sources?: UISource[];
  }

  let user = $state<ClientUser | null>(null);
  let models = $state<Model[]>([]);
  let conversations = $state<ConvSummary[]>([]);
  let activeId = $state<string | null>(null);
  let activeMessages = $state<UIMessage[]>([]);
  let selectedModelId = $state<number | null>(null);

  onMount(async () => {
    const u = readUser();
    if (u) {
      user = u;
      await refresh();
    }
  });

  async function refresh() {
    if (!user) return;
    const [mRes, cRes] = await Promise.all([
      fetch('/api/models').then((r) => r.json()),
      fetch(`/api/conversations?userId=${encodeURIComponent(user.id)}`).then((r) => r.json())
    ]);
    models = mRes;
    conversations = cRes;
    if (!selectedModelId && models[0]) selectedModelId = models[0].id;
  }

  async function openConversation(id: string) {
    if (!user) return;
    activeId = id;
    const res = await fetch(`/api/conversations/${id}?userId=${encodeURIComponent(user.id)}`);
    if (!res.ok) { activeId = null; activeMessages = []; return; }
    const data = await res.json();
    activeMessages = data.messages.map((m: {
      id: string; role: string; content: string;
      attachments?: UIAttachment[]; sources?: UISource[];
    }) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      attachments: m.attachments && m.attachments.length > 0 ? m.attachments : undefined,
      sources: m.sources && m.sources.length > 0 ? m.sources : undefined
    }));
    if (data.conversation?.model_id) selectedModelId = data.conversation.model_id;
  }

  function newConversation() {
    activeId = null;
    activeMessages = [];
  }

  async function startConversation(modelId: number): Promise<string> {
    if (!user) throw new Error('no user');
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: user.id, modelId })
    });
    if (!res.ok) throw new Error(await res.text());
    const conv = await res.json();
    conversations = [{ id: conv.id, title: conv.title, updated_at: conv.updated_at, model_id: conv.model_id }, ...conversations];
    activeId = conv.id;
    return conv.id;
  }

  async function deleteConversation(id: string) {
    if (!user) return;
    if (!confirm('Delete this conversation?')) return;
    await fetch(`/api/conversations/${id}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
    conversations = conversations.filter((c) => c.id !== id);
    if (activeId === id) {
      activeId = null;
      activeMessages = [];
    }
  }

  function patchTitle(id: string, title: string) {
    conversations = conversations.map((c) => (c.id === id ? { ...c, title } : c));
    if (!user) return;
    fetch(`/api/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: user.id, title })
    }).catch(() => {});
  }

  function signOut() {
    clearUser();
    user = null;
    conversations = [];
    activeId = null;
    activeMessages = [];
  }
</script>

<svelte:head>
  <title>chatmaxx</title>
</svelte:head>

{#if !user}
  <NicknameGate onDone={async (u) => { user = u; await refresh(); }} />
{:else}
  <div class="shell">
    <Sidebar
      {user}
      {conversations}
      {activeId}
      onSelect={openConversation}
      onNew={newConversation}
      onDelete={deleteConversation}
      onSignOut={signOut}
    />
    <ChatPane
      {user}
      conversationId={activeId}
      {models}
      bind:selectedModelId
      initialMessages={activeMessages}
      onConversationStart={startConversation}
      onTitleChange={patchTitle}
    />
  </div>
{/if}

<style>
  .shell {
    display: flex;
    height: 100vh;
  }
</style>
