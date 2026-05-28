<script lang="ts">
  import type { PageData } from './$types';
  import { invalidateAll } from '$app/navigation';

  let { data }: { data: PageData } = $props();

  let draft = $state({
    name: '',
    label: '',
    kind: 'openai-compatible' as 'anthropic' | 'google' | 'openai-compatible',
    base_url: '',
    api_key_env: '',
    supports_responses_api: false,
    default_system_prompt_id: null as number | null,
    enabled: true,
    sort_order: 100
  });
  let saving = $state(false);
  let err = $state('');

  // Responses API only makes sense for openai-compatible providers.
  $effect(() => {
    if (draft.kind !== 'openai-compatible') draft.supports_responses_api = false;
  });

  async function create(e: Event) {
    e.preventDefault();
    saving = true; err = '';
    try {
      const res = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          base_url: draft.base_url.trim() || null,
          api_key_env: draft.api_key_env.trim() || null
        })
      });
      if (!res.ok) { err = await res.text(); return; }
      draft.name = '';
      draft.label = '';
      draft.base_url = '';
      draft.api_key_env = '';
      await invalidateAll();
    } finally { saving = false; }
  }

  async function update(id: number, patch: Record<string, unknown>) {
    const res = await fetch(`/api/admin/providers/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch)
    });
    if (!res.ok) alert(await res.text());
    await invalidateAll();
  }

  async function remove(id: number) {
    if (!confirm('Delete this provider? Only allowed when no models reference it.')) return;
    const res = await fetch(`/api/admin/providers/${id}`, { method: 'DELETE' });
    if (!res.ok) alert(await res.text());
    await invalidateAll();
  }
</script>

<svelte:head><title>providers · chatmaxx</title></svelte:head>

<h1 class="italic">Providers</h1>
<p class="muted">
  Each provider is a wire format + endpoint + key. Adding a new OpenAI-compatible
  service (Fireworks, Groq, Together, …) is a row here — no code change.
</p>

<div class="card">
  <h3>Add or upsert a provider</h3>
  <form onsubmit={create} class="grid-form">
    <label>
      <span class="small muted">Slug (lowercase, [a-z0-9_-])</span>
      <input bind:value={draft.name} placeholder="e.g. fireworks" />
    </label>
    <label>
      <span class="small muted">Label</span>
      <input bind:value={draft.label} placeholder="Fireworks" />
    </label>
    <label>
      <span class="small muted">Kind</span>
      <select bind:value={draft.kind}>
        {#each data.kinds as k}
          <option value={k}>{k}</option>
        {/each}
      </select>
    </label>
    <label>
      <span class="small muted">Base URL {draft.kind === 'openai-compatible' ? '(required)' : '(unused)'}</span>
      <input bind:value={draft.base_url} placeholder="https://…/v1" disabled={draft.kind !== 'openai-compatible'} />
    </label>
    <label>
      <span class="small muted">API-key env var (blank = keyless)</span>
      <input bind:value={draft.api_key_env} placeholder="e.g. FIREWORKS_API_KEY" />
    </label>
    <label>
      <span class="small muted">Default system prompt</span>
      <select bind:value={draft.default_system_prompt_id}>
        <option value={null}>— none —</option>
        {#each data.prompts as p}<option value={p.id}>{p.name}</option>{/each}
      </select>
    </label>
    <label>
      <span class="small muted">Sort</span>
      <input type="number" bind:value={draft.sort_order} />
    </label>
    <label class="row" style="align-self: end; gap: 0.4rem">
      <input
        type="checkbox"
        bind:checked={draft.supports_responses_api}
        disabled={draft.kind !== 'openai-compatible'}
      />
      <span>Supports Responses API</span>
    </label>
    <label class="row" style="align-self: end; gap: 0.4rem">
      <input type="checkbox" bind:checked={draft.enabled} /> <span>Enabled</span>
    </label>
    <div style="grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 0.6rem">
      {#if err}<span class="small" style="color: var(--danger)">{err}</span>{/if}
      <button class="primary" disabled={saving || !draft.name || !draft.label}>{saving ? '…' : 'save'}</button>
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
        <th class="col-slug">Slug</th>
        <th class="col-label">Label</th>
        <th class="col-kind">Kind</th>
        <th class="col-url">Base URL</th>
        <th class="col-env">API key env</th>
        <th class="col-resp">Responses</th>
        <th class="col-prompt">Default prompt</th>
        <th class="col-models">Models</th>
        <th class="col-sort">Sort</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each data.providers as p (p.id)}
        <tr>
          <td>
            <input type="checkbox" checked={p.enabled}
              onchange={(e) => update(p.id, { enabled: (e.currentTarget as HTMLInputElement).checked })} />
          </td>
          <td class="mono small">{p.name}</td>
          <td><input value={p.label}
            onchange={(e) => update(p.id, { label: (e.currentTarget as HTMLInputElement).value })} /></td>
          <td class="small muted">{p.kind}</td>
          <td>
            <input value={p.base_url ?? ''}
              disabled={p.kind !== 'openai-compatible'}
              onchange={(e) => update(p.id, { base_url: (e.currentTarget as HTMLInputElement).value || null })} />
          </td>
          <td>
            <div class="row" style="gap: 0.3rem; flex-wrap: nowrap">
              <input value={p.api_key_env ?? ''}
                onchange={(e) => update(p.id, { api_key_env: (e.currentTarget as HTMLInputElement).value || null })} />
              {#if p.api_key_env && !data.keyStatus[p.name]}
                <span class="small" style="color: var(--danger)" title="env var not set">⚠</span>
              {/if}
            </div>
          </td>
          <td>
            {#if p.kind === 'openai-compatible'}
              <input type="checkbox" checked={p.supports_responses_api}
                onchange={(e) => update(p.id, { supports_responses_api: (e.currentTarget as HTMLInputElement).checked })} />
            {:else}
              <span class="small muted">—</span>
            {/if}
          </td>
          <td>
            <select value={p.default_system_prompt_id ?? ''}
              onchange={(e) => {
                const v = (e.currentTarget as HTMLSelectElement).value;
                update(p.id, { default_system_prompt_id: v === '' ? null : Number(v) });
              }}>
              <option value="">— none —</option>
              {#each data.prompts as sp}<option value={sp.id}>{sp.name}</option>{/each}
            </select>
          </td>
          <td class="small muted">{p.enabled_models}/{p.total_models}</td>
          <td>
            <input type="number" value={p.sort_order}
              onchange={(e) => update(p.id, { sort_order: Number((e.currentTarget as HTMLInputElement).value) })} />
          </td>
          <td><button class="small" onclick={() => remove(p.id)}>delete</button></td>
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
  table.wide { font-size: 0.92rem; min-width: 1200px; }
  table.wide th, table.wide td { padding: 0.45em 0.55em; vertical-align: middle; }
  table.wide input,
  table.wide select { width: 100%; box-sizing: border-box; }
  .col-on     { width: 3rem; }
  .col-slug   { width: 8rem; }
  .col-label  { width: 9rem; }
  .col-kind   { width: 10rem; }
  .col-url    { width: 16rem; }
  .col-env    { width: 12rem; }
  .col-resp   { width: 5rem; text-align: center; }
  .col-prompt { width: 11rem; }
  .col-models { width: 4rem; }
  .col-sort   { width: 6rem; }

  @media (max-width: 1000px) {
    .grid-form { grid-template-columns: 1fr 1fr; }
  }
</style>
