import type { Handle } from '@sveltejs/kit';
import { isValidSession, ADMIN_COOKIE } from '$lib/server/admin-auth';
import { redirect, error } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get(ADMIN_COOKIE);
  event.locals.isAdmin = await isValidSession(sessionId);

  const path = event.url.pathname;
  const isAdminArea = path.startsWith('/admin') && path !== '/admin/login';
  const isAdminApi = path.startsWith('/api/admin') && path !== '/api/admin/login';

  if (isAdminArea && !event.locals.isAdmin) {
    throw redirect(303, '/admin/login');
  }
  if (isAdminApi && !event.locals.isAdmin) {
    throw error(401, 'admin auth required');
  }

  return resolve(event);
};
