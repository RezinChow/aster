import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n/useI18n';
import {
  OS_ACTIVITY_DOMAINS,
  OS_DESTINATIONS,
  type OsDestination,
} from './destinations';

export function ShellBreadcrumb({
  destination,
  domainId,
}: {
  destination: OsDestination;
  domainId: string;
}) {
  const { t } = useI18n();
  const domain = OS_ACTIVITY_DOMAINS.find((item) => item.id === domainId);
  if (!domain) return null;

  const domainHome = OS_DESTINATIONS[domain.defaultDestinationId];
  const isDomainHome = destination.id === domain.defaultDestinationId;

  return (
    <nav className="os-breadcrumb" aria-label={t('shell.breadcrumb')}>
      <ol className="os-breadcrumb__list">
        <li className="os-breadcrumb__item">
          {isDomainHome ? (
            <span className="os-breadcrumb__current" aria-current="page">
              {t(domain.labelKey)}
            </span>
          ) : (
            <Link to={domainHome.to} className="os-breadcrumb__link">
              {t(domain.labelKey)}
            </Link>
          )}
        </li>
        {!isDomainHome ? (
          <li className="os-breadcrumb__item">
            <span className="os-breadcrumb__sep" aria-hidden>
              /
            </span>
            <span className="os-breadcrumb__current" aria-current="page">
              {t(destination.labelKey)}
            </span>
          </li>
        ) : null}
      </ol>
    </nav>
  );
}
