import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import {
  OS_DESTINATIONS,
  domainForDestination,
  groupForDomain,
  type OsDestinationId,
} from './destinations';
import { OsIcon } from './icons';

type SidebarProps = {
  activeId: OsDestinationId;
  collapsed: boolean;
};

export function Sidebar({ activeId, collapsed }: SidebarProps) {
  const { t } = useI18n();
  const navRef = useRef<HTMLElement>(null);
  const domainId = domainForDestination(activeId);
  const group = groupForDomain(domainId);

  useEffect(() => {
    if (collapsed) return;
    const current = navRef.current?.querySelector<HTMLElement>(
      '.os-sidebar__nav-item.is-current',
    );
    current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeId, collapsed, domainId]);

  return (
    <aside
      id="os-sidebar"
      className="os-sidebar"
      aria-label={t('shell.sideNav')}
      aria-hidden={collapsed}
      inert={collapsed ? true : undefined}
    >
      <div className="os-sidebar__domain">
        <h2 className="os-sidebar__domain-title">
          {group.labelKey ? t(group.labelKey) : t('nav.overview')}
        </h2>
      </div>

      <nav
        ref={navRef}
        className="os-sidebar__nav"
        data-domain={domainId}
        aria-label={group.labelKey ? t(group.labelKey) : t('nav.overview')}
      >
        {group.sections.map((section, index) => {
          const sectionLabel = section.labelKey
            ? t(section.labelKey)
            : undefined;
          const focused = section.items.includes(activeId);
          return (
            <div
              key={section.labelKey ?? `section-${index}`}
              className={cn(
                'os-sidebar__nav-group',
                focused && 'is-focused',
              )}
            >
              {sectionLabel ? (
                <p className="os-sidebar__nav-label">{sectionLabel}</p>
              ) : null}
              <div className="os-sidebar__nav-items">
                {section.items.map((id) => {
                  const item = OS_DESTINATIONS[id];
                  const current = activeId === id;
                  return (
                    <NavLink
                      key={id}
                      to={item.to}
                      end={item.end}
                      tabIndex={collapsed ? -1 : undefined}
                      aria-current={current ? 'page' : undefined}
                      title={t(item.labelKey)}
                      className={cn(
                        'os-sidebar__nav-item',
                        current && 'is-current',
                      )}
                    >
                      <span className="os-sidebar__nav-icon">
                        <OsIcon name={item.icon} />
                      </span>
                      <span className="os-sidebar__nav-text">
                        {t(item.labelKey)}
                      </span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
