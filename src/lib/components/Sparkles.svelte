<script lang="ts">
  import { onMount } from 'svelte';

  // Twinkling sparkles scattered across the nearest positioned ancestor.
  // Positions are randomized in onMount (client-only) so we don't get a
  // visible "lattice" from a too-regular pseudo-random, and SSR doesn't
  // disagree with the hydrated DOM.

  let {
    count = 22,
    palette = 'jewel'
  }: {
    count?: number;
    palette?: 'jewel' | 'gold' | 'navy' | 'coral';
  } = $props();

  const PALETTES: Record<string, string[]> = {
    jewel: ['#e8b542', '#1f8a8a', '#d75a3a', '#7a3c6b', '#79a6d9', '#c97a4b', '#e8c97a'],
    gold:  ['#e8b542', '#c98a2a', '#f3d27a'],
    navy:  ['#3a5891', '#79a6d9', '#1f3a6b'],
    coral: ['#d75a3a', '#e8845b', '#a83b25']
  };

  interface Spark { top: number; left: number; size: number; delay: number; dur: number; tint: string; }

  let sparks = $state<Spark[]>([]);
  function regenerate() {
    const colors = PALETTES[palette] ?? PALETTES.jewel;
    sparks = Array.from({ length: count }, (_, i) => ({
      top:   Math.random() * 100,
      left:  Math.random() * 100,
      size:  1.2 + Math.random() * 2.6,        // 1.2 – 3.8 px
      // 2× slower than before — durations 4–9s, delays 0–7s.
      delay: Math.random() * 7,
      dur:   4 + Math.random() * 5,
      tint:  colors[Math.floor(Math.random() * colors.length)]
    }));
  }

  onMount(regenerate);
</script>

<div class="sparkles" aria-hidden="true">
  {#each sparks as s}
    <span
      class="spark"
      style="
        top:{s.top}%;
        left:{s.left}%;
        width:{s.size}px;
        height:{s.size}px;
        background:{s.tint};
        color:{s.tint};
        animation-delay:{s.delay}s;
        animation-duration:{s.dur}s;
      "
    ></span>
  {/each}
</div>

<style>
  .sparkles {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 0;
  }
  .spark {
    position: absolute;
    border-radius: 50%;
    opacity: 0;
    animation-name: twinkle;
    animation-iteration-count: infinite;
    animation-timing-function: ease-in-out;
    box-shadow:
      0 0 10px 1px currentColor,
      0 0 3px rgba(255, 255, 255, 0.9) inset;
    will-change: opacity, transform;
  }
  @keyframes twinkle {
    0%, 100% { opacity: 0;    transform: scale(0.45); }
    35%, 65% { opacity: 1;    transform: scale(1.25); }
  }
  @media (prefers-reduced-motion: reduce) {
    .spark { animation-duration: 12s; }
  }
</style>
