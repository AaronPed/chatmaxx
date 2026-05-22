<script lang="ts">
  import { page } from '$app/stores';

  let { children } = $props();

  const tabs = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/providers', label: 'Providers' },
    { href: '/admin/models', label: 'Models' },
    { href: '/admin/prompts', label: 'System prompts' }
  ];

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }
</script>

<div class="admin">
  <header class="topbar">
    <div class="row" style="gap: 1.4rem">
      <a href="/admin"><strong class="italic">chatmaxx</strong> <span class="muted small">/ admin</span></a>
      <nav class="row" style="gap: 1rem">
        {#each tabs as t}
          <a href={t.href}
             class:active={$page.url.pathname === t.href || ($page.url.pathname.startsWith(t.href) && t.href !== '/admin')}
             class="tab">{t.label}</a>
        {/each}
      </nav>
    </div>
    <div class="row">
      <a href="/" class="small muted">↩ chat</a>
      <button class="small" onclick={logout}>logout</button>
    </div>
  </header>
  <main class="body">
    {@render children?.()}
  </main>
</div>

<style>
  .admin { display: flex; flex-direction: column; min-height: 100vh; }
  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.8rem 1.5rem;
    border-bottom: 1px solid var(--rule);
    background: rgba(255, 252, 240, 0.4);
  }
  .tab {
    text-decoration: none;
    color: var(--ink-muted);
    padding: 0.2rem 0;
    border-bottom: 1px solid transparent;
  }
  .tab.active { color: var(--ink); border-bottom-color: var(--accent); }
  .body { padding: 1.4rem 1.8rem 3rem; width: 100%; }
</style>
