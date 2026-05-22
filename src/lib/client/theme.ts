// Theme toggle. The initial value is applied in app.html before paint
// (so there's no light → dark flash on dark-mode users); this module is
// only for runtime toggling after hydration.

export type Theme = 'light' | 'dark';
const KEY = 'chatmaxx.theme';

export function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return (document.documentElement.dataset.theme as Theme) || 'light';
}

export function setTheme(t: Theme) {
  if (typeof document === 'undefined') return;
  if (t === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem(KEY, t); } catch {}
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
