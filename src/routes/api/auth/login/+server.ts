import { json, error } from '@sveltejs/kit';
import { getUserByEmail } from '$lib/server/repo';
import {
  verifyPassword, createUserSession, cleanupExpiredUserSessions, USER_COOKIE
} from '$lib/server/user-auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json().catch(() => ({}));
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');

  const user = await getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    // Small artificial delay to blunt rapid credential stuffing.
    await new Promise((r) => setTimeout(r, 400));
    throw error(401, 'invalid email or password');
  }

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
