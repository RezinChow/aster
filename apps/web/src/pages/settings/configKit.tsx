import { useEffect, useState, type ReactNode } from 'react';
import { Button, FilterChip, Input, Skeleton, cn } from '@a3s-lab/ui';
import { IconCheck, IconCopy, IconRotateCcw } from '@/components/UiIcons';
import { ConfigIcon, type ConfigIconName } from '@/pages/settings/configIcons';

export function fill(template: string, params: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function sectionAnchor(scope: string, id: string) {
  return `${scope}-${id}`;
}

/** Search field on the right, refresh as a ghost icon, page-specific controls on the left. */
export function ConfigToolbar({
  leading,
  query,
  onQuery,
  searchLabel,
  refreshLabel,
  refreshing,
  onRefresh,
}: {
  leading?: ReactNode;
  query: string;
  onQuery: (next: string) => void;
  searchLabel: string;
  refreshLabel: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">{leading}</div>
      <div className="ml-auto flex items-center gap-2">
        <div className="w-[220px]">
          <Input
            size="sm"
            value={query}
            placeholder={searchLabel}
            aria-label={searchLabel}
            onChange={(event) => onQuery(event.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-[30px] px-0"
          aria-label={refreshLabel}
          title={refreshLabel}
          disabled={refreshing}
          onClick={onRefresh}
        >
          <IconRotateCcw className={cn(refreshing && 'animate-spin [animation-direction:reverse]')} />
        </Button>
      </div>
    </div>
  );
}

/** The section in view, by anchor id; a chip click scrolls to it without hiding the others. */
function useSectionInView(anchors: string[]) {
  const [active, setActive] = useState<string | null>(anchors[0] ?? null);
  const key = anchors.join('|');
  useEffect(() => {
    const nodes = anchors
      .map((anchor) => document.getElementById(anchor))
      .filter((node): node is HTMLElement => node !== null);
    if (nodes.length === 0) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = anchors.find((anchor) => visible.has(anchor));
        if (first) setActive(first);
      },
      { rootMargin: '-15% 0px -60% 0px' },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [active, setActive] as const;
}

export function SectionChips({
  label,
  sections,
}: {
  label: string;
  sections: { anchor: string; label: string; count?: number; icon?: ConfigIconName }[];
}) {
  const [active, setActive] = useSectionInView(sections.map((section) => section.anchor));
  if (sections.length < 2) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap gap-0.5">
      {sections.map((section) => (
        <FilterChip
          key={section.anchor}
          label={section.label}
          count={section.count}
          icon={section.icon ? <ConfigIcon name={section.icon} /> : undefined}
          active={active === section.anchor}
          onClick={() => {
            setActive(section.anchor);
            document
              .getElementById(section.anchor)
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
      ))}
    </nav>
  );
}

/** Flat content card (radius 10px, 0.5px border); rows inside are split by hairlines. */
export function GroupCard({
  anchor,
  title,
  icon,
  meta,
  children,
}: {
  anchor: string;
  title: string;
  icon?: ConfigIconName;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={anchor} aria-labelledby={`${anchor}-title`} className="scroll-mt-16">
      <header className="mb-2 flex items-baseline justify-between gap-3 px-0.5">
        <h3
          id={`${anchor}-title`}
          className="flex items-center gap-2 text-[14px] font-medium text-ink"
        >
          {icon ? <ConfigIcon name={icon} className="text-ink-muted" /> : null}
          {title}
        </h3>
        {meta ? <span className="text-[12px] text-ink-faint">{meta}</span> : null}
      </header>
      <ul className="divide-y divide-[color:var(--color-hairline)] overflow-hidden rounded-[10px] border-[0.5px] border-border bg-bg-elevated">
        {children}
      </ul>
    </section>
  );
}

/** 24px row action with a 14px glyph. */
export function RowAction({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-[6px] text-ink-faint outline-none transition-colors hover:bg-surface hover:text-ink focus-visible:shadow-[inset_0_0_0_2px_rgba(0,0,0,0.1)] [&_svg]:size-3.5',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function CopyAction({
  value,
  label,
  copiedLabel,
  className,
}: {
  value: string;
  label: string;
  copiedLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <RowAction
      label={copied ? copiedLabel : label}
      className={className}
      onClick={() => {
        void navigator.clipboard
          .writeText(value)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          })
          .catch(() => undefined);
      }}
    >
      {copied ? <IconCheck strokeWidth={1.7} /> : <IconCopy strokeWidth={1.7} />}
    </RowAction>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      {[0, 1].map((block) => (
        <div key={block} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <div className="divide-y divide-[color:var(--color-hairline)] rounded-[10px] border-[0.5px] border-border">
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} className="flex items-center justify-between gap-6 px-4 py-3.5">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-3.5 w-40" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-16 text-center text-[14px] text-ink-faint">{children}</p>;
}
