import type { LayoutServerLoad } from './$types';

// Surface the signed-in user (resolved from the session cookie in
// hooks.server.ts) to the client on first paint — no localStorage, no flash.
export const load: LayoutServerLoad = ({ locals }) => ({ user: locals.user });
