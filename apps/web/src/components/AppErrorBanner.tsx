import { ErrorBanner, type ErrorBannerProps } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';

/** Localized ErrorBanner — UI package defaults stay English for package consumers. */
export function AppErrorBanner({
  title,
  retryLabel,
  ...props
}: ErrorBannerProps) {
  const { t } = useI18n();
  return (
    <ErrorBanner
      {...props}
      title={title ?? t('admin.error.title')}
      retryLabel={retryLabel ?? t('admin.error.retry')}
    />
  );
}
