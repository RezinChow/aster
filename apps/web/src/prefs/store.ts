import { useSyncExternalStore } from 'react';
import {
  formatConsoleDocumentTitle,
  readInitialDocumentSurface,
  type DocumentSurface,
} from './documentTitle';
import { parseTenantInfo, tenantLogoUrl, type TenantInfo } from './tenantInfo';

export type Theme = 'light' | 'dark';
export type Locale = 'zh' | 'en';

// Theme storage migrated from the kense.os.theme key; the legacy value is
// read once so existing users keep their choice.
const THEME_KEY = 'a3s.os.theme';
const LEGACY_THEME_KEY = 'kense.os.theme';
const LOCALE_KEY = 'kense.os.locale';
const OVERRIDE_KEY = 'kense.os.brandOverride';

const DEFAULT_BRAND_NAME = 'A3S OS';
const MAX_LOGO_BYTES = 450_000;
const SLUG_RE = /^[a-z][a-z0-9-]{0,31}$/;

export function launchSlug(): string {
  const value = import.meta.env.PUBLIC_A3S_TENANT_SLUG;
  return typeof value === 'string' && SLUG_RE.test(value) ? value : '';
}

type BrandOverrideEntry = { name: string; logo: string | null };
type BrandOverrideMap = Record<string, BrandOverrideEntry>;

function readOverrideMap(): BrandOverrideMap {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(OVERRIDE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const map: BrandOverrideMap = {};
    for (const [key, entry] of Object.entries(parsed)) {
      if (!SLUG_RE.test(key) || !entry || typeof entry !== 'object' || Array.isArray(entry)) {
        continue;
      }
      const record = entry as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      const logo =
        typeof record.logo === 'string' &&
        record.logo.startsWith('data:image/') &&
        record.logo.length <= MAX_LOGO_BYTES
          ? record.logo
          : null;
      if (!name && !logo) continue;
      map[key] = { name, logo };
    }
    return map;
  } catch {
    return {};
  }
}

function readLaunchOverride(): BrandOverrideEntry {
  const slug = launchSlug();
  if (!slug) return { name: '', logo: null };
  return readOverrideMap()[slug] ?? { name: '', logo: null };
}

type Prefs = {
  theme: Theme;
  locale: Locale;
  /** Empty → fall back to DEFAULT_BRAND_NAME / i18n product name */
  brandName: string;
  /** Custom mark as data URL; null → built-in LogoMark */
  brandLogoDataUrl: string | null;
};

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const raw = window.localStorage.getItem(THEME_KEY) ?? window.localStorage.getItem(LEGACY_THEME_KEY);
  if (raw !== 'dark' && raw !== 'light') return 'light';
  try {
    if (!window.localStorage.getItem(THEME_KEY)) window.localStorage.setItem(THEME_KEY, raw);
  } catch {
    // storage unavailable; the in-memory value still applies
  }
  return raw;
}

function readLocale(): Locale {
  if (typeof window === 'undefined') return 'zh';
  const raw = window.localStorage.getItem(LOCALE_KEY);
  return raw === 'en' || raw === 'zh' ? raw : 'zh';
}

let tenant: TenantInfo | null = null;
let tenantError: string | null = null;
let tenantReady = typeof window === 'undefined' || launchSlug() === '';
let logoRevision = 0;

type TenantLoad = { ready: boolean; error: string | null; slug: string };
let tenantLoad: TenantLoad = {
  ready: tenantReady,
  error: null,
  slug: launchSlug(),
};

function publishTenantLoad() {
  tenantLoad = { ready: tenantReady, error: tenantError, slug: launchSlug() };
}

const initialOverride = readLaunchOverride();

let prefs: Prefs = {
  theme: readTheme(),
  locale: readLocale(),
  brandName: initialOverride.name,
  brandLogoDataUrl: initialOverride.logo,
};

const listeners = new Set<() => void>();
let documentSurface: DocumentSurface = readInitialDocumentSurface();

export function setDocumentSurface(surface: DocumentSurface) {
  documentSurface = surface;
  applyDocumentTitle();
}

function emit() {
  for (const listener of listeners) listener();
}

export function applyDocumentPrefs(
  theme = prefs.theme,
  locale = prefs.locale,
) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
  const slug = launchSlug();
  if (slug) document.documentElement.dataset.tenant = slug;
  if (tenant) {
    document.documentElement.style.setProperty('--a3s-tenant-brand', tenant.brand);
    document.documentElement.style.setProperty('--a3s-tenant-on-brand', tenant.on_brand);
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute(
        'content',
        locale === 'en' ? tenant.description.en : tenant.description.zh,
      );
    }
  }
  applyFavicon(theme);
  applyThemeColor(theme);
  applyDocumentTitle();
}

