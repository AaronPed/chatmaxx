// Browser-side user state. Stores { userId, nickname } in localStorage.
// The userId is created server-side (uuid v7) when the user first picks a nickname.

const KEY = 'chatmaxx.user';

export interface ClientUser { id: string; nickname: string; }

export function readUser(): ClientUser | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.id && parsed?.nickname) return parsed as ClientUser;
  } catch {}
  return null;
}

export function writeUser(u: ClientUser) {
  localStorage.setItem(KEY, JSON.stringify(u));
}

export function clearUser() {
  localStorage.removeItem(KEY);
}

export async function registerUser(nickname: string, existingId?: string): Promise<ClientUser> {
  const res = await fetch('/api/user', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nickname, id: existingId })
  });
  if (!res.ok) throw new Error(await res.text());
  const u = await res.json();
  const cu: ClientUser = { id: u.id, nickname: u.nickname };
  writeUser(cu);
  return cu;
}
