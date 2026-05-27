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
  interface ConvSummary {
    id: string; title: string; updated_at: string;
    model_id: number | null; folder_id: string | null;
  }
  interface FolderSummary { id: string; name: string; sort_order: number; }
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
  let folders = $state<FolderSummary[]>([]);
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
    const uid = encodeURIComponent(user.id);
    const [mRes, cRes, fRes] = await Promise.all([
      fetch('/api/models').then((r) => r.json()),
      fetch(`/api/conversations?userId=${uid}`).then((r) => r.json()),
      fetch(`/api/folders?userId=${uid}`).then((r) => r.json())
    ]);
    models = mRes;
    conversations = cRes;
    folders = fRes;
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
    conversations = [
      { id: conv.id, title: conv.title, updated_at: conv.updated_at, model_id: conv.model_id, folder_id: conv.folder_id ?? null },
      ...conversations
    ];
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

  function patchTitle(id: string, title: string, persist = true) {
    conversations = conversations.map((c) => (c.id === id ? { ...c, title } : c));
    // persist=false: the title was already saved server-side (e.g. by the
    // /autotitle endpoint); just sync the sidebar label.
    if (!user || !persist) return;
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
    folders = [];
    activeId = null;
    activeMessages = [];
  }

  // ---- folders ----
  async function createFolder() {
    if (!user) return;
    const name = prompt('Folder name?', 'New folder');
    if (name === null) return;
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: user.id, name: name.trim() || 'New folder' })
    });
    if (!res.ok) return;
    const f = await res.json();
    folders = [...folders, { id: f.id, name: f.name, sort_order: f.sort_order }];
  }

  function renameFolder(id: string, name: string) {
    folders = folders.map((f) => (f.id === id ? { ...f, name } : f));
    if (!user) return;
    fetch(`/api/folders/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: user.id, name })
    }).catch(() => {});
  }

  async function deleteFolder(id: string) {
    if (!user) return;
    if (!confirm('Delete this folder? Its conversations move to Unfiled.')) return;
    await fetch(`/api/folders/${id}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
    folders = folders.filter((f) => f.id !== id);
    // Unfile any conversations that pointed at it.
    conversations = conversations.map((c) => (c.folder_id === id ? { ...c, folder_id: null } : c));
  }

  function moveConversation(convId: string, folderId: string | null) {
    conversations = conversations.map((c) => (c.id === convId ? { ...c, folder_id: folderId } : c));
    if (!user) return;
    fetch(`/api/conversations/${convId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: user.id, folderId })
    }).catch(() => {});
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
      {folders}
      {activeId}
      onSelect={openConversation}
      onNew={newConversation}
      onDelete={deleteConversation}
      onSignOut={signOut}
      onNewFolder={createFolder}
      onRenameFolder={renameFolder}
      onDeleteFolder={deleteFolder}
      onMoveConversation={moveConversation}
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
