<script lang="ts">
  import { onMount } from 'svelte';
  import { registerUser } from '$lib/client/session';
  import Sparkles from '$lib/components/Sparkles.svelte';

  let { onDone }: { onDone: (u: { id: string; nickname: string }) => void } = $props();

  const NAME_LABELS = ['maxxer', 'mogger', 'larper', 'sloper', 'cringer'];
  let label = $state('');
  onMount(() => {
    label = NAME_LABELS[Math.floor(Math.random() * NAME_LABELS.length)];
  });

  let nickname = $state('');
  let busy = $state(false);
  let err = $state('');

  async function submit(e: Event) {
    e.preventDefault();
    if (!nickname.trim() || busy) return;
    busy = true;
    err = '';
    try {
      const u = await registerUser(nickname);
      onDone(u);
    } catch (e) {
      err = e instanceof Error ? e.message : 'failed';
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
    <form onsubmit={submit} class="stack">
      <label class="stack" style="gap: 0.3rem">
        <span class="small muted">What's your name{label ? `, ${label}` : ''}?</span>
        <input
          type="text"
          bind:value={nickname}
          placeholder="a name, a moniker, anything"
          maxlength="60"
          autofocus
        />
      </label>
      {#if err}<div class="small" style="color: var(--danger)">{err}</div>{/if}
      <div class="row" style="justify-content: flex-end">
        <button type="submit" class="primary" disabled={busy || !nickname.trim()}>
          {busy ? 'one moment…' : 'enter'}
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
  /* Card sits above the page-wide sparkle layer. */
  .gate > .card { position: relative; z-index: 2; }
  .card {
    width: min(440px, 100%);
    padding: 2rem 2.2rem;
    /* keep children above the sparkle layer */
    z-index: 1;
  }
  .card > :global(*) { position: relative; z-index: 2; }
  /* shimmering, gently pulsing navy bloom around the welcome card */
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
  p { margin-top: 0; margin-bottom: 1.4rem; }
</style>
