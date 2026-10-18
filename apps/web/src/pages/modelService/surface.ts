export function matchesQuery(query: string, parts: readonly string[]): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return parts.join(' ').toLowerCase().includes(needle);
}
