import { json, error } from '@sveltejs/kit';
import { createUser, getUserByEmail } from '$lib/server/repo';
import { hashPassword, createUserSession, USER_COOKIE } from '$lib/server/user-auth';
import type { RequestHandler } from './$types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json().catch(() => ({}));
  const email = String(body?.email ?? '').trim().toLowerCase();
  const nickname = String(body?.username ?? '').trim().slice(0, 60);
  const password = String(body?.password ?? '');

  if (!EMAIL_RE.test(email)) throw error(400, 'a valid email is required');
  if (!nickname) throw error(400, 'a username is required');
  if (password.length < MIN_PASSWORD) {
    throw error(400, `password must be at least ${MIN_PASSWORD} characters`);
  }
  if (await getUserByEmail(email)) throw error(409, 'an account with this email already exists');

  const user = await createUser(email, nickname, hashPassword(password));
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
