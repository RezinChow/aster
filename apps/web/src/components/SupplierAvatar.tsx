import { cn } from '@a3s-lab/ui';
import { getProviderIconAssetMetrics, resolveProviderIconRef, useIcon } from '@a3s-lab/ui/icons';
import { TENANT_LOGO_AVATAR } from '@/data/suppliers';
import { cacheBustTenantLogo, useLaunchTenant, usePrefs, useTenantLoad } from '@/prefs/store';
import { tenantLogoUrl } from '@/prefs/tenantInfo';

/** Same mark BrandMark shows for the launch tenant. */
export function useTenantLogoUrl(): string | null {
  const prefs = usePrefs();
  const launch = useLaunchTenant();
  const load = useTenantLoad();
  if (prefs.brandLogoDataUrl) return prefs.brandLogoDataUrl;
  if (launch) {
    return cacheBustTenantLogo(
      tenantLogoUrl(launch, prefs.theme === 'dark' ? 'dark' : 'light'),
    );
  }
  if (!load.ready) return null;
  return null;
}

/**
 * Commerce supplier mark. `icon:<id>` uses the shared provider icon pack
 * (the same artwork Cherry Studio shows). `tenant:logo` follows the launch
 * tenant. Any other value stays an image.
 */
export function SupplierAvatar({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const tenantLogo = useTenantLogoUrl();
  const resolved = src === TENANT_LOGO_AVATAR ? (tenantLogo ?? '') : src;
  const iconId = resolved.startsWith('icon:') ? resolved.slice('icon:'.length) : '';
  const ref = iconId ? resolveProviderIconRef(iconId) : undefined;
  const Icon = useIcon(ref);

  if (ref && Icon) {
    const metrics = getProviderIconAssetMetrics({ kind: ref.kind, iconId: ref.meta.id });
    return (
      <span className={cn('os-supplier-avatar', className)}>
        <Icon
          style={{
            width: `${metrics.canvasScale * 100}%`,
            height: `${metrics.canvasScale * 100}%`,
            flexShrink: 0,
          }}
        />
      </span>
    );
  }

  if (!iconId && resolved) {
    return (
      <img
        src={resolved}
        alt=""
        className={cn(
          'block shrink-0',
          src === TENANT_LOGO_AVATAR ? 'object-contain' : 'object-cover',
          className,
        )}
      />
    );
  }

  return <span className={cn('os-supplier-avatar bg-[#f4f4f5]', className)} aria-hidden />;
}
