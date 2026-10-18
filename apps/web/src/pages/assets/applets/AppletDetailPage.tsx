import { useLocation, useParams } from 'react-router-dom';
import { AdminPageShell } from '@/components/AdminPageShell';
import { useI18n } from '@/i18n/useI18n';
import { getPlugin } from '@/lib/pluginHubApi';
import { AssetDetailStatus } from '@/pages/assets/shared/AssetHub';
import { useAssetQuery } from '@/pages/assets/shared/useAssetQuery';
import { PluginDetail } from '@/pages/assets/plugins/PluginDetailPage';
import { APPLETS_PATH } from './AppletHubPage';

export function AppletDetailPage() {
  const { publisher = '', name = '' } = useParams();
  const { search } = useLocation();
  const { t } = useI18n();
  const detail = useAssetQuery(`${publisher}/${name}`, () => getPlugin(publisher, name));
  const backTo = `${APPLETS_PATH}${search}`;
  if (!detail.data) {
    return (
      <AdminPageShell title={name || publisher} backTo={backTo}>
        <AssetDetailStatus
          loading={detail.loading}
          missing={detail.missing}
          error={detail.error}
          onRetry={detail.reload}
        />
      </AdminPageShell>
    );
  }
  return (
    <PluginDetail
      plugin={detail.data}
      onChange={detail.setData}
      backTo={backTo}
      sectionLabel={t('assets.applets.title')}
      heading={detail.data.title}
      dangerDescription={t('assets.applets.danger.desc')}
      dialogLabels={{
        create: t('assets.applets.create'),
        edit: t('assets.applets.edit'),
        description: t('assets.applets.createDesc'),
      }}
    />
  );
}
