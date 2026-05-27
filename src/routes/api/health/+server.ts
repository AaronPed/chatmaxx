// Liveness/readiness probe: confirms the process is up and the DB is reachable.
// Unauthenticated by design (see hooks.server.ts).

import { json, error } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    await sql`select 1`;
    return json({ status: 'ok' });
  } catch {
    throw error(503, 'database unavailable');
  }
};
