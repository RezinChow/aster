import type { ReactNode } from 'react';
import { ConsolePageHeader, cn } from '@a3s-lab/ui';
import {
  DetailPageNav,
  type DetailCrumb,
} from '@/components/DetailPageNav';

export type { DetailCrumb };

export function AdminPageShell({
  title,
  titlePrefix,
  leading,
  titleAdornment,
  description,
  actions,
  toolbar,
  backTo,
  onBack,
  crumbs,
  children,
  className,
}: {
  title: string;
  /** Owner shown before the name, in the repository `owner / name` heading. */
  titlePrefix?: string;
  leading?: ReactNode;
  titleAdornment?: ReactNode;
  description?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  /** Nested pages: top-left ← 返回 (same chrome as eng repo detail). */
  backTo?: string;
  onBack?: () => void;
  crumbs?: DetailCrumb[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      <DetailPageNav backTo={backTo} onBack={onBack} crumbs={crumbs} />
      <ConsolePageHeader
        title={title}
        titlePrefix={titlePrefix}
        leading={leading}
        titleAdornment={titleAdornment}
        description={description}
        actions={actions}
      />
      {toolbar ? (
        <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
      ) : null}
      {children}
    </div>
  );
}
