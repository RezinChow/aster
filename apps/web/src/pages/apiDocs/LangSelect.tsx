import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import { CODE_LANGS, type CodeLang } from './codegen';

export function LangSelect({
  value,
  onChange,
  label,
}: {
  value: CodeLang;
  onChange: (lang: CodeLang) => void;
  label: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const current = CODE_LANGS.find((l) => l.id === value) ?? CODE_LANGS[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CODE_LANGS;
    return CODE_LANGS.filter(
      (lang) =>
        lang.label.toLowerCase().includes(q) ||
        lang.id.toLowerCase().includes(q) ||
        lang.highlight.toLowerCase().includes(q),
    );
  }, [query]);

  function updatePosition() {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuWidth = 12.5 * 16;
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8,
    );
    setMenuPos({ top: rect.bottom + 6, left });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const id = window.requestAnimationFrame(() => searchRef.current?.focus());
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(id);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="api-lang" ref={rootRef}>
      <button
        type="button"
        className="api-lang__trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <LangIcon lang={current.id} />
        <span>{current.label}</span>
        <Chevron open={open} />
      </button>
      {open && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              className="api-lang__menu"
              style={{ top: menuPos.top, left: menuPos.left }}
              role="presentation"
            >
              <div className="api-lang__search">
                <SearchIcon />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('apiDocs.searchLanguage')}
                  aria-label={t('apiDocs.searchLanguage')}
                />
              </div>
              <ul id={listId} className="api-lang__list" role="listbox" aria-label={label}>
                {filtered.map((lang) => (
                  <li key={lang.id} role="option" aria-selected={lang.id === value}>
                    <button
                      type="button"
                      className={cn(
                        'api-lang__option',
                        lang.id === value && 'is-active',
                      )}
                      onClick={() => {
                        onChange(lang.id);
                        setOpen(false);
                      }}
                    >
                      <LangIcon lang={lang.id} />
                      <span>{lang.label}</span>
                      {lang.id === value ? <CheckIcon /> : null}
                    </button>
                  </li>
                ))}
                {!filtered.length ? (
                  <li className="api-lang__empty">{t('apiDocs.noMatches')}</li>
                ) : null}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      aria-hidden
      className={cn('api-lang__chevron', open && 'is-open')}
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="m6 9 6 6 6-6"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="api-lang__check"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
      <circle
        cx="11"
        cy="11"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="m20 20-3.2-3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LangIcon({ lang }: { lang: CodeLang }) {
  switch (lang) {
    case 'curl':
      return (
        <span className="api-lang__icon api-lang__icon--curl" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24">
            <rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            />
            <path
              d="M7 10h3M7 14h6"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </span>
      );
    case 'python':
      return (
        <span className="api-lang__icon api-lang__icon--python" aria-hidden>
          Py
        </span>
      );
    case 'javascript':
      return (
        <span className="api-lang__icon api-lang__icon--js" aria-hidden>
          JS
        </span>
      );
    case 'php':
      return (
        <span className="api-lang__icon api-lang__icon--php" aria-hidden>
          php
        </span>
      );
    case 'go':
      return (
        <span className="api-lang__icon api-lang__icon--go" aria-hidden>
          Go
        </span>
      );
    case 'java':
      return (
        <span className="api-lang__icon api-lang__icon--java" aria-hidden>
          Ja
        </span>
      );
    case 'ruby':
      return (
        <span className="api-lang__icon api-lang__icon--ruby" aria-hidden>
          Rb
        </span>
      );
    case 'csharp':
      return (
        <span className="api-lang__icon api-lang__icon--csharp" aria-hidden>
          C#
        </span>
      );
    case 'rust':
      return (
        <span className="api-lang__icon api-lang__icon--rust" aria-hidden>
          Rs
        </span>
      );
  }
}
