<script lang="ts">
  import { login, register, type ClientUser } from '$lib/client/session';
  import Sparkles from '$lib/components/Sparkles.svelte';

  let { onDone }: { onDone: (u: ClientUser) => void } = $props();

  let mode = $state<'login' | 'register'>('login');
  let email = $state('');
  let username = $state('');
  let password = $state('');
  let busy = $state(false);
  let err = $state('');

  function switchMode(next: 'login' | 'register') {
    mode = next;
    err = '';
  }

  async function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) return;
    if (mode === 'register' && !username.trim()) return;
    busy = true;
    err = '';
    try {
      const u = mode === 'login'
        ? await login(email.trim(), password)
        : await register(email.trim(), username.trim(), password);
      onDone(u);
    } catch (e) {
      err = e instanceof Error ? e.message : 'something went wrong';
    } finally {
      busy = false;
    }
  }
</script>

<div class="gate">
  <Sparkles count={60} />
  <div class="card sparkle-card paper-edge">
    <h1>chatmaxx</h1>
    <p class="muted italic">let the llm mog you.</p>

    <div class="tabs">
      <button class="tab" class:active={mode === 'login'} onclick={() => switchMode('login')}>sign in</button>
      <button class="tab" class:active={mode === 'register'} onclick={() => switchMode('register')}>create account</button>
    </div>

    <form onsubmit={submit} class="stack">
      <label class="stack" style="gap: 0.3rem">
        <span class="small muted">Email</span>
        <input type="email" bind:value={email} placeholder="you@example.com" autocomplete="email" />
      </label>

      {#if mode === 'register'}
        <label class="stack" style="gap: 0.3rem">
          <span class="small muted">Username</span>
          <input type="text" bind:value={username} placeholder="a name, a moniker, anything"
            maxlength="60" autocomplete="username" />
        </label>
      {/if}

      <label class="stack" style="gap: 0.3rem">
        <span class="small muted">Password{mode === 'register' ? ' (min 8 characters)' : ''}</span>
        <input type="password" bind:value={password}
          autocomplete={mode === 'login' ? 'current-password' : 'new-password'} />
      </label>

      {#if err}<div class="small" style="color: var(--danger)">{err}</div>{/if}
      <div class="row" style="justify-content: flex-end">
        <button type="submit" class="primary"
          disabled={busy || !email.trim() || !password || (mode === 'register' && !username.trim())}>
          {busy ? 'one moment…' : mode === 'login' ? 'sign in' : 'create account'}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .gate {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 2rem;
    z-index: 10;
    isolation: isolate;
  }
  .gate > .card { position: relative; z-index: 2; }
  .card {
    width: min(440px, 100%);
    padding: 2rem 2.2rem;
    z-index: 1;
  }
  .card > :global(*) { position: relative; z-index: 2; }
  .sparkle-card {
    box-shadow:
      inset 0 0 0 1px rgba(255, 252, 240, 0.5),
      0 1px 0 rgba(28, 42, 68, 0.08),
      0 24px 60px -20px rgba(28, 42, 68, 0.55),
      0 6px 18px -6px rgba(44, 62, 94, 0.35),
      0 0 0 1px rgba(201, 168, 106, 0.15);
    animation: card-breathe 6s ease-in-out infinite;
  }
  @keyframes card-breathe {
    0%, 100% {
      box-shadow:
        inset 0 0 0 1px rgba(255, 252, 240, 0.5),
        0 1px 0 rgba(28, 42, 68, 0.08),
        0 24px 60px -20px rgba(28, 42, 68, 0.55),
        0 6px 18px -6px rgba(44, 62, 94, 0.35),
        0 0 0 1px rgba(201, 168, 106, 0.15);
    }
    50% {
      box-shadow:
        inset 0 0 0 1px rgba(255, 252, 240, 0.6),
        0 1px 0 rgba(28, 42, 68, 0.10),
        0 28px 70px -18px rgba(28, 42, 68, 0.62),
        0 8px 22px -6px rgba(44, 62, 94, 0.45),
        0 0 0 1px rgba(201, 168, 106, 0.28);
    }
  }
  h1 { margin-bottom: 0.1em; }
  p { margin-top: 0; margin-bottom: 1rem; }

  .tabs {
    display: flex;
    gap: 0.3rem;
    margin-bottom: 1.2rem;
    border-bottom: 1px solid var(--rule);
  }
  .tab {
    background: transparent;
    border: none;
    box-shadow: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    padding: 0.4rem 0.6rem;
    cursor: pointer;
    color: var(--ink-muted);
    font-family: var(--serif);
    font-style: italic;
  }
  .tab.active {
    color: var(--ink);
    border-bottom-color: var(--accent);
  }
</style>
