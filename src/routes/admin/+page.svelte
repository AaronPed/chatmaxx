<script lang="ts">
  import type { PageData } from './$types';
  import LineChart from '$lib/components/LineChart.svelte';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>dashboard · chatmaxx</title></svelte:head>

<h1 class="italic">Dashboard</h1>

<section class="totals">
  <div class="card stat"><div class="muted small">Users</div><div class="num">{data.totals.users}</div></div>
  <div class="card stat"><div class="muted small">Conversations</div><div class="num">{data.totals.conversations}</div></div>
  <div class="card stat"><div class="muted small">Messages</div><div class="num">{data.totals.messages}</div></div>
  <div class="card stat"><div class="muted small">Tokens (all-time)</div><div class="num">{data.totals.tokens.toLocaleString()}</div></div>
</section>

<section class="charts">
  <div class="card">
    <h3>Users (cumulative)</h3>
    <LineChart data={data.series.cumulativeUsers} label="total users" variant="navy" />
  </div>
  <div class="card">
    <h3>New users / day</h3>
    <LineChart data={data.series.newUsers} label="signups" variant="accent" />
  </div>
  <div class="card">
    <h3>Chats / day</h3>
    <LineChart data={data.series.newConversations} label="new conversations" variant="highlight" />
  </div>
  <div class="card">
    <h3>Messages / day</h3>
    <LineChart data={data.series.messages} label="messages" variant="navy" />
  </div>
</section>

<section class="grid">

  <div class="card">
    <h3>By model</h3>
    {#if data.byModel.length === 0}
      <p class="muted italic">No usage yet.</p>
    {:else}
      <table>
        <thead><tr><th>Model</th><th>Provider</th><th style="text-align:right">Messages</th><th style="text-align:right">Tokens</th></tr></thead>
        <tbody>
          {#each data.byModel as m}
            <tr>
              <td>{m.label}</td>
              <td class="muted small">{m.provider}</td>
              <td style="text-align:right">{m.messages}</td>
              <td style="text-align:right">{m.tokens.toLocaleString()}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <div class="card">
    <h3>Origins (last 30 days)</h3>
    {#if data.byCountry.length === 0}
      <p class="muted italic">No data yet.</p>
    {:else}
      <table>
        <thead><tr><th>Country</th><th style="text-align:right">Requests</th></tr></thead>
        <tbody>
          {#each data.byCountry as c}
            <tr><td>{c.country}</td><td style="text-align:right">{c.n}</td></tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <div class="card">
    <h3>Recent activity</h3>
    {#if data.recent.length === 0}
      <p class="muted italic">Nothing yet.</p>
    {:else}
      <table class="mono small">
        <thead>
          <tr><th>When</th><th>Model</th><th>Country</th><th>Latency</th><th>Status</th></tr>
        </thead>
        <tbody>
          {#each data.recent as r}
            <tr class:err={r.status === 'error'}>
              <td>{r.ts}</td>
              <td>{r.model ?? '—'}</td>
              <td>{r.country ?? '—'}</td>
              <td>{r.latency_ms ? `${r.latency_ms} ms` : '—'}</td>
              <td>{r.status}{#if r.error_message} — {r.error_message.slice(0, 60)}{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</section>

<style>
  .totals {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1.4rem;
  }
  .stat .num { font-size: 2rem; line-height: 1.1; margin-top: 0.2rem; }

  .charts {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1.2rem;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  .grid .card:first-child, .grid .card:last-child { grid-column: 1 / -1; }
  tr.err td { color: var(--danger); }

  @media (max-width: 1100px) {
    .charts { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 800px) {
    .totals { grid-template-columns: repeat(2, 1fr); }
    .grid { grid-template-columns: 1fr; }
    .charts { grid-template-columns: 1fr; }
  }
</style>
