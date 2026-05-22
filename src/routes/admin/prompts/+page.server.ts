import { sql } from '$lib/server/db';
import type { PageServerLoad } from './$types';

interface SystemPromptRow {
  id: number;
  name: string;
  content: string;
}

export const load: PageServerLoad = async () => {
  const prompts = await sql<SystemPromptRow[]>`
    select id, name, content from system_prompts order by name asc
  `;
  return { prompts };
};
