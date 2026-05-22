// Render assistant text as sanitized HTML.
//
// Pipeline: marked (GFM markdown) → DOMPurify with a strict allow-list.
//
// Security posture:
//   - No <script>, <iframe>, <object>, <embed>, <style>, <link>, <meta>,
//     <form>/<input>/<button>, <svg> or <math> — nothing executable.
//   - No inline event handlers (on*) or javascript:/vbscript:/file: URLs.
//   - <a> targets open in a new tab with rel="noopener noreferrer".
//   - <img src> must be data:image/*, https://*, or '/' (same-origin).
//     If ALLOWED_IMG_HOSTS is non-empty the https hosts are restricted to it.
//
// This module is client-only — it imports DOMPurify, which needs `window`.
// SvelteKit's SSR pass doesn't render any assistant content yet (the welcome
// screen has no messages until the user starts typing) so the import is
// guarded with a typeof check.

import { marked } from 'marked';
import DOMPurify from 'dompurify';

/** Edit this list to lock image sources to specific hosts. Empty = allow
 *  any https host. data:image/* is always allowed (used by our own uploads).
 *  Match logic: exact host or any subdomain (`endsWith('.' + entry)`). */
const ALLOWED_IMG_HOSTS: string[] = [];

const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'span', 'div',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'mark', 'small',
  'sub', 'sup',
  'code', 'pre', 'kbd', 'samp', 'var',
  'ul', 'ol', 'li',
  'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a', 'img'
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title',
  'class',
  'colspan', 'rowspan', 'align',
  'start', 'reversed', 'type',
  'target', 'rel'   // hook below sets these on <a>; DOMPurify still checks values
];

marked.setOptions({ gfm: true, breaks: true });

let hooksRegistered = false;
function registerHooks() {
  if (hooksRegistered) return;
  hooksRegistered = true;

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (!(node instanceof Element)) return;

    // Force safe link defaults.
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }

    // Restrict <img src> by scheme + (optionally) host.
    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src') ?? '';
      const ok = imgSrcAllowed(src);
      if (!ok) node.removeAttribute('src');
    }
  });
}

function imgSrcAllowed(src: string): boolean {
  if (!src) return false;
  if (src.startsWith('data:image/')) return true;
  if (src.startsWith('/') && !src.startsWith('//')) return true;       // same-origin path
  if (!src.startsWith('https://')) return false;                       // require TLS
  if (ALLOWED_IMG_HOSTS.length === 0) return true;
  try {
    const host = new URL(src).hostname;
    return ALLOWED_IMG_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

export function renderMarkdown(text: string): string {
  if (typeof window === 'undefined') {
    // SSR — return the raw text inside a paragraph; the client will re-render
    // properly once hydrated. This avoids pulling in jsdom on the server.
    return escapeHtml(text);
  }
  registerHooks();
  const html = marked.parse(text, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?:|mailto:|tel:|#|\/)|data:image\/)/i,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style', 'link', 'meta', 'form', 'input', 'button', 'svg', 'math']
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]!));
}
