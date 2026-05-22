import { json, error } from '@sveltejs/kit';
import { checkPassword, createSession, ADMIN_COOKIE } from '$lib/server/admin-auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json().catch(() => ({}));
  const password: string = body?.password ?? '';
  if (!checkPassword(password)) {
    // Small artificial delay to discourage rapid brute force.
    await new Promise((r) => setTimeout(r, 400));
    throw error(401, 'invalid password');
  }
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
