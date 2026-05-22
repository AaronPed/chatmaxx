<script lang="ts">
  import type { PageData } from './$types';
  import { invalidateAll } from '$app/navigation';

  let { data }: { data: PageData } = $props();

  let draft = $state({
    provider_id: (data.providers[0]?.id ?? 0) as number,
    model_id: '',
    label: '',
    enabled: true,
    default_system_prompt_id: null as number | null,
    sort_order: 100,
    api_style: 'chat' as 'chat' | 'responses'
  });
  let saving = $state(false);
  let err = $state('');

  function providerById(id: number) {
    return data.providers.find((p) => p.id === id);
  }
  const draftProvider = $derived(providerById(draft.provider_id));

  // If the picked provider doesn't support Responses, force back to 'chat'.
  $effect(() => {
    if (draft.api_style === 'responses' && !draftProvider?.supports_responses_api) {
      draft.api_style = 'chat';
    }
  });

  async function addModel(e: Event) {
    e.preventDefault();
    saving = true; err = '';
    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft)
      });
      if (!res.ok) { err = await res.text(); return; }
      draft.model_id = '';
      draft.label = '';
      await invalidateAll();
    } finally { saving = false; }
  }

  async function update(id: number, patch: Record<string, unknown>) {
    const res = await fetch(`/api/admin/models/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch)
    });
    if (!res.ok) alert(await res.text());
    await invalidateAll();
  }

  async function remove(id: number) {
    if (!confirm('Delete this model? Past conversations using it will keep working.')) return;
    await fetch(`/api/admin/models/${id}`, { method: 'DELETE' });
    await invalidateAll();
  }
</script>

<svelte:head><title>models · chatmaxx</title></svelte:head>

<h1 class="italic">Models</h1>
<p class="muted">
  Models populate the chat dropdown. Pick a provider first; the dropdown
  inherits its system prompt unless overridden here. Add new providers on the
  <a href="/admin/providers">Providers</a> page.
</p>

<div class="card">
  <h3>Add or upsert a model</h3>
  <form onsubmit={addModel} class="grid-form">
    <label>
      <span class="small muted">Provider</span>
      <select bind:value={draft.provider_id}>
        {#each data.providers as p}
          <option value={p.id}>
            {p.label}
            {!p.enabled ? '(off)' : ''}
            {p.api_key_env && !data.keyStatus[p.name] ? '⚠ no key' : ''}
          </option>
        {/each}
      </select>
    </label>
    <label>
      <span class="small muted">Model ID</span>
      <input bind:value={draft.model_id} placeholder="e.g. claude-opus-4-7" />
    </label>
    <label>
      <span class="small muted">Label</span>
      <input bind:value={draft.label} placeholder="shown in dropdown" />
    </label>
    <label>
      <span class="small muted">Default system prompt</span>
      <select bind:value={draft.default_system_prompt_id}>
        <option value={null}>— inherit from provider —</option>
        {#each data.prompts as p}<option value={p.id}>{p.name}</option>{/each}
      </select>
    </label>
    <label>
      <span class="small muted">API style</span>
      <select bind:value={draft.api_style} disabled={!draftProvider?.supports_responses_api}>
        <option value="chat">Chat Completions</option>
        <option value="responses">Responses API</option>
      </select>
    </label>
    <label>
      <span class="small muted">Sort</span>
      <input type="number" bind:value={draft.sort_order} />
    </label>
    <label class="row" style="align-self: end; gap: 0.4rem">
      <input type="checkbox" bind:checked={draft.enabled} /> <span>Enabled</span>
    </label>
    <div style="grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 0.6rem">
      {#if err}<span class="small" style="color: var(--danger)">{err}</span>{/if}
      <button class="primary" disabled={saving || !draft.model_id}>{saving ? '…' : 'save'}</button>
    </div>
  </form>
</div>

<div class="card" style="margin-top: 1rem">
  <h3>Configured</h3>
  <div class="scroll-x">
  <table class="wide">
    <thead>
      <tr>
        <th class="col-on">On</th>
        <th class="col-provider">Provider</th>
        <th class="col-mid">Model ID</th>
        <th class="col-label">Label</th>
        <th class="col-prompt">Default prompt</th>
        <th class="col-api">API</th>
        <th class="col-sort">Sort</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each data.models as m (m.id)}
        <tr>
          <td>
            <input type="checkbox" checked={m.enabled}
              onchange={(e) => update(m.id, { enabled: (e.currentTarget as HTMLInputElement).checked })} />
          </td>
          <td class="small muted">
            {m.provider_label}
            {m.provider_api_key_env && !data.keyStatus[m.provider_name] ? ' ⚠' : ''}
          </td>
          <td><code>{m.model_id}</code></td>
          <td><input value={m.label}
            onchange={(e) => update(m.id, { label: (e.currentTarget as HTMLInputElement).value })} /></td>
          <td>
            <select value={m.default_system_prompt_id ?? ''}
              onchange={(e) => {
                const v = (e.currentTarget as HTMLSelectElement).value;
                update(m.id, { default_system_prompt_id: v === '' ? null : Number(v) });
              }}>
              <option value="">— inherit —</option>
              {#each data.prompts as p}<option value={p.id}>{p.name}</option>{/each}
            </select>
          </td>
          <td>
            {#if m.provider_supports_responses}
              <select value={m.api_style}
                onchange={(e) => update(m.id, { api_style: (e.currentTarget as HTMLSelectElement).value })}>
                <option value="chat">Chat</option>
                <option value="responses">Responses</option>
              </select>
            {:else}
              <span class="small muted" title="provider has no Responses-API endpoint">chat</span>
            {/if}
          </td>
          <td><input type="number" value={m.sort_order}
            onchange={(e) => update(m.id, { sort_order: Number((e.currentTarget as HTMLInputElement).value) })} /></td>
          <td><button class="small" onclick={() => remove(m.id)}>delete</button></td>
        </tr>
      {/each}
    </tbody>
  </table>
  </div>
</div>

<style>
  .grid-form {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.8rem 1rem;
    margin-top: 0.6rem;
  }
  .grid-form label { display: flex; flex-direction: column; gap: 0.3rem; }

  .scroll-x { overflow-x: auto; margin: 0 -1.25rem; padding: 0 1.25rem; }
  table.wide { font-size: 0.92rem; min-width: 900px; }
  table.wide th, table.wide td { padding: 0.45em 0.55em; vertical-align: middle; }
  table.wide input,
  table.wide select { width: 100%; box-sizing: border-box; }
  .col-on       { width: 3rem; }
  .col-provider { width: 11rem; }
  .col-mid      { width: 14rem; }
  .col-label    { width: 14rem; }
  .col-prompt   { width: 12rem; }
  .col-api      { width: 8rem; }
  .col-sort     { width: 4rem; }

  @media (max-width: 760px) {
    .grid-form { grid-template-columns: 1fr 1fr; }
  }
</style>
