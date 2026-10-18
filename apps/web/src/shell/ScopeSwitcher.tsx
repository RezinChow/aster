import { useMemo } from 'react';
import { cn, OrgMark, SearchSelect } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';

export type ScopeOption = {
  value: string;
  label: string;
  logoUrl?: string;
};

export type ScopeSwitcherProps = {
  orgId: string;
  orgLabel?: string;
  orgOptions: ScopeOption[];
  onOrgChange: (orgId: string) => void;
  /** Only the official home Org may switch channel partners. */
  canSwitchOrgs?: boolean;
  className?: string;
};

/**
 * Official operator switches saved channel partners.
 * Non-official sessions hide the control.
 */
export function ScopeSwitcher({
  orgId,
  orgOptions,
  onOrgChange,
  canSwitchOrgs = false,
  className = '',
}: ScopeSwitcherProps) {
  const { t } = useI18n();

  const searchOptions = useMemo(
    () =>
      orgOptions.map((org) => ({
        value: org.value,
        label: org.label,
        keywords: org.value,
        icon: (
          <OrgMark
            className="os-scope-org__mark"
            name={org.label}
            seed={org.value}
            logoUrl={org.logoUrl}
            size={20}
          />
        ),
      })),
    [orgOptions],
  );

  if (!canSwitchOrgs) {
    return null;
  }

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      role="group"
      aria-label={t('shell.scope.ariaLabel')}
    >
      <SearchSelect
        className="os-scope-org"
        size="sm"
        value={orgId}
        options={searchOptions}
        onChange={onOrgChange}
        placeholder={t('shell.scope.orgPlaceholder')}
        searchPlaceholder={t('shell.scope.orgSearch')}
        emptyText={t('shell.scope.orgSearchEmpty')}
        aria-label={t('shell.scope.org')}
        searchable
        disabled={orgOptions.length === 0}
      />
    </div>
  );
}
