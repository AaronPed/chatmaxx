/** Human-readable message from a failed API response (SvelteKit sends `{ message }`). */
export async function errorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  let message: unknown;
  try {
    message = JSON.parse(text)?.message;
  } catch {
    message = text;
  }
  return typeof message === 'string' && message ? message : `request failed (${res.status})`;
}