export function currentLogoRevision(): number {
  return logoRevision;
}

/** Same-URL logo files do not refetch until the query changes. */
export function cacheBustTenantLogo(href: string): string {
  if (logoRevision === 0 || !href.startsWith('/tenant/')) return href;
  return `${href}${href.includes('?') ? '&' : '?'}v=${logoRevision}`;
}

function applyDocumentTitle() {
  if (typeof document === 'undefined') return;
  if (launchSlug() && !tenant) return;
  document.title = formatConsoleDocumentTitle(
    resolveBrandName(prefs.brandName),
    documentSurface,
    prefs.locale,
  );
}

/** Surface tone: light → dark mark; dark → light mark. */
function applyFavicon(theme: Theme) {
  if (launchSlug() && !tenant && !prefs.brandLogoDataUrl) return;
  if (prefs.brandLogoDataUrl) {
    const href = prefs.brandLogoDataUrl;
    const type = href.startsWith('data:image/svg')
      ? 'image/svg+xml'
      : href.startsWith('data:image/png')
        ? 'image/png'
        : 'image/jpeg';
    upsertIconLink('icon-svg', { rel: 'icon', type, href });
    upsertIconLink('icon-png', {
      rel: 'icon',
      type,
      sizes: '32x32',
      href,
    });
    upsertIconLink('icon-ico', { rel: 'shortcut icon', href });
    return;
  }
  if (tenant) {
    const href = cacheBustTenantLogo(tenantLogoUrl(tenant, theme === 'dark' ? 'dark' : 'light'));
    const icons = document.querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]',
    );
    icons.forEach((link) => {
      link.href = href;
    });
    if (icons.length === 0) {
      upsertIconLink('icon-png', {
        rel: 'icon',
        type: 'image/png',
        href,
      });
    }
    return;
  }
  if (launchSlug()) return;
  const mark = theme === 'dark' ? 'dark' : 'light';
  const svgHref = `/logo/svg/a3s-icon-${mark}-transparent.svg`;
  const pngHref = `/logo/web-icons/a3s-icon-${mark}-32.png`;
  const icoHref = `/logo/web-icons/favicon-${mark}.ico`;

  upsertIconLink('icon-svg', {
    rel: 'icon',
    type: 'image/svg+xml',
    href: svgHref,
  });
  upsertIconLink('icon-png', {
    rel: 'icon',
    type: 'image/png',
    sizes: '32x32',
    href: pngHref,
  });
  upsertIconLink('icon-ico', {
    rel: 'shortcut icon',
    href: icoHref,
  });
}

function applyThemeColor(theme: Theme) {
  const color = tenant
    ? theme === 'dark'
      ? tenant.theme_color.dark
      : tenant.theme_color.light
    : theme === 'dark'
      ? '#111112'
      : '#f6f6f6';
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}

function upsertIconLink(key: string, attrs: Record<string, string>) {
  const selector = `link[data-a3s-favicon="${key}"]`;
  let link = document.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement('link');
    link.dataset.kenseFavicon = key;
    document.head.appendChild(link);
  }
  for (const [name, value] of Object.entries(attrs)) {
    link.setAttribute(name, value);
  }
}

function commit(next: Prefs) {
  prefs = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_KEY, next.theme);
    window.localStorage.setItem(LOCALE_KEY, next.locale);
  }
  applyDocumentPrefs(next.theme, next.locale);
  emit();
}

function writeOverrideMap(map: BrandOverrideMap) {
  if (typeof window === 'undefined') return;
  if (Object.keys(map).length === 0) window.localStorage.removeItem(OVERRIDE_KEY);
  else window.localStorage.setItem(OVERRIDE_KEY, JSON.stringify(map));
}

function clearSlugOverride(slug: string) {
  if (!slug || typeof window === 'undefined') return;
  const map = readOverrideMap();
  if (!map[slug]) return;
  delete map[slug];
  writeOverrideMap(map);
}

export function readLaunchBrandOverride(): BrandOverrideEntry {
  return readLaunchOverride();
}

export function useLaunchBrandOverride(): BrandOverrideEntry {
  usePrefs();
  return readLaunchOverride();
}

/** Replace the in-memory launch tenant and drop the per-slug name/logo override. */
export function applyLaunchTenant(info: TenantInfo): boolean {
  if (info.slug !== launchSlug()) return false;
  clearSlugOverride(info.slug);
  tenant = info;
  tenantError = null;
  tenantReady = true;
  logoRevision += 1;
  publishTenantLoad();
  commit({ ...prefs, brandName: '', brandLogoDataUrl: null });
  return true;
}

export function launchInfoName(locale: Locale = prefs.locale): string {
  if (!tenant) return '';
  return locale === 'en' ? tenant.name.en : tenant.name.zh;
}

