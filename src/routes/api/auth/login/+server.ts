import { json, error } from '@sveltejs/kit';
import { getUserByEmail } from '$lib/server/repo';
import {
  verifyPassword, createUserSession, cleanupExpiredUserSessions, USER_COOKIE
} from '$lib/server/user-auth';
import { lockRemainingMs, lockedMessage, recordFailure, recordSuccess } from '$lib/server/login-throttle';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
  const body = await request.json().catch(() => ({}));
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');

  // Per client and account, so one user's typos never lock out another.
  const key = `user:${getClientAddress()}:${email}`;
  const locked = lockRemainingMs(key);
  if (locked > 0) throw error(429, lockedMessage(locked));

  const user = await getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    const lockMs = recordFailure(key);
    await new Promise((r) => setTimeout(r, 400));
    if (lockMs > 0) throw error(429, lockedMessage(lockMs));
    throw error(401, 'invalid email or password');
  }
  recordSuccess(key);

  // Opportunistic housekeeping so expired sessions don't accumulate forever.
  cleanupExpiredUserSessions().catch(() => {});

  const { id, expiresAt } = await createUserSession(user.id);
  cookies.set(USER_COOKIE, id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt
  });
  return json({ id: user.id, email: user.email, nickname: user.nickname });
};
