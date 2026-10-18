/** Console API reference sources. One public route, three contracts. */
export const DOCS_SOURCES = ['os', 'cloud', 'work'] as const;

export type DocsSource = (typeof DOCS_SOURCES)[number];

/** Unknown or empty values stay on the platform contract. */
export function parseDocsSource(value: string | null | undefined): DocsSource {
  if (value === 'cloud' || value === 'work') return value;
  return 'os';
}

/**
 * Canonical docs URL.
 * The platform source omits `source` so existing `/docs/:opId` links stay valid.
 */
export function docsHref(opId: string | undefined, source: DocsSource): string {
  const path = opId ? `/docs/${opId}` : '/docs';
  if (source === 'os') return path;
  return `${path}?source=${source}`;
}
