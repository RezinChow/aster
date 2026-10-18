import { ConsoleEmptyState } from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';

/**
 * IA destination without a product surface yet.
 * PAGE-UX: real shell + ConsoleEmptyState — never a bare Card that reads as broken.
 */
export function PlaceholderPage({
  titleKey,
  descriptionKey,
}: {
  titleKey?: MessageKey;
  descriptionKey: MessageKey;
}) {
  const { t } = useI18n();

  return (
    <AdminPageShell
      title={titleKey ? t(titleKey) : t('placeholder.title')}
      description={t(descriptionKey)}
    >
      <ConsoleEmptyState
        variant="no-data"
        title={t('placeholder.title')}
        description={t('placeholder.footnote')}
      />
    </AdminPageShell>
  );
}
