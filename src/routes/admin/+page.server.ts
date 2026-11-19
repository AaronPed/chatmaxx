import { sql } from '$lib/server/db';
import type { PageServerLoad } from './$types';

interface DailyRow { day: string; messages: number; }
interface SeriesRow { day: string; value: number; }
interface ModelRow { label: string; provider: string; messages: number; tokens: number; }
interface CountryRow { country: string; n: number; }
interface RecentRow {
  ts: string; status: string; model: string | null;
  country: string | null; ip_hash: string | null; latency_ms: number | null;
  error_message: string | null;
}

/**
 * Return a 30-day series with zero-filled days, so charts have a stable
 * x-axis even when traffic is bursty.
 */
function fillDays(rows: SeriesRow[]): SeriesRow[] {
  const map = new Map(rows.map((r) => [r.day, r.value]));
  const out: SeriesRow[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, value: map.get(key) ?? 0 });
  }
  return out;
}

export const load: PageServerLoad = async () => {
  const [totals, daily, byModel, byCountry, recent, providerStatus,
         newUsersRaw, newConvsRaw] = await Promise.all([
    sql<{ users: number; conversations: number; messages: number; tokens: number }[]>`
      select
        (select count(*)::int from users) as users,
        (select count(*)::int from conversations) as conversations,
        (select count(*)::int from messages) as messages,
        (select coalesce(sum(coalesce(prompt_tokens, 0) + coalesce(completion_tokens, 0)), 0)::float8 from interactions) as tokens
    `,
    sql<DailyRow[]>`
      select to_char(date_trunc('day', ts), 'YYYY-MM-DD') as day,
             count(*)::int as messages
      from interactions
      where ts > now() - interval '30 days' and status = 'ok'
      group by 1 order by 1 asc
    `,
    sql<ModelRow[]>`
      select coalesce(m.label, '(deleted)') as label,
             coalesce(p.label, '?') as provider,
             count(*)::int as messages,
             coalesce(sum(coalesce(i.prompt_tokens, 0) + coalesce(i.completion_tokens, 0)), 0)::float8 as tokens
      from interactions i
      left join models m on m.id = i.model_id
      left join providers p on p.id = m.provider_id
      where i.status = 'ok'
      group by m.label, p.label
      order by messages desc
      limit 20
    `,
    sql<CountryRow[]>`
      select coalesce(country, '—') as country, count(*)::int as n
      from interactions
      where ts > now() - interval '30 days'
      group by 1 order by n desc limit 15
    `,
    sql<RecentRow[]>`
      select to_char(i.ts, 'YYYY-MM-DD HH24:MI:SS') as ts,
             i.status,
             m.label as model,
             i.country,
             i.ip_hash,
             i.latency_ms,
             i.error_message
      from interactions i
      left join models m on m.id = i.model_id
      order by i.ts desc
      limit 30
    `,
    sql<{ provider: string; n: number }[]>`
      select p.name as provider, count(*)::int as n
        from models m join providers p on p.id = m.provider_id
       where m.enabled = true
       group by p.name
    `,
    sql<SeriesRow[]>`
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
             count(*)::int as value
        from users
       where created_at > now() - interval '30 days'
       group by 1 order by 1 asc
    `,
    sql<SeriesRow[]>`
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
             count(*)::int as value
        from conversations
       where created_at > now() - interval '30 days'
       group by 1 order by 1 asc
    `
  ]);

  // Cumulative users-over-time (all-time count rebased on the 30-day window).
  const totalUsers = totals[0]?.users ?? 0;
  const newUsers = fillDays(newUsersRaw);
  const newUsersTotal = newUsers.reduce((s, r) => s + r.value, 0);
  let baseline = totalUsers - newUsersTotal;
  const cumulativeUsers: SeriesRow[] = newUsers.map((r) => {
    baseline += r.value;
    return { day: r.day, value: baseline };
  });

  return {
    totals: totals[0] ?? { users: 0, conversations: 0, messages: 0, tokens: 0 },
    daily,                           // legacy bar — kept on the page for now
    series: {
      messages: fillDays(daily.map((d) => ({ day: d.day, value: d.messages }))),
      newUsers,
      newConversations: fillDays(newConvsRaw),
      cumulativeUsers
    },
    byModel,
    byCountry,
    recent,
    enabledProviders: providerStatus
  };
};
