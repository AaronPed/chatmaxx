import { json } from '@sveltejs/kit';
import { deleteUserSession, USER_COOKIE } from '$lib/server/user-auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
  const id = cookies.get(USER_COOKIE);
  if (id) await deleteUserSession(id);
  cookies.delete(USER_COOKIE, { path: '/' });
  return json({ ok: true });
};
