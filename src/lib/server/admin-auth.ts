import { sql } from './db';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_TTL_HOURS = 24 * 7;
export const ADMIN_COOKIE = 'chatmaxx_admin';

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function createSession(): Promise<{ id: string; expiresAt: Date }> {
  const id = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);
  await sql`
    insert into admin_sessions (id, expires_at) values (${id}, ${expiresAt})
  `;
  return { id, expiresAt };
}

export async function isValidSession(id: string | undefined | null): Promise<boolean> {
  if (!id) return false;
  const rows = await sql<{ id: string }[]>`
    select id from admin_sessions where id = ${id} and expires_at > now()
  `;
  return rows.length > 0;
}

export async function deleteSession(id: string): Promise<void> {
  await sql`delete from admin_sessions where id = ${id}`;
}

export async function cleanupExpiredSessions(): Promise<void> {
  await sql`delete from admin_sessions where expires_at <= now()`;
}