export function resolveBrandName(stored = prefs.brandName, locale: Locale = prefs.locale): string {
  const trimmed = stored.trim();
  if (trimmed) return trimmed;
  const fromTenant = launchInfoName(locale);
  if (fromTenant) return fromTenant;
  if (launchSlug()) return '';
  return DEFAULT_BRAND_NAME;
}

export function getPrefs() {
  return prefs;
}

export function setTheme(theme: Theme) {
  if (theme === prefs.theme) return;
  commit({ ...prefs, theme });
}

export function setLocale(locale: Locale) {
  if (locale === prefs.locale) return;
  commit({ ...prefs, locale });
}

export function setBrandName(brandName: string) {
  if (brandName === prefs.brandName) return;
  commit({ ...prefs, brandName });
}

export function setBrandLogoDataUrl(brandLogoDataUrl: string | null) {
  if (brandLogoDataUrl === prefs.brandLogoDataUrl) return;
  commit({ ...prefs, brandLogoDataUrl });
}

/** Ignored while a launch tenant is selected. Config center is not the launch brand. */
export function applyBrandPrefs(brandName: string, brandLogoDataUrl: string | null) {
  if (launchSlug()) return;
  const nextName = brandName.trim();
  const nextLogo =
    brandLogoDataUrl && brandLogoDataUrl.startsWith('data:image/')
      ? brandLogoDataUrl
      : null;
  if (nextName === prefs.brandName && nextLogo === prefs.brandLogoDataUrl) {
    return;
  }
  commit({ ...prefs, brandName: nextName, brandLogoDataUrl: nextLogo });
}

export function saveLaunchBrand(name: string, logo: string | null) {
  const slug = launchSlug();
  const trimmed = name.trim();
  const nextLogo =
    logo && logo.startsWith('data:image/') && logo.length <= MAX_LOGO_BYTES ? logo : null;
  if (typeof window !== 'undefined' && slug) {
    const map = readOverrideMap();
    if (!trimmed && !nextLogo) delete map[slug];
    else map[slug] = { name: trimmed, logo: nextLogo };
    writeOverrideMap(map);
  }
  commit({ ...prefs, brandName: trimmed, brandLogoDataUrl: nextLogo });
}

export function useTenantLoad() {
  return useSyncExternalStore(
    subscribePrefs,
    () => tenantLoad,
    () => tenantLoad,
  );
}

export function useLaunchTenant() {
  usePrefs();
  return tenant;
}

export function resetBrand() {
  if (!prefs.brandName && !prefs.brandLogoDataUrl) return;
  commit({ ...prefs, brandName: '', brandLogoDataUrl: null });
}

/** Read file → square data URL suitable for localStorage. */
export function fileToBrandLogoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('not-image'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = () => {
      const raw = String(reader.result ?? '');
      if (!raw.startsWith('data:image/')) {
        reject(new Error('invalid-data'));
        return;
      }
      if (file.type === 'image/svg+xml' && raw.length <= MAX_LOGO_BYTES) {
        resolve(raw);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas'));
          return;
        }
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        let quality = 0.92;
        let out = canvas.toDataURL('image/png');
        if (out.length > MAX_LOGO_BYTES) {
          out = canvas.toDataURL('image/jpeg', quality);
          while (out.length > MAX_LOGO_BYTES && quality > 0.5) {
            quality -= 0.08;
            out = canvas.toDataURL('image/jpeg', quality);
          }
        }
        if (out.length > MAX_LOGO_BYTES) {
          reject(new Error('too-large'));
          return;
        }
        resolve(out);
      };
      img.onerror = () => reject(new Error('decode-failed'));
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

export function subscribePrefs(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePrefs() {
  return useSyncExternalStore(subscribePrefs, getPrefs, getPrefs);
}

async function loadLaunchTenant() {
  const slug = launchSlug();
  if (!slug) {
    tenantReady = true;
    publishTenantLoad();
    emit();
    return;
  }
  try {
    const response = await fetch(`/tenant/${slug}/INFO.md`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(String(response.status));
    const info = parseTenantInfo(await response.text());
    if (info.slug !== slug) throw new Error('slug');
    tenant = info;
    tenantError = null;
  } catch (error) {
    console.error(`launch tenant ${slug} failed`, error);
    tenant = null;
    tenantError = slug;
  }
  tenantReady = true;
  publishTenantLoad();
  applyDocumentPrefs();
  emit();
}

if (typeof window !== 'undefined') {
  const override = readLaunchOverride();
  prefs = {
    theme: readTheme(),
    locale: readLocale(),
    brandName: override.name,
    brandLogoDataUrl: override.logo,
  };
  if (launchSlug()) void loadLaunchTenant();
  else {
    tenantReady = true;
    publishTenantLoad();
  }
  applyDocumentPrefs();
}
