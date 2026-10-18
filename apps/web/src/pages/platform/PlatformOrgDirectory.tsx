import type { ReactNode } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Button, ConsoleEmptyState, PageLoading, useShowPageLoading } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import { clearUserSession } from '@/lib/userSession';
import { useAdminDirectory } from './adminDirectory';

/** 管理后台的用户、职位、角色。数据来自控制台身份组织，不是用户中心的团队成员。 */
export function PlatformOrgDirectory({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const directory = useAdminDirectory();

  const firstLoad = useShowPageLoading(directory.status === 'loading');
  if (directory.status === 'loading' && (firstLoad || !directory.orgId)) {
    return firstLoad ? <PageLoading variant="contain" /> : null;
  }

  if (directory.status === 'ready' && !directory.canRead) {
    return (
      <ConsoleEmptyState title={t('org.nav.group.enterprise')} description={t('directory.error.forbidden')} />
    );
  }

  if (directory.status === 'error' || !directory.orgId) {
    const auth = directory.error === 'auth';
    return (
      <ConsoleEmptyState
        title={t('org.nav.group.enterprise')}
        description={t(auth ? 'org.directory.loginRequired' : 'org.error.generic')}
        action={
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (auth) {
                clearUserSession();
                navigate('/admin/login');
                return;
              }
              directory.retry();
            }}
          >
            {t(auth ? 'org.directory.loginAction' : 'table.refresh')}
          </Button>
        }
      />
    );
  }

  return children ?? <Outlet />;
}
