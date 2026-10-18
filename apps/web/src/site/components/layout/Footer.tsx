import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { Logo } from '@a3s-lab/ui';

const OPEN_SOURCE_URL = 'https://github.com/kense-labs';

type FooterLink =
  | { label: string; to: string }
  | { label: string; href: string; external: true };

type FooterProps = {
  /** Content only — parent provides the shell. */
  bare?: boolean;
  /** Tighter spacing when embedded in a closing snap panel. */
  compact?: boolean;
};

export function Footer({ bare = false, compact = false }: FooterProps) {
  const { t } = useI18n();

  const columns: Array<{ title: string; links: FooterLink[] }> = [
    {
      title: t.footer.product,
      links: [
        { label: t.footer.links.work, to: '/#work' },
        { label: t.footer.links.cloud, to: '/#os' },
        { label: t.footer.links.orgCenter, to: '/' },
      ],
    },
    {
      title: t.footer.resources,
      links: [
        { label: t.footer.links.adminConsole, to: '/admin/login' },
        { label: t.footer.links.apiDocs, to: '/docs' },
        {
          label: t.footer.links.openSource,
          href: OPEN_SOURCE_URL,
          external: true,
        },
      ],
    },
  ];

  const body = (
    <div
      className={`container-site footer-inner ${
        compact ? 'pt-20 pb-16 lg:pt-28 lg:pb-20' : 'py-16 lg:py-20'
      }`}
    >
      <div
        className={`grid gap-10 lg:grid-cols-[1.2fr_2fr] ${
          compact ? 'lg:gap-10' : 'lg:gap-12'
        }`}
      >
        <div>
          <Logo layout="vertical" size={compact ? 56 : 72} tone="dark" />
          <p
            className={`mt-3 max-w-xs text-sm leading-6 text-ink-muted ${
              compact ? 'line-clamp-2' : ''
            }`}
          >
            {t.footer.tagline}
          </p>
        </div>
        <div className="footer-columns">
          {columns.map((col) => (
            <div key={col.title} className="footer-col">
              <h3 className="text-sm font-medium text-white">{col.title}</h3>
              <ul
                className={`mt-3 space-y-2.5 ${
                  compact ? 'space-y-2' : 'sm:mt-4 sm:space-y-3'
                }`}
              >
                {col.links.map((link) => (
                  <li key={link.label}>
                    {'external' in link ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="footer-link"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link to={link.to} className="footer-link">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div
        className={`flex items-center justify-between border-t border-white/8 text-sm text-ink-faint ${
          compact ? 'mt-10 pt-5' : 'mt-14 pt-8'
        }`}
      >
        <p>{t.footer.copyright}</p>
      </div>
    </div>
  );

  if (bare) {
    return <div className="bg-bg">{body}</div>;
  }

  return <footer className="bg-bg">{body}</footer>;
}
