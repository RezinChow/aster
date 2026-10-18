import type { ReactNode } from 'react';
import { cn } from '@a3s-lab/ui';
import { AdminPageShell } from './AdminPageShell';

export type NeedSessionStateProps = {
  title: string;
  description?: string;
  message: string;
  actions?: ReactNode;
  className?: string;
};

/**
 * Shared “sign in required” block for identity pages.
 * Lives in apps/web (L3) — not a domain-agnostic ui primitive.
 */
export function NeedSessionState({
  title,
  description = '',
  message,
  actions,
  className = '',
}: NeedSessionStateProps) {
  return (
    <AdminPageShell title={title} description={description}>
      <div className={cn('max-w-lg', className)}>
        <p className="text-sm text-ink-muted">{message}</p>
        {actions ? <div className="mt-3">{actions}</div> : null}
      </div>
    </AdminPageShell>
  );
}
