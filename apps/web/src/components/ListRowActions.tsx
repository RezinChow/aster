import type { ReactNode } from 'react';
import { Button, type ButtonProps } from '@a3s-lab/ui';
import { Tooltip } from '@/shell/Tooltip';

/**
 * Console list row action strip — PRINCIPLES UX · button-level `row` kind.
 *
 * Convention (platform-wide):
 * - Place via ResourceTable `rowActions` (not a data column).
 * - `size="sm"` · `variant="outline"` · icon then label, or icon-only with a hover tooltip.
 * - Keep actions on one row (`flex-nowrap`).
 * - Destructive actions use `tone="danger"`.
 * - 1–2 visible actions; overflow into IconMore menu when more.
 */
export function ListRowActions({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex flex-nowrap items-center justify-end gap-1">
      {children}
    </div>
  );
}

export type ListRowActionProps = Omit<ButtonProps, 'size' | 'variant' | 'children'> & {
  icon?: ReactNode;
  children?: ReactNode;
  /** Icon-only compact control; requires `aria-label`. */
  iconOnly?: boolean;
  /** Destructive row action (unlist / revoke / disable). */
  tone?: 'default' | 'danger';
};

export function ListRowAction({
  icon,
  iconOnly = false,
  children,
  tone = 'default',
  className = '',
  type = 'button',
  title,
  ...props
}: ListRowActionProps) {
  const labelFromChildren =
    typeof children === 'string' || typeof children === 'number'
      ? String(children)
      : undefined;
  const tip =
    title ?? (iconOnly ? (props['aria-label'] ?? labelFromChildren) : undefined);
  const ariaLabel =
    props['aria-label'] ?? (iconOnly ? labelFromChildren : undefined);

  const button = (
    <Button
      size="sm"
      variant="outline"
      type={type}
      title={iconOnly ? undefined : title}
      className={
        [
          tone === 'danger'
            ? '!border-[color:var(--color-error)] !text-[color:var(--color-error)]'
            : '',
          iconOnly ? '!size-8 !px-0' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')
      }
      {...props}
      aria-label={ariaLabel}
    >
      {icon}
      {iconOnly ? null : children}
    </Button>
  );

  if (iconOnly && tip) {
    return (
      <Tooltip label={tip} side="top">
        {button}
      </Tooltip>
    );
  }

  return button;
}
