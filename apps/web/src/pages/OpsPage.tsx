import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { OpsTopologyMap } from '@/components/OpsTopologyMap';
import { useI18n } from '@/i18n/useI18n';
import { useCloudScopeContext } from '@/shell/CloudScopeContext';
import { loadOpsSpineSnapshot, type OpsSpineSnapshot } from '@/data/opsSpine';
import {
  loadOpsDomainsSnapshot,
  type OpsDomainsSnapshot,
} from '@/data/opsDomains';
import { buildOpsTopology } from '@/data/opsTopology';

const REFRESH_MS = 15_000;

export function OpsPage() {
  const { t } = useI18n();
  const scope = useCloudScopeContext();
  const [spine, setSpine] = useState<OpsSpineSnapshot | null>(null);
  const [domains, setDomains] = useState<OpsDomainsSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const scopeArg =
        scope.projectId && scope.envId
          ? { projectId: scope.projectId, envId: scope.envId }
          : null;
      const [s, d] = await Promise.all([
        loadOpsSpineSnapshot(),
        loadOpsDomainsSnapshot(scopeArg),
      ]);
      setSpine(s);
      setDomains(d);
    } finally {
      setBusy(false);
    }
  }, [scope.envId, scope.projectId]);

  useEffect(() => {
    void reload();
    const id = window.setInterval(() => void reload(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [reload]);

  const topo = useMemo(
    () => buildOpsTopology(spine, domains),
    [spine, domains],
  );

  return (
    <AdminPageShell
      title={t('ops.title')}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {spine?.at ? (
            <span className="text-xs text-ink-faint">
              {t('ops.lastRefresh')}: {spine.at.slice(0, 19).replace('T', ' ')}
            </span>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void reload()}
          >
            {busy ? t('ops.refreshing') : t('ops.refresh')}
          </Button>
        </div>
      }
    >
      <OpsTopologyMap topo={topo} usage={spine?.usage ?? []} />
    </AdminPageShell>
  );
}
