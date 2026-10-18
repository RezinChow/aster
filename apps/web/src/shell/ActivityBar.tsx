import { useNavigate } from 'react-router-dom';
import { cn } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import {
  OS_ACTIVITY_DOMAINS,
  OS_DESTINATIONS,
  domainForDestination,
  type OsDestinationId,
  type OsDomainId,
} from './destinations';
import { BrandMark, useBrandName } from './BrandMark';
import { OsIcon } from './icons';
import { NotificationCenter } from './NotificationCenter';
import { Tooltip } from './Tooltip';
import { UserMenu } from './UserMenu';

type ActivityBarProps = {
  activeId: OsDestinationId;
  onEnsureSidebarOpen: () => void;
};

export function ActivityBar({
  activeId,
  onEnsureSidebarOpen,
}: ActivityBarProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const brandName = useBrandName();
  const activeDomain = domainForDestination(activeId);

  function selectDomain(
    domainId: OsDomainId,
    defaultDestinationId: OsDestinationId,
  ) {
    onEnsureSidebarOpen();
    if (domainForDestination(activeId) === domainId) return;
    navigate(OS_DESTINATIONS[defaultDestinationId].to);
  }

  return (
    <aside className="os-activity-bar" aria-label={t('shell.activityBar')}>
      <Tooltip label={brandName}>
        <button
          type="button"
          className="os-activity-bar__home"
          aria-label={brandName}
          onClick={() => selectDomain('overview', 'overview')}
        >
          <BrandMark size={26} alt="" />
        </button>
      </Tooltip>

      <nav className="os-activity-bar__items" aria-label={t('shell.domainNav')}>
        {OS_ACTIVITY_DOMAINS.map((domain) => {
          const current = activeDomain === domain.id;
          const label = t(domain.labelKey);
          return (
            <Tooltip key={domain.id} label={label}>
              <button
                type="button"
                aria-label={label}
                aria-current={current ? 'true' : undefined}
                className={cn(
                  'os-activity-bar__item',
                  current && 'is-current',
                )}
                onClick={() =>
                  selectDomain(domain.id, domain.defaultDestinationId)
                }
              >
                <OsIcon name={domain.icon} size={22} strokeWidth={1.6} />
              </button>
            </Tooltip>
          );
        })}
      </nav>

      <div className="os-activity-bar__footer">
        <NotificationCenter />
        <UserMenu compact />
      </div>
    </aside>
  );
}
