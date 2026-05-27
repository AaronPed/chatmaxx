// Brute-force throttle for the single-password admin panel. In-memory, keyed by
// client IP — the right tool for a single-instance small app ("just timeouts",
// no external store). State resets on restart, which is fine: an attacker can't
// force restarts, and a restart only ever loosens, never tightens.
//
// First FREE_ATTEMPTS failures are allowed (each still pays the route's fixed
// delay). After that, each further failure locks the key for an exponentially
// growing window, capped at MAX_LOCK_MS. A success clears the key.

interface Attempt {
  fails: number;
  lockedUntil: number; // epoch ms
  last: number;        // epoch ms of last activity (for pruning)
}

const attempts = new Map<string, Attempt>();

const FREE_ATTEMPTS = 5;
const BASE_LOCK_MS = 30_000;          // 30s after the 6th failure
const MAX_LOCK_MS = 15 * 60_000;      // cap at 15 min
const PRUNE_IDLE_MS = 60 * 60_000;    // forget keys idle for an hour

function prune(now: number): void {
  for (const [k, a] of attempts) {
    if (a.lockedUntil <= now && now - a.last > PRUNE_IDLE_MS) attempts.delete(k);
  }
}

/** Remaining lockout in ms for this key, or 0 if it may attempt now. */
export function lockRemainingMs(key: string): number {
  const a = attempts.get(key);
  if (!a) return 0;
  const rem = a.lockedUntil - Date.now();
  return rem > 0 ? rem : 0;
}

/** Record a failed attempt. Returns the resulting lockout (ms), or 0. */
export function recordFailure(key: string): number {
  const now = Date.now();
  prune(now);
  const a = attempts.get(key) ?? { fails: 0, lockedUntil: 0, last: now };
  a.fails += 1;
  a.last = now;
  if (a.fails > FREE_ATTEMPTS) {
    const over = a.fails - FREE_ATTEMPTS; // 1, 2, 3, …
    const lock = Math.min(BASE_LOCK_MS * 2 ** (over - 1), MAX_LOCK_MS);
    a.lockedUntil = now + lock;
  }
  attempts.set(key, a);
  return a.lockedUntil > now ? a.lockedUntil - now : 0;
}

/** Clear all throttle state for a key after a successful login. */
export function recordSuccess(key: string): void {
  attempts.delete(key);
}
