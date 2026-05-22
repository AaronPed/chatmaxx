<script lang="ts">
  // Pure-SVG line chart. No external charting dep, ~80 lines.
  // Pass: data (sorted ascending by day), label (legend), variant ('navy' | 'accent').

  interface Point { day: string; value: number; }
  let {
    data,
    label,
    height = 140,
    variant = 'navy'
  }: {
    data: Point[];
    label: string;
    height?: number;
    variant?: 'navy' | 'accent' | 'highlight';
  } = $props();

  const PAD_X = 28;
  const PAD_Y = 14;

  const max = $derived(Math.max(1, ...data.map((p) => p.value)));
  const total = $derived(data.reduce((s, p) => s + p.value, 0));
  const last = $derived(data.at(-1)?.value ?? 0);

  const stroke = $derived(
    variant === 'accent' ? 'var(--accent)' :
    variant === 'highlight' ? 'var(--highlight)' :
    'var(--navy)'
  );
  const fill = $derived(
    variant === 'accent' ? 'rgba(107, 68, 35, 0.10)' :
    variant === 'highlight' ? 'rgba(201, 168, 106, 0.18)' :
    'rgba(44, 62, 94, 0.12)'
  );
</script>

<div class="chart" style:--h="{height}px">
  <div class="head">
    <div class="label small italic muted">{label}</div>
    <div class="readout small mono">
      <span title="total in window">{total}</span>
      <span class="muted">·</span>
      <span title="latest day">{last} today</span>
    </div>
  </div>
  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={label}>
    <!-- gridlines: top / mid / bottom -->
    <line x1="0" y1="0"   x2="100" y2="0"   class="grid" />
    <line x1="0" y1="50"  x2="100" y2="50"  class="grid faint" />
    <line x1="0" y1="100" x2="100" y2="100" class="grid" />

    {#if data.length >= 2}
      {@const step = 100 / (data.length - 1)}
      {@const pts = data.map((p, i) => {
        const x = i * step;
        const y = 100 - (p.value / max) * (100 - 4) - 2;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(' ')}
      {@const area = `0,100 ${pts} 100,100`}
      <polygon points={area} fill={fill} stroke="none" />
      <polyline points={pts} fill="none" stroke={stroke} stroke-width="0.9"
                stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
      {#each data as p, i}
        {@const x = i * step}
        {@const y = 100 - (p.value / max) * (100 - 4) - 2}
        <circle cx={x} cy={y} r="0.9" fill={stroke}>
          <title>{p.day}: {p.value}</title>
        </circle>
      {/each}
    {/if}
  </svg>
  <div class="axis small muted">
    <span>{data[0]?.day.slice(5) ?? ''}</span>
    <span>{data.at(Math.floor(data.length / 2))?.day.slice(5) ?? ''}</span>
    <span>{data.at(-1)?.day.slice(5) ?? ''}</span>
  </div>
</div>

<style>
  .chart { display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
  .head { display: flex; justify-content: space-between; align-items: baseline; }
  .readout span { font-variant-numeric: tabular-nums; }
  svg {
    width: 100%;
    height: var(--h, 140px);
    display: block;
    background:
      linear-gradient(180deg, rgba(255, 252, 240, 0.6) 0%, rgba(238, 230, 211, 0.4) 100%);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 0;
  }
  .grid { stroke: var(--rule); stroke-width: 0.4; vector-effect: non-scaling-stroke; }
  .grid.faint { stroke-dasharray: 2 2; opacity: 0.6; }
  .axis { display: flex; justify-content: space-between; font-size: 0.72rem; }
</style>
