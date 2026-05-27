// End-user authentication. Passwords are hashed with scrypt (Node built-in —
// no extra dependency) and verified in constant time. Sessions are opaque
// random tokens stored server-side in `user_sessions`, handed to the browser
// as an httpOnly cookie. Mirrors the admin-auth model.

import { sql } from './db';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SESSION_TTL_HOURS = 24 * 30; // 30 days
export const USER_COOKIE = 'chatmaxx_user';

// scrypt cost params (defaults: N=16384, r=8, p=1) are fine for interactive
// login volume on a small app.
const KEYLEN = 64;

/** Returns `scrypt$<saltHex>$<hashHex>`. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const expected = Buffer.from(parts[2], 'hex');
  let actual: Buffer;
  try {
    actual = scryptSync(password, Buffer.from(parts[1], 'hex'), expected.length);
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createUserSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
  const id = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);
  await sql`
    insert into user_sessions (id, user_id, expires_at) values (${id}, ${userId}, ${expiresAt})
  `;
  return { id, expiresAt };
}

export async function getUserIdBySession(id: string | undefined | null): Promise<string | null> {
  if (!id) return null;
  const rows = await sql<{ user_id: string }[]>`
    select user_id from user_sessions where id = ${id} and expires_at > now()
  `;
  return rows[0]?.user_id ?? null;
}

export async function deleteUserSession(id: string): Promise<void> {
  await sql`delete from user_sessions where id = ${id}`;
}

export async function cleanupExpiredUserSessions(): Promise<void> {
  await sql`delete from user_sessions where expires_at <= now()`;
}
