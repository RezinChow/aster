/** Resolve a site-root path against Rsbuild `BASE_URL` (e.g. `/` or `/official/`). */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalized = path.replace(/^\//, '');
  return `${base}${normalized}`;
}
