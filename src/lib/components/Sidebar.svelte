<script lang="ts">
  import type { ClientUser } from '$lib/client/session';

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

  <button class="new" onclick={onNew}>+ new conversation</button>

  <div class="conv-list">
    {#each conversations as c (c.id)}
      <div class="conv-item" class:active={c.id === activeId}>
        <button class="conv-btn" onclick={() => onSelect(c.id)} title={c.title}>
          <div class="title">{c.title || 'Untitled'}</div>
          <div class="small muted">{relTime(c.updated_at)}</div>
        </button>
        <button class="del" title="delete" onclick={() => onDelete(c.id)}>×</button>
      </div>
    {:else}
      <div class="small muted italic empty">No conversations yet.</div>
    {/each}
  </div>

  <div class="foot">
    <a href="/admin" class="small muted">admin</a>
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
    background: rgba(255, 252, 240, 0.35);
    padding: 1rem 1rem 0.6rem;
    gap: 0.75rem;
    flex-shrink: 0;
  }
  .brand h2 { margin: 0; }
  .new {
    width: 100%;
    text-align: left;
  }
  .conv-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0 -0.4rem;
    padding: 0 0.4rem;
  }
  .conv-item {
    position: relative;
    display: flex;
    align-items: stretch;
  }
  .conv-btn {
    flex: 1;
    text-align: left;
    background: transparent;
    border: 1px solid transparent;
    padding: 0.5em 0.7em;
    box-shadow: none;
    overflow: hidden;
  }
  .conv-btn:hover { background: rgba(42, 36, 25, 0.06); }
  .conv-item.active .conv-btn {
    background: rgba(201, 168, 106, 0.18);
    border-color: var(--rule);
  }
  .title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .del {
    background: transparent;
    border: none;
    box-shadow: none;
    padding: 0 0.5rem;
    color: var(--ink-muted);
    font-size: 1.2rem;
    opacity: 0;
    transition: opacity 120ms;
  }
  .conv-item:hover .del { opacity: 1; }
  .del:hover { color: var(--danger); background: transparent; }
  .empty { padding: 1rem 0.4rem; }
  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--rule);
    padding-top: 0.6rem;
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
