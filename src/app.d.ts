// See https://kit.svelte.dev/docs/types#app
declare global {
  namespace App {
    interface Locals {
      isAdmin: boolean;
      // Resolved from the end-user session cookie by hooks.server.ts. Null when
      // not signed in. Never carries the password hash.
      user: { id: string; email: string | null; nickname: string; created_at: string } | null;
    }
  }
}

export {};
