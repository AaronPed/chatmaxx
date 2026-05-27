<script lang="ts">
  import type { ClientUser } from '$lib/client/session';
  import { toggleTheme, currentTheme } from '$lib/client/theme';

  interface ConvSummary { id: string; title: string; updated_at: string; folder_id: string | null; }
  interface FolderSummary { id: string; name: string; }

  let {
    user,
    conversations,
    folders,
    activeId,
    onSelect,
    onNew,
    onDelete,
    onSignOut,
    onNewFolder,
    onRenameFolder,
    onDeleteFolder,
    onMoveConversation
  }: {
    user: ClientUser;
    conversations: ConvSummary[];
    folders: FolderSummary[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onNew: () => void;
    onDelete: (id: string) => void;
    onSignOut: () => void;
    onNewFolder: () => void;
    onRenameFolder: (id: string, name: string) => void;
    onDeleteFolder: (id: string) => void;
    onMoveConversation: (convId: string, folderId: string | null) => void;
  } = $props();

  let theme = $state<'light' | 'dark'>(currentTheme());
  function flipTheme() { theme = toggleTheme(); }

  // UI state
  let collapsed = $state<Record<string, boolean>>({});
  let editingFolder = $state<string | null>(null);
  let editName = $state('');
  let dragConvId = $state<string | null>(null);
  let dropTarget = $state<string | null>(null); // folder id, or '__unfiled__'

  const UNFILED = '__unfiled__';

  function convsIn(folderId: string | null): ConvSummary[] {
    return conversations.filter((c) => c.folder_id === folderId);
  }

  function relTime(iso: string): string {
    const d = new Date(iso).getTime();
    const m = (Date.now() - d) / 60000;
    if (m < 1) return 'just now';
    if (m < 60) return `${Math.floor(m)}m`;
    const h = m / 60;
    if (h < 24) return `${Math.floor(h)}h`;
    return `${Math.floor(h / 24)}d`;
  }

  function startRename(f: FolderSummary) {
    editingFolder = f.id;
    editName = f.name;
  }
  function commitRename(id: string) {
    const n = editName.trim();
    if (n) onRenameFolder(id, n);
    editingFolder = null;
  }

  // ---- drag & drop ----
  function onDragStart(e: DragEvent, convId: string) {
    dragConvId = convId;
    e.dataTransfer?.setData('text/plain', convId);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }
  function onDragEnd() {
    dragConvId = null;
    dropTarget = null;
  }
  function onDragOver(e: DragEvent, target: string) {
    if (!dragConvId) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dropTarget = target;
  }
  function onDrop(e: DragEvent, folderId: string | null) {
    e.preventDefault();
    const id = dragConvId ?? e.dataTransfer?.getData('text/plain') ?? null;
    if (id) {
      const current = conversations.find((c) => c.id === id)?.folder_id ?? null;
      if (current !== folderId) onMoveConversation(id, folderId);
    }
    dragConvId = null;
    dropTarget = null;
  }
</script>

<aside class="sidebar">
  <div class="brand">
    <h2 class="italic">chatmaxx</h2>
    <div class="small muted">— {user.nickname}</div>
  </div>

  <div class="actions">
    <button class="row-btn new" onclick={onNew}>+ new conversation</button>
    <button class="row-btn new-folder" onclick={onNewFolder} title="new folder">+ folder</button>
  </div>

  <div class="lists">
    {#each folders as f (f.id)}
      {@const items = convsIn(f.id)}
      <div
        class="folder"
        class:drop={dropTarget === f.id}
        role="group"
        ondragover={(e) => onDragOver(e, f.id)}
        ondragleave={() => { if (dropTarget === f.id) dropTarget = null; }}
        ondrop={(e) => onDrop(e, f.id)}
      >
        <div class="folder-head">
          <button class="caret" onclick={() => (collapsed[f.id] = !collapsed[f.id])}
            aria-label={collapsed[f.id] ? 'expand' : 'collapse'}>
            {collapsed[f.id] ? '▸' : '▾'}
          </button>
          {#if editingFolder === f.id}
            <input
              class="folder-name-edit"
              bind:value={editName}
              onblur={() => commitRename(f.id)}
              onkeydown={(e) => { if (e.key === 'Enter') commitRename(f.id); if (e.key === 'Escape') editingFolder = null; }}
              autofocus
            />
          {:else}
            <button class="folder-name" ondblclick={() => startRename(f)} title="double-click to rename">
              {f.name}
            </button>
            <span class="count small muted">{items.length}</span>
          {/if}
          <span class="folder-tools">
            <button class="mini" title="rename" onclick={() => startRename(f)}>✎</button>
            <button class="mini" title="delete folder" onclick={() => onDeleteFolder(f.id)}>×</button>
          </span>
        </div>
        {#if !collapsed[f.id]}
          <div class="folder-body">
            {#each items as c (c.id)}
              {@render convRow(c)}
            {:else}
              <div class="small muted italic drop-hint">drop chats here</div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}

    <!-- Unfiled -->
    <div
      class="folder unfiled"
      class:drop={dropTarget === UNFILED}
      role="group"
      ondragover={(e) => onDragOver(e, UNFILED)}
      ondragleave={() => { if (dropTarget === UNFILED) dropTarget = null; }}
      ondrop={(e) => onDrop(e, null)}
    >
      {#if folders.length > 0}
        <div class="folder-head static">
          <span class="folder-name-static small muted italic">unfiled</span>
          <span class="count small muted">{convsIn(null).length}</span>
        </div>
      {/if}
      <div class="folder-body">
        {#each convsIn(null) as c (c.id)}
          {@render convRow(c)}
        {:else}
          {#if folders.length === 0}
            <div class="small muted italic empty">No conversations yet.</div>
          {/if}
        {/each}
      </div>
    </div>
  </div>

  <div class="foot">
    <a href="/admin" class="small muted">admin</a>
    <button class="link small muted" onclick={flipTheme}>{theme === 'dark' ? '☀ light' : '☾ dark'}</button>
    <button class="link small muted" onclick={onSignOut}>switch user</button>
  </div>
</aside>

{#snippet convRow(c: ConvSummary)}
  <div
    class="conv-row"
    class:active={c.id === activeId}
    class:dragging={dragConvId === c.id}
    draggable="true"
    role="button"
    tabindex="0"
    ondragstart={(e) => onDragStart(e, c.id)}
    ondragend={onDragEnd}
  >
    <button class="row-btn conv-main" onclick={() => onSelect(c.id)} title={c.title}>
      <div class="title">{c.title || 'Untitled'}</div>
      <div class="small muted when">{relTime(c.updated_at)}</div>
    </button>
    <button class="conv-del" title="delete" onclick={() => onDelete(c.id)} aria-label="delete">×</button>
  </div>
{/snippet}

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
  .actions { display: flex; gap: 0.4rem; }
  .actions .new { flex: 1; }

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
  .row-btn:hover { background: var(--sidebar-hover); border-color: var(--rule); }
  .new { border: 1px dashed var(--rule); }
  .new:hover { border-style: solid; }
  .new-folder {
    width: auto;
    white-space: nowrap;
    border: 1px dashed var(--rule);
    color: var(--ink-muted);
  }
  .new-folder:hover { border-style: solid; }

  .lists {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin: 0 -0.2rem;
    padding: 0 0.2rem;
  }

  .folder { border-radius: var(--radius); }
  .folder.drop {
    outline: 1px dashed var(--accent);
    background: rgba(201, 168, 106, 0.12);
  }
  .folder-head {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.2rem;
  }
  .folder-head.static { padding-left: 0.5rem; }
  .caret {
    background: transparent; border: none; box-shadow: none;
    padding: 0 0.15rem; cursor: pointer; color: var(--ink-muted);
    font-size: 0.8rem;
  }
  .folder-name {
    flex: 1; text-align: left;
    background: transparent; border: none; box-shadow: none;
    padding: 0.1rem 0.2rem; cursor: pointer; font-style: italic;
    color: var(--ink);
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  .folder-name-static { flex: 1; }
  .folder-name-edit { flex: 1; padding: 0.1rem 0.3rem; font-size: 0.95rem; }
  .count { padding: 0 0.2rem; }
  .folder-tools { display: none; gap: 0.1rem; }
  .folder-head:hover .folder-tools { display: inline-flex; }
  .mini {
    background: transparent; border: none; box-shadow: none;
    padding: 0 0.25rem; cursor: pointer; color: var(--ink-muted);
    font-size: 0.9rem;
  }
  .mini:hover { color: var(--danger); }

  .folder-body {
    display: flex; flex-direction: column; gap: 2px;
    padding-left: 0.6rem;
  }
  .drop-hint { padding: 0.3rem 0.5rem; }
  .empty { padding: 1rem 0.4rem; }

  .conv-row { position: relative; border-radius: var(--radius); }
  .conv-row[draggable="true"] { cursor: grab; }
  .conv-row.dragging { opacity: 0.45; }
  .conv-row .conv-main { padding-right: 1.9rem; }
  .conv-row.active .conv-main { background: var(--sidebar-active); border-color: var(--rule); }
  .title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .when { margin-top: 0.05rem; }

  .conv-del {
    position: absolute;
    top: 50%;
    right: 0.3rem;
    transform: translateY(-50%);
    width: 22px; height: 22px;
    padding: 0; line-height: 1; font-size: 1.05rem;
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
  .conv-del:hover { background: var(--danger); color: var(--paper); border-color: var(--danger); }

  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--rule);
    padding-top: 0.5rem;
    gap: 0.5rem;
  }
  .link {
    background: transparent; border: none; box-shadow: none;
    padding: 0; text-decoration: underline; cursor: pointer;
  }
</style>
