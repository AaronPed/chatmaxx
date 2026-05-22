<script lang="ts">
  import type { ClientUser } from '$lib/client/session';
  import { toggleTheme, currentTheme } from '$lib/client/theme';

  interface ConvSummary { id: string; title: string; updated_at: string; }

  let {
    user,
    conversations,
    activeId,
    onSelect,
    onNew,
    onDelete,
    onSignOut
  }: {
    user: ClientUser;
    conversations: ConvSummary[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onNew: () => void;
    onDelete: (id: string) => void;
    onSignOut: () => void;
  } = $props();

  let theme = $state<'light' | 'dark'>(currentTheme());
  function flipTheme() { theme = toggleTheme(); }

  function relTime(iso: string): string {
    const d = new Date(iso).getTime();
    const m = (Date.now() - d) / 60000;
    if (m < 1) return 'just now';
    if (m < 60) return `${Math.floor(m)}m`;
    const h = m / 60;
    if (h < 24) return `${Math.floor(h)}h`;
    return `${Math.floor(h / 24)}d`;
  }
</script>

<aside class="sidebar">
  <div class="brand">
    <h2 class="italic">chatmaxx</h2>
    <div class="small muted">— {user.nickname}</div>
  </div>

  <button class="row-btn new" onclick={onNew}>+ new conversation</button>

  <div class="conv-list">
    {#each conversations as c (c.id)}
      <div class="conv-row" class:active={c.id === activeId}>
        <button class="row-btn conv-main" onclick={() => onSelect(c.id)} title={c.title}>
          <div class="title">{c.title || 'Untitled'}</div>
          <div class="small muted when">{relTime(c.updated_at)}</div>
        </button>
        <button class="conv-del" title="delete" onclick={() => onDelete(c.id)} aria-label="delete">×</button>
      </div>
    {:else}
      <div class="small muted italic empty">No conversations yet.</div>
    {/each}
  </div>

  <div class="foot">
    <a href="/admin" class="small muted">admin</a>
    <button class="link small muted" onclick={flipTheme}>
      {theme === 'dark' ? '☀ light' : '☾ dark'}
    </button>
    <button class="link small muted" onclick={onSignOut}>switch user</button>
  </div>
</aside>

<style>
  .sidebar {
    width: 280px;
    height: 100vh;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--rule);
    background: var(--sidebar-bg);
    padding: 1rem 0.75rem 0.6rem;
    gap: 0.6rem;
    flex-shrink: 0;
  }
  .brand h2 { margin: 0; }

  /* Shared button frame for "new" + each conv row. Identical padding /
     height / radius so they line up like a list. */
  .row-btn {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.45rem 0.7rem;
    border: 1px solid transparent;
    background: transparent;
    box-shadow: none;
    border-radius: var(--radius);
    font-family: var(--serif);
    font-size: 1rem;
    color: var(--ink);
    cursor: pointer;
    line-height: 1.3;
    overflow: hidden;
  }
  .row-btn:hover {
    background: var(--sidebar-hover);
    border-color: var(--rule);
  }

  .new {
    /* "new conversation" gets a quiet underline-style indicator */
    border: 1px dashed var(--rule);
  }
  .new:hover { border-style: solid; }

  .conv-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
  }
  .empty { padding: 1rem 0.4rem; }

  /* Each conv-row is the full bounding box. Hover styles attach here so
     hovering anywhere in the row reveals × and highlights the row. */
  .conv-row {
    position: relative;
  }
  .conv-row .conv-main {
    /* room on the right for the × so long titles don't sit under it */
    padding-right: 1.9rem;
  }
  .conv-row.active .conv-main {
    background: var(--sidebar-active);
    border-color: var(--rule);
  }
  .title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .when { margin-top: 0.05rem; }

  .conv-del {
    position: absolute;
    top: 50%;
    right: 0.3rem;
    transform: translateY(-50%);
    width: 22px;
    height: 22px;
    padding: 0;
    line-height: 1;
    font-size: 1.05rem;
    border-radius: 50%;
    background: var(--paper);
    color: var(--ink-muted);
    border: 1px solid var(--rule);
    box-shadow: var(--shadow-navy-soft);
    opacity: 0;
    transition: opacity 100ms ease, background 100ms ease, color 100ms ease;
    cursor: pointer;
  }
  .conv-row:hover .conv-del { opacity: 1; }
  .conv-del:hover {
    background: var(--danger);
    color: var(--paper);
    border-color: var(--danger);
  }

  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--rule);
    padding-top: 0.5rem;
    gap: 0.5rem;
  }
  .link {
    background: transparent;
    border: none;
    box-shadow: none;
    padding: 0;
    text-decoration: underline;
    cursor: pointer;
  }
</style>
