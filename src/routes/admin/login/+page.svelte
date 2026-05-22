<script lang="ts">
  let password = $state('');
  let busy = $state(false);
  let err = $state('');

  async function submit(e: Event) {
    e.preventDefault();
    busy = true;
    err = '';
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!res.ok) {
        err = res.status === 401 ? 'Wrong password.' : 'Login failed.';
        return;
      }
      window.location.href = '/admin';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>admin · chatmaxx</title></svelte:head>

<div class="page">
  <div class="card paper-edge">
    <h1 class="italic">admin</h1>
    <form onsubmit={submit} class="stack">
      <label class="stack" style="gap: 0.3rem">
        <span class="small muted">Password</span>
        <input type="password" bind:value={password} autofocus />
      </label>
      {#if err}<div class="small" style="color: var(--danger)">{err}</div>{/if}
      <div class="row" style="justify-content: flex-end">
        <button type="submit" class="primary" disabled={busy || !password}>
          {busy ? '…' : 'enter'}
        </button>
      </div>
    </form>
    <hr />
    <a href="/" class="small">← back to chat</a>
  </div>
</div>

<style>
  .page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 2rem;
  }
  .card {
    width: min(420px, 100%);
    padding: 2rem 2.2rem;
  }
</style>
