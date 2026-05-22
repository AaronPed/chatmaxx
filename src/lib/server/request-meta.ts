// Extract origin metadata from a RequestEvent. IP is hashed (sha256, truncated)
// so the admin dashboard can show "unique visitors" without storing raw addresses.

import { createHash } from 'node:crypto';
import type { RequestEvent } from '@sveltejs/kit';

const SALT = process.env.IP_HASH_SALT ?? 'chatmaxx-default-salt';

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash('sha256').update(SALT).update(ip).digest('hex').slice(0, 16);
}

export function getMeta(event: RequestEvent) {
  const ip = event.getClientAddress?.() ?? event.request.headers.get('x-forwarded-for') ?? null;
  return {
    ipHash: hashIp(typeof ip === 'string' ? ip.split(',')[0].trim() : null),
    userAgent: event.request.headers.get('user-agent')?.slice(0, 300) ?? null,
    country: event.request.headers.get('cf-ipcountry')
          ?? event.request.headers.get('x-vercel-ip-country')
          ?? null,
    referer: event.request.headers.get('referer')?.slice(0, 300) ?? null
  };
}
