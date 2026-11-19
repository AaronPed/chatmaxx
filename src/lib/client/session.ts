// Browser-side auth helpers. Identity now lives in an httpOnly session cookie
// set by the server; the client only keeps a copy of the public profile for
// display. The source of truth on load is the +layout.server.ts `user` field.

import { errorMessage } from './http';

export interface ClientUser { id: string; email: string | null; nickname: string; }

async function postJson(url: string, body: unknown): Promise<ClientUser> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

export function login(email: string, password: string): Promise<ClientUser> {
  return postJson('/api/auth/login', { email, password });
}

export function register(email: string, username: string, password: string): Promise<ClientUser> {
  return postJson('/api/auth/register', { email, username, password });
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
}
