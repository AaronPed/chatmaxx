import { sql } from '$lib/server/db';
import { getSettings } from '$lib/server/repo';
import type { PageServerLoad } from './$types';

interface ModelOption {
  id: number; label: string; model_id: string;
  provider_label: string; enabled: boolean;
}

export const load: PageServerLoad = async () => {
  const [settings, models] = await Promise.all([
    getSettings(),
    sql<ModelOption[]>`
      select m.id, m.label, m.model_id, p.label as provider_label, m.enabled
        from models m join providers p on p.id = m.provider_id
       order by p.sort_order asc, m.sort_order asc, m.label asc
    `
  ]);
  return { settings, models };
};
