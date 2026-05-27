<script lang="ts">
  import type { PageData } from './$types';
  import { invalidateAll } from '$app/navigation';

  let { data }: { data: PageData } = $props();

  let titleEnabled = $state(data.settings.title_enabled);
  let titleModelId = $state<number | null>(data.settings.title_model_id);
  let titlePrompt = $state(data.settings.title_prompt);
  let saving = $state(false);
  let saved = $state(false);
  let err = $state('');

  async function save(e: Event) {
    e.preventDefault();
    saving = true; err = ''; saved = false;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title_enabled: titleEnabled,
          title_model_id: titleModelId,
          title_prompt: titlePrompt
        })
      });
      if (!res.ok) { err = await res.text(); return; }
      saved = true;
      await invalidateAll();
      setTimeout(() => (saved = false), 2000);
    } finally { saving = false; }
  }
</script>

<svelte:head><title>settings · chatmaxx</title></svelte:head>

<h1 class="italic">Settings</h1>

<div class="card" style="max-width: 680px">
  <h3>Conversation auto-titling</h3>
  <p class="muted small">
    After the first message in a new chat, this model generates a short title.
    If disabled (or no model chosen), chats are named from the first line of the
    user's message.
  </p>

  <form onsubmit={save} class="stack" style="gap: 1rem; margin-top: 0.6rem">
    <label class="row" style="gap: 0.5rem">
      <input type="checkbox" bind:checked={titleEnabled} />
      <span>Enable LLM auto-titling</span>
    </label>

    <label class="stack" style="gap: 0.3rem">
      <span class="small muted">Titler model</span>
      <select bind:value={titleModelId} disabled={!titleEnabled}>
        <option value={null}>— none (use first line) —</option>
        {#each data.models as m}
          <option value={m.id}>
            {m.provider_label} · {m.label}{m.enabled ? '' : ' (disabled)'}
          </option>
        {/each}
      </select>
      <span class="small muted italic">
        Pick something small + cheap — e.g. a nano / haiku / flash model.
      </span>
    </label>

    <label class="stack" style="gap: 0.3rem">
      <span class="small muted">Title prompt (system)</span>
      <textarea bind:value={titlePrompt} rows="5" disabled={!titleEnabled}></textarea>
    </label>

    <div class="row" style="justify-content: flex-end; gap: 0.6rem">
      {#if err}<span class="small" style="color: var(--danger)">{err}</span>{/if}
      {#if saved}<span class="small muted italic">saved ✓</span>{/if}
      <button class="primary" disabled={saving}>{saving ? '…' : 'save'}</button>
    </div>
  </form>
</div>
