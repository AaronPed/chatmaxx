#!/usr/bin/env node
// Ordered-file migrator. Applies every .sql in ./migrations in lexical order,
// recording each filename in a __migrations table so reruns are idempotent.

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dir = join(root, 'migrations');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });

async function main() {
  await sql`
    create table if not exists __migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `;
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const applied = new Set(
    (await sql`select filename from __migrations`).map((r) => r.filename)
  );

  for (const f of files) {
    if (applied.has(f)) {
      console.log(`= ${f} (already applied)`);
      continue;
    }
    const body = await readFile(join(dir, f), 'utf8');
    console.log(`+ ${f}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into __migrations (filename) values (${f})`;
    });
  }
  console.log('migrations complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => sql.end({ timeout: 5 }));
