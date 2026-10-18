import type { ReactNode } from 'react';
import { ConsolePageHeader } from '@a3s-lab/ui';

/** 个人中心页头：标题、说明、操作同一行，不使用装饰图。 */
export function AccountPage({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className ? `os-org-page ${className}` : 'os-org-page'}>
      <header className="os-org-page__header">
        <ConsolePageHeader title={title} description={description} actions={actions} />
      </header>
      <div className="os-org-page__body">{children}</div>
    </div>
  );
}

/** Label on the left, value or control on the right. */
export function AccountSetting({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="os-org-setting">
      <div>
        <div className="os-org-setting__label">{label}</div>
        {hint ? <p className="os-org-setting__hint">{hint}</p> : null}
      </div>
      <div className="os-org-setting__value">{children}</div>
    </div>
  );
}
