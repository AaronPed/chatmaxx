<script lang="ts">
  import { errorMessage } from '$lib/client/http';
  import type { PageData } from './$types';
  import { invalidateAll } from '$app/navigation';

  let { data }: { data: PageData } = $props();

  let draft = $state({ name: '', content: '' });
  let err = $state('');
  let saving = $state(false);
  let edits = $state<Record<number, { name: string; content: string }>>({});

  async function create(e: Event) {
    e.preventDefault();
    saving = true; err = '';
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft)
      });
      if (!res.ok) { err = await errorMessage(res); return; }
      draft = { name: '', content: '' };
      await invalidateAll();
    } finally { saving = false; }
  }

  function startEdit(p: { id: number; name: string; content: string }) {
    edits[p.id] = { name: p.name, content: p.content };
  }
  function cancelEdit(id: number) { delete edits[id]; edits = { ...edits }; }
  async function saveEdit(id: number) {
    const e = edits[id]; if (!e) return;
    await fetch(`/api/admin/prompts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(e)
    });
    delete edits[id]; edits = { ...edits };
    await invalidateAll();
  }
  async function remove(id: number) {
    if (!confirm('Delete this prompt? Models referring to it will fall back to none.')) return;
    await fetch(`/api/admin/prompts/${id}`, { method: 'DELETE' });
    await invalidateAll();
  }
</script>

<svelte:head><title>system prompts · chatmaxx</title></svelte:head>

<h1 class="italic">System prompts</h1>
<p class="muted">Each model can default to one of these. Editing here changes future conversations only.</p>

<div class="card">
  <h3>New prompt</h3>
  <form onsubmit={create} class="stack">
    <label class="stack" style="gap: 0.3rem">
      <span class="small muted">Name</span>
      <input bind:value={draft.name} placeholder="e.g. Concise Tutor" />
    </label>
    <label class="stack" style="gap: 0.3rem">
      <span class="small muted">Content</span>
      <textarea bind:value={draft.content} rows="6" placeholder="You are a…"></textarea>
    </label>
    {#if err}<div class="small" style="color: var(--danger)">{err}</div>{/if}
    <div class="row" style="justify-content: flex-end">
      <button class="primary" disabled={saving || !draft.name || !draft.content}>{saving ? '…' : 'save'}</button>
    </div>
  </form>
</div>

<div class="stack" style="margin-top: 1rem">
  {#each data.prompts as p (p.id)}
    <div class="card">
      {#if edits[p.id]}
        <div class="stack">
          <input bind:value={edits[p.id].name} />
          <textarea bind:value={edits[p.id].content} rows="8"></textarea>
          <div class="row" style="justify-content: flex-end; gap: 0.4rem">
            <button onclick={() => cancelEdit(p.id)}>cancel</button>
            <button class="primary" onclick={() => saveEdit(p.id)}>save</button>
          </div>
        </div>
      {:else}
        <div class="row" style="justify-content: space-between">
          <h3 style="margin: 0">{p.name}</h3>
          <div class="row" style="gap: 0.4rem">
            <button class="small" onclick={() => startEdit(p)}>edit</button>
            <button class="small" onclick={() => remove(p.id)}>delete</button>
          </div>
        </div>
        <pre style="margin-top: 0.6rem; white-space: pre-wrap">{p.content}</pre>
      {/if}
    </div>
  {:else}
    <p class="muted italic">No prompts yet.</p>
  {/each}
</div>
