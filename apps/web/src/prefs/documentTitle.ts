export type DocumentSurface = 'admin' | 'plain';

/** Matches portal.entry.admin.title. */
const SUFFIX = {
  zh: { admin: '管理后台' },
  en: { admin: 'Admin Console' },
} as const;

export function formatConsoleDocumentTitle(
  brand: string,
  surface: DocumentSurface,
  locale: 'zh' | 'en',
): string {
  if (surface === 'plain') return brand;
  return `${brand} - ${SUFFIX[locale][surface]}`;
}

/** The console lives at `/admin`; other paths are transient redirects to it. */
export function documentSurfaceForPath(pathname: string): DocumentSurface {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  return 'plain';
}

export function readInitialDocumentSurface(): DocumentSurface {
  if (typeof window === 'undefined') return 'plain';
  return documentSurfaceForPath(window.location.pathname);
}
