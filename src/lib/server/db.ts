import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  // Lazy-fail: SvelteKit imports this at build-time too. Throwing here would break `vite build`.
  console.warn('[db] DATABASE_URL is not set — runtime queries will fail until configured.');
}

export const sql = postgres(url ?? 'postgres://invalid', {
  max: 10,
  idle_timeout: 30,
  prepare: false
});

export type Sql = typeof sql;
