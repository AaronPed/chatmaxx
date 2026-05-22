import { json } from '@sveltejs/kit';
import { sql } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  // Public dropdown. Joins to providers so the client gets the human-friendly
  // provider label without having to look it up separately.
  const rows = await sql<{
    id: number; model_id: string; label: string;
    provider_name: string; provider_label: string;
  }[]>`
    select m.id, m.model_id, m.label,
           p.name as provider_name, p.label as provider_label
      from models m
      join providers p on p.id = m.provider_id
     where m.enabled = true and p.enabled = true
     order by m.sort_order asc, m.label asc
  `;
  return json(rows);
};
