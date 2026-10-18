import { Logo, cn, type LogoLayout, type LogoTone } from '@a3s-lab/ui';
import { cacheBustTenantLogo, resolveBrandName, useLaunchTenant, usePrefs } from '@/prefs/store';
import { tenantLogoUrl, tenantMarkUrl } from '@/prefs/tenantInfo';

type BrandMarkProps = {
  size?: number;
  className?: string;
  alt?: string;
  tone?: LogoTone;
  layout?: LogoLayout;
  /** null forces the tenant PNG. undefined uses the saved data-URL override. */
  mark?: string | null;
  /** Use the transparent wordmark at its own aspect ratio. */
  wordmark?: boolean;
};

/** Launch-tenant mark, or a square data URL. Without a tenant, falls back to Logo. */
export function BrandMark({
  size = 28,
  className,
  alt,
  tone = 'auto',
  layout = 'icon',
  mark,
  wordmark = false,
}: BrandMarkProps) {
  const { brandLogoDataUrl, brandName, theme } = usePrefs();
  const launch = useLaunchTenant();
  const name = resolveBrandName(brandName);
  const label = alt ?? name;
  const logo = mark === undefined ? brandLogoDataUrl : mark;
  const surface =
    tone === 'dark' || (tone === 'auto' && theme === 'dark') ? 'dark' : 'light';

  if (wordmark && launch) {
    return (
      <img
        src={cacheBustTenantLogo(tenantMarkUrl(launch.slug, surface))}
        alt={label}
        height={size}
        decoding="async"
        draggable={false}
        className={cn('os-brand-mark os-brand-mark--wordmark', className)}
        style={{ height: size, width: 'auto' }}
      />
    );
  }

  if (logo) {
    return (
      <img
        src={logo}
        width={size}
        height={size}
        alt={label}
        decoding="async"
        draggable={false}
        className={cn('os-brand-mark', className)}
        style={{ objectFit: 'contain' }}
      />
    );
  }

  if (launch) {
    return (
      <img
        src={cacheBustTenantLogo(tenantLogoUrl(launch, surface))}
        width={size}
        height={size}
        alt={label}
        decoding="async"
        draggable={false}
        className={cn('os-brand-mark', className)}
        style={{ objectFit: 'contain' }}
      />
    );
  }

  return (
    <Logo layout={layout} size={size} className={className} tone={tone} alt={label} />
  );
}

export function useBrandName() {
  const { brandName, locale } = usePrefs();
  return resolveBrandName(brandName, locale);
}
