import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CopyButton, cn } from '@a3s-lab/ui';
import { IconChevronDown, IconEdit, IconFileText } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';

/** Install count shown beside the repository actions. It is a fact, not a control. */
export function RepoInstallCount({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex h-[30px] items-center gap-1.5 rounded-md border border-[#e5e5e5] bg-white px-2.5 text-[13px] text-[#171717]">
      {label}
      <span className="tabular-nums text-ink-muted">{value}</span>
    </span>
  );
}

/** The current ref, in the same slot as a repository branch name. */
export function RepoRef({ label }: { label: string }) {
  return (
    <span
      data-ui="repo.ref"
      className="inline-flex h-[30px] max-w-full items-center truncate rounded-md border border-[#e5e5e5] bg-white px-2.5 font-mono text-[13px] text-[#171717]"
    >
      {label}
    </span>
  );
}

/**
 * Repository "Code" menu: download, copy the slug, or copy the client snippet.
 * The panel closes on Escape and on a click outside it.
 */
export function RepoCodeMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} data-ui="repo.code">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-[30px] items-center gap-1.5 rounded-md bg-[#171717] px-2.5 text-[13px] text-white hover:bg-neutral-800"
      >
        {label}
        <IconChevronDown width={14} height={14} />
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className="absolute top-full right-0 z-20 mt-1 w-[min(22rem,100%)] rounded-xl border border-[#ececec] bg-white p-3 shadow-[0_8px_22px_rgba(20,40,80,0.08)]"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function RepoCopyBlock({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-ink-muted">{label}</span>
        <CopyButton value={value} label={t('assets.doc.copy')} className="!h-7" />
      </div>
      <pre className="max-h-40 overflow-auto rounded-md bg-[#f5f5f5] px-2 py-1.5 font-mono text-[12px] leading-5 break-all whitespace-pre-wrap text-ink">
        {value}
      </pre>
    </div>
  );
}

/** Code tab: files, then the README, with About on the right. A blob hides the README. */
export function RepoHome({
  fileRef,
  codeMenu,
  fileOpen,
  files,
  readme,
  about,
}: {
  fileRef: ReactNode;
  codeMenu: ReactNode;
  fileOpen: boolean;
  files: ReactNode;
  readme: ReactNode;
  about: ReactNode;
}) {
  return (
    <div data-ui="repo.home" className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_296px]">
      <div className="min-w-0 space-y-3">
        <div className="relative flex min-w-0 flex-wrap items-center justify-between gap-2">
          {fileRef}
          {codeMenu}
        </div>
        {files}
        {fileOpen ? null : readme}
      </div>
      <div className="min-w-0 lg:sticky lg:top-3">{about}</div>
    </div>
  );
}

export function RepoAbout({
  description,
  homepage,
  topics,
  facts,
}: {
  description: string;
  homepage?: string | null;
  topics: string[];
  facts: { label: string; value: ReactNode }[];
}) {
  const { t } = useI18n();
  return (
    <aside
      data-ui="repo.about"
      aria-label={t('assets.repo.about')}
      className="min-w-0 space-y-3 overflow-hidden rounded-xl bg-surface p-4 shadow-[inset_0_0_0_1px_var(--color-hairline)]"
    >
      <h2 className="text-[16px] font-semibold text-ink">{t('assets.repo.about')}</h2>
      <p className="text-[14px] leading-5 break-words text-[#3f3f3f]">
        {description.trim() || t('assets.repo.noDescription')}
      </p>
      {homepage ? (
        <a
          href={homepage}
          target="_blank"
          rel="noreferrer"
          className="block min-w-0 truncate text-[13px] text-[color:var(--color-text-link)] hover:underline"
        >
          {homepage}
        </a>
      ) : null}
      {topics.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={t('assets.field.tags')}>
          {topics.map((topic) => (
            <li
              key={topic}
              className="rounded-md bg-[#f5f5f5] px-2 py-0.5 text-[12px] leading-5 text-[#3f3f3f]"
            >
              {topic}
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="space-y-1.5 border-t border-[color:var(--color-hairline)] pt-3">
        {facts.map((fact) => (
          <div key={fact.label} className="flex items-baseline justify-between gap-3 text-[13px]">
            <dt className="text-ink-muted">{fact.label}</dt>
            <dd className="min-w-0 truncate text-right text-ink">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

export function RepoReadme({
  name,
  children,
  onEdit,
  editLabel,
}: {
  name: string;
  children: ReactNode;
  onEdit?: () => void;
  editLabel?: string;
}) {
  return (
    <section
      data-ui="repo.readme"
      aria-label={name}
      className="overflow-hidden rounded-xl bg-surface shadow-[inset_0_0_0_1px_var(--color-hairline)]"
    >
      <header className="flex h-10 items-center justify-between gap-2 border-b border-[color:var(--color-hairline)] px-3">
        <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-ink">
          <IconFileText width={14} height={14} className="shrink-0 text-ink-faint" />
          <span className="truncate">{name}</span>
        </span>
        {onEdit && editLabel ? (
          <button
            type="button"
            onClick={onEdit}
            aria-label={editLabel}
            className="inline-flex size-7 items-center justify-center rounded-md text-ink-muted hover:bg-[#f5f5f5] hover:text-ink"
          >
            <IconEdit width={14} height={14} />
          </button>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/** Repository settings: General and the danger zone, with the same left rail GitHub uses. */
export function RepoSettings({ general, danger }: { general: ReactNode; danger: ReactNode }) {
  const { t } = useI18n();
  const [section, setSection] = useState<'general' | 'danger'>('general');
  const items = [
    { id: 'general' as const, label: t('assets.repo.settings.general') },
    { id: 'danger' as const, label: t('assets.danger.title') },
  ];
  return (
    <div data-ui="repo.settings" className="grid items-start gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
      <div role="tablist" aria-label={t('assets.tab.settings')} className="flex gap-1 lg:flex-col">
        {items.map((item) => {
          const selected = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setSection(item.id)}
              className={cn(
                'h-9 rounded-lg px-2.5 text-left text-[13px]',
                selected
                  ? 'bg-[#f2f3f5] font-medium text-[#171717]'
                  : 'text-[#3f3f3f] hover:bg-[#f7f7f7] hover:text-[#171717]',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{section === 'general' ? general : danger}</div>
    </div>
  );
}
