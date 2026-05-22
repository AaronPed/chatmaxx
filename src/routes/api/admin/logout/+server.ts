import { json } from '@sveltejs/kit';
import { deleteSession, ADMIN_COOKIE } from '$lib/server/admin-auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
  const id = cookies.get(ADMIN_COOKIE);
  if (id) await deleteSession(id);
  cookies.delete(ADMIN_COOKIE, { path: '/' });
  return json({ ok: true });
};
