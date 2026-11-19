import type { Handle } from '@sveltejs/kit/hooks';
import { isValidSession, ADMIN_COOKIE } from '$lib/server/admin-auth';
import { getUserIdBySession, USER_COOKIE } from '$lib/server/user-auth';
import { getUser } from '$lib/server/repo';
import { redirect, error } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get(ADMIN_COOKIE);
  event.locals.isAdmin = await isValidSession(sessionId);

  const userId = await getUserIdBySession(event.cookies.get(USER_COOKIE));
  event.locals.user = userId ? await getUser(userId) : null;

  const path = event.url.pathname;
  const isAdminArea = path.startsWith('/admin') && path !== '/admin/login';
  const isAdminApi = path.startsWith('/api/admin') && path !== '/api/admin/login';

  if (isAdminArea && !event.locals.isAdmin) {
    throw redirect(303, '/admin/login');
  }
  if (isAdminApi && !event.locals.isAdmin) {
    throw error(401, 'admin auth required');
  }

  // End-user API guard: everything under /api/ requires a signed-in user,
  // except the admin surface (handled above), the auth endpoints themselves,
  // and the unauthenticated health check.
  const isUserApi =
    path.startsWith('/api/') &&
    !path.startsWith('/api/admin') &&
    !path.startsWith('/api/auth') &&
    path !== '/api/health';
  if (isUserApi && !event.locals.user) {
    throw error(401, 'login required');
  }

  const response = await resolve(event);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
};
