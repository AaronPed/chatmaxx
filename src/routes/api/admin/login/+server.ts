import { json, error } from '@sveltejs/kit';
import {
  checkPassword, createSession, cleanupExpiredSessions, ADMIN_COOKIE
} from '$lib/server/admin-auth';
import { lockRemainingMs, recordFailure, recordSuccess } from '$lib/server/login-throttle';
import type { RequestHandler } from './$types';

// Throttle is keyed by the TCP peer (getClientAddress), not a spoofable header.
function clientKey(getClientAddress: () => string): string {
  try {
    return getClientAddress() || 'unknown';
  } catch {
    return 'unknown';
  }
}

const lockedMessage = (ms: number) =>
  `too many attempts — try again in ${Math.ceil(ms / 1000)}s`;

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
  const key = clientKey(getClientAddress);

  const locked = lockRemainingMs(key);
  if (locked > 0) throw error(429, lockedMessage(locked));

  const body = await request.json().catch(() => ({}));
  const password: string = body?.password ?? '';
  if (!checkPassword(password)) {
    const lockMs = recordFailure(key);
    // Fixed delay slows even the pre-lockout attempts.
    await new Promise((r) => setTimeout(r, 400));
    if (lockMs > 0) throw error(429, lockedMessage(lockMs));
    throw error(401, 'invalid password');
  }

  recordSuccess(key);
  cleanupExpiredSessions().catch(() => {});
  const { id, expiresAt } = await createSession();
  cookies.set(ADMIN_COOKIE, id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt
  });
  return json({ ok: true });
};
