import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PageLoading, useRoutePageLoading } from '@a3s-lab/ui';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { ensureUserSession, meUser } from '@/lib/identityApi';
import { clearUserSession } from '@/lib/userSession';
import { useAdminDirectory } from '@/pages/platform/adminDirectory';
import {
  domainForDestination,
  isOrgDirectoryDestination,
  isSecondaryShellPath,
  matchDestination,
} from './destinations';
import { ActivityBar } from './ActivityBar';
import {
  CloudScopeProvider,
  useCloudScopeContext,
} from './CloudScopeContext';
import {
  classifyCloudScopeError,
  type CloudScopeErrorKind,
} from './cloudScopeError';
import { KeepAliveOutlet } from './KeepAliveOutlet';
import { ScopeSwitcher } from './ScopeSwitcher';
import { ScrollToTopFab } from './ScrollToTopFab';
import { ShellBreadcrumb } from './ShellBreadcrumb';
import { Sidebar } from './Sidebar';
import { SidebarToggle } from './SidebarToggle';

const SIDEBAR_KEY = 'kense.os.sidebarCollapsed';

const CLOUD_ERROR_COPY: Record<
  CloudScopeErrorKind,
  { title: MessageKey; body: MessageKey }
> = {
  unreachable: {
    title: 'shell.cloudError.unreachable.title',
    body: 'shell.cloudError.unreachable.body',
  },
  unauthorized: {
    title: 'shell.cloudError.unauthorized.title',
    body: 'shell.cloudError.unauthorized.body',
  },
  timeout: {
    title: 'shell.cloudError.timeout.title',
    body: 'shell.cloudError.timeout.body',
  },
  unknown: {
    title: 'shell.cloudError.unknown.title',
    body: 'shell.cloudError.unknown.body',
  },
};

function OrgDirectoryContext({
  destination,
}: {
  destination: ReturnType<typeof matchDestination>;
}) {
  const { t } = useI18n();
  const directory = useAdminDirectory();
  const label = directory.orgName || t('nav.group.platform');

  return (
    <div className="os-shell-context-stack">
      <div className="os-shell-context">
        <div className="os-shell-context__trail">
          <nav className="os-breadcrumb" aria-label={t('shell.breadcrumb')}>
            <ol className="os-breadcrumb__list">
              <li className="os-breadcrumb__item">
                <Link
                  to="/admin/team/members"
                  className="os-breadcrumb__link"
                >
                  {label}
                </Link>
              </li>
              <li className="os-breadcrumb__item">
                <span className="os-breadcrumb__sep" aria-hidden>
                  /
                </span>
                <span className="os-breadcrumb__current" aria-current="page">
                  {t(destination.labelKey)}
                </span>
              </li>
            </ol>
          </nav>
        </div>
      </div>
    </div>
  );
}

function ShellContextBar({
  destination,
  activeDomain,
}: {
  destination: ReturnType<typeof matchDestination>;
  activeDomain: ReturnType<typeof domainForDestination>;
}) {
  const { t } = useI18n();
  const location = useLocation();
  const scope = useCloudScopeContext();
  const errorKind = scope.cloudError
    ? classifyCloudScopeError(scope.cloudError)
    : null;
  const copy = errorKind ? CLOUD_ERROR_COPY[errorKind] : null;
  // Settings pages are cloud-scope independent: a control-plane outage
  // must not blanket banners over configuration surfaces.
  const cloudDependent = !location.pathname.startsWith('/admin/settings');

  return (
    <div className="os-shell-context-stack">
      <div className="os-shell-context">
        <ShellBreadcrumb destination={destination} domainId={activeDomain} />
        {(scope.canSwitchOrgs || (scope.cloudError && cloudDependent)) && (
          <div className="os-shell-context__scope">
            <ScopeSwitcher
              orgId={scope.orgId}
              orgOptions={scope.orgOptions}
              onOrgChange={scope.setOrgId}
              canSwitchOrgs={scope.canSwitchOrgs}
            />
          </div>
        )}
      </div>
      {scope.cloudError && copy && cloudDependent ? (
        <div className="os-shell-context__error">
          <AppErrorBanner
            title={t(copy.title)}
            message={t(copy.body)}
            onRetry={scope.reloadCloudScope}
          />
          <details className="os-shell-context__error-detail">
            <summary>{t('shell.cloudError.detail')}</summary>
            <pre className="os-shell-context__error-raw">{scope.cloudError}</pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const destination = matchDestination(location.pathname);
  const activeDomain = domainForDestination(destination.id);
  const secondaryRoute = isSecondaryShellPath(location.pathname);
  const contentRef = useRef<HTMLDivElement>(null);
  const routeLoadingKey = useRoutePageLoading(location.pathname);
  const [sessionReady, setSessionReady] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_KEY) === '1';
  });

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);

  useEffect(() => {
    let cancelled = false;
    ensureUserSession()
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setSessionReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    let cancelled = false;
    void meUser()
      .then((me) => {
        if (cancelled || me.homeOrgIsOfficial) return;
        clearUserSession();
        window.location.assign('/admin/login');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sessionReady]);

  const navigationMode = sidebarCollapsed ? 'rail' : 'split';

  return (
    <div
      className="os-application-page"
      data-sidebar-collapsed={sidebarCollapsed ? 'true' : undefined}
      data-navigation-mode={navigationMode}
      data-domain={activeDomain}
    >
      <PageLoading variant="global" />
      <CloudScopeProvider sessionReady={sessionReady}>
        <div
          className="os-application"
          data-sidebar-collapsed={sidebarCollapsed ? 'true' : undefined}
          data-navigation-mode={navigationMode}
          data-domain={activeDomain}
        >
          <ActivityBar
            activeId={destination.id}
            onEnsureSidebarOpen={() => setSidebarCollapsed(false)}
          />
          <div className="os-application__frame">
            <Sidebar activeId={destination.id} collapsed={sidebarCollapsed} />
            <div className="os-application__main">
              <div
                className={
                  secondaryRoute
                    ? 'os-application__content os-application__content--canvas os-application__content--scroll'
                    : 'os-application__content'
                }
                ref={contentRef}
              >
                {routeLoadingKey && routeLoadingKey === location.pathname ? (
                  <PageLoading key={routeLoadingKey} variant="contain" />
                ) : null}
                {secondaryRoute ? null : isOrgDirectoryDestination(destination.id) ? (
                  <OrgDirectoryContext destination={destination} />
                ) : sessionReady ? (
                  <ShellContextBar
                    destination={destination}
                    activeDomain={activeDomain}
                  />
                ) : (
                  <div className="os-shell-context">
                    <ShellBreadcrumb
                      destination={destination}
                      domainId={activeDomain}
                    />
                  </div>
                )}
                {sessionReady ? (
                  <KeepAliveOutlet scrollParentRef={contentRef} maxEntries={10} />
                ) : null}
              </div>
              <ScrollToTopFab scrollRef={contentRef} />
            </div>
          </div>
          <div className="os-sidebar-toggle-layer">
            <SidebarToggle
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed((v) => !v)}
            />
          </div>
        </div>
      </CloudScopeProvider>
    </div>
  );
}
