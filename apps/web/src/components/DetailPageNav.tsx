import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Button, cn } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import { useShellBackHost } from '@/shell/shellBack';

export type DetailCrumb = {
  label: ReactNode;
  to?: string;
};

/**
 * Nested-page back control. When the shell breadcrumb row provides a host,
 * the button sits on that row's left, vertically centered with the crumbs.
 */
export function DetailPageNav({
  backTo,
  onBack,
  crumbs,
  backLabel,
  className,
}: {
  backTo?: string;
  /** Prefer `backTo` for in-app routes; use for close / custom navigation. */
  onBack?: () => void;
  crumbs?: DetailCrumb[];
  /** Defaults to `shell.back` (返回). */
  backLabel?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const backHost = useShellBackHost();
  const label = backLabel ?? t('shell.back');
  const showBack = Boolean(backTo || onBack);
  const showCrumbs = Boolean(crumbs && crumbs.length > 0);
  if (!showBack && !showCrumbs) return null;

  const backButton = showBack ? (
    <Button
      size="sm"
      variant="outline"
      type="button"
      to={backTo}
      onClick={onBack}
    >
      ← {label}
    </Button>
  ) : null;
  const crumbNav = showCrumbs ? (
        <nav aria-label={t('shell.breadcrumb')}>
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-ink-faint">
            {crumbs!.map((crumb, i) => {
              const last = i === crumbs!.length - 1;
              return (
                <li
                  key={i}
                  className="inline-flex min-w-0 items-center gap-1.5"
                >
                  {i > 0 ? (
                    <span className="text-ink-faint/70" aria-hidden>
                      /
                    </span>
                  ) : null}
                  {crumb.to && !last ? (
                    <Link
                      to={crumb.to}
                      className="truncate text-ink-muted hover:text-ink hover:opacity-80"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        'truncate',
                        last ? 'font-medium text-ink' : 'text-ink-muted',
                      )}
                      aria-current={last ? 'page' : undefined}
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
  ) : null;

  if (backHost && backButton) {
    return (
      <>
        {createPortal(backButton, backHost)}
        {crumbNav}
      </>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {backButton}
      {crumbNav}
    </div>
  );
}
