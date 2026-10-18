import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  ConsoleDrawer,
  ConsoleEmptyState,
  ConsoleFormField,
  Input,
  ListToolbar,
  Tabs,
  TabsList,
  TabsTrigger,
  ConsoleTextarea,
  useToast,
  type BadgeTone,
} from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { AdminPageShell } from '@/components/AdminPageShell';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import { ListRowAction, ListRowActions } from '@/components/ListRowActions';
import {
  deployCloudDurableCell,
  getCloudDurableCell,
  listCloudDurableCellRevisions,
  listCloudDurableCells,
  publishCloudDurableCellRoute,
  reviseCloudDurableCell,
  startCloudDurableCell,
  stopCloudDurableCell,
  type CloudDurableCell,
  type CloudDurableCellDetail,
  type CloudDurableCellRevision,
} from '@/lib/cloudApi';
import { useCloudScopeContext } from '@/shell/CloudScopeContext';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';

type StateFilter = 'all' | 'running' | 'stopped';

const STATES: { id: StateFilter; label: MessageKey }[] = [
  { id: 'all', label: 'cells.state.all' },
  { id: 'running', label: 'cells.state.running' },
  { id: 'stopped', label: 'cells.state.stopped' },
];

function Dash() {
  return <span className="text-ink-faint">—</span>;
}

function stamp(value: string): string {
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : value;
}

function stateTone(state: string): BadgeTone {
  if (state === 'running') return 'success';
  if (state === 'stopped') return 'neutral';
  return 'neutral';
}

function stateText(state: string, t: (key: MessageKey) => string): string {
  if (state === 'running') return t('cells.state.running');
  if (state === 'stopped') return t('cells.state.stopped');
  return state || '—';
}

export function CellsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const scope = useCloudScopeContext();
  const [q, setQ] = useState('');
  const [state, setState] = useState<StateFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rowsAll, setRowsAll] = useState<CloudDurableCell[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CloudDurableCellDetail | null>(null);
  const [revisions, setRevisions] = useState<CloudDurableCellRevision[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reviseAcl, setReviseAcl] = useState('');
  const [revising, setRevising] = useState(false);
  const [serviceProfileAcl, setServiceProfileAcl] = useState('');
  const [providerWorkloadAcl, setProviderWorkloadAcl] = useState('');
  const [storageBindingAcl, setStorageBindingAcl] = useState('');
  const [storageProviderProfileAcl, setStorageProviderProfileAcl] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [gatewayScopeId, setGatewayScopeId] = useState('');
  const [domainClaimId, setDomainClaimId] = useState('');
  const [hostname, setHostname] = useState('');
  const [pathPrefix, setPathPrefix] = useState('/');
  const [routeServiceProfileAcl, setRouteServiceProfileAcl] = useState('');
  const [publishingRoute, setPublishingRoute] = useState(false);

  const scopeReady = Boolean(scope.projectId && scope.envId);

  const reload = useCallback(async () => {
    if (!scope.projectId || !scope.envId) {
      setRowsAll([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRowsAll(await listCloudDurableCells(scope.projectId, scope.envId));
      setLoadError(null);
    } catch (error: unknown) {
      setRowsAll([]);
      setLoadError(error instanceof Error ? error.message : t('admin.error.title'));
    } finally {
      setLoading(false);
    }
  }, [scope.envId, scope.projectId, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadDetail = useCallback(
    async (applicationId: string) => {
      if (!scope.projectId || !scope.envId) return;
      setDetailLoading(true);
      setDetailError(null);
      try {
        const [nextDetail, nextRevisions] = await Promise.all([
          getCloudDurableCell({
            applicationId,
            projectId: scope.projectId,
            environmentId: scope.envId,
          }),
          listCloudDurableCellRevisions({
            applicationId,
            projectId: scope.projectId,
            environmentId: scope.envId,
          }),
        ]);
        setDetail(nextDetail);
        setRevisions(nextRevisions);
        setReviseAcl(nextDetail.revision.definitionAcl);
      } catch (error: unknown) {
        setDetail(null);
        setRevisions([]);
        setDetailError(error instanceof Error ? error.message : t('admin.error.title'));
      } finally {
        setDetailLoading(false);
      }
    },
    [scope.envId, scope.projectId, t],
  );

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setRevisions([]);
      setDetailError(null);
      setReviseAcl('');
      return;
    }
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  const upsertRow = useCallback((updated: CloudDurableCell) => {
    setRowsAll((prev) => {
      const index = prev.findIndex((item) => item.applicationId === updated.applicationId);
      if (index < 0) return [updated, ...prev];
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }, []);

  const setDesiredState = useCallback(
    async (row: CloudDurableCell, next: 'running' | 'stopped') => {
      if (!scope.projectId || !scope.envId) return;
      if (row.aggregateVersion == null) {
        toast.push({ title: t('cells.toast.versionMissing'), tone: 'danger' });
        return;
      }
      setBusyId(row.applicationId);
      try {
        const updated =
          next === 'running'
            ? await startCloudDurableCell({
                applicationId: row.applicationId,
                projectId: scope.projectId,
                environmentId: scope.envId,
                expectedVersion: row.aggregateVersion,
              })
            : await stopCloudDurableCell({
                applicationId: row.applicationId,
                projectId: scope.projectId,
                environmentId: scope.envId,
                expectedVersion: row.aggregateVersion,
              });
        upsertRow(updated);
        if (detail?.application.applicationId === updated.applicationId) {
          setDetail((prev) =>
            prev ? { ...prev, application: updated } : prev,
          );
        }
        toast.push({
          title:
            next === 'running'
              ? t('cells.toast.started')
              : t('cells.toast.stopped'),
          tone: 'success',
        });
      } catch (error: unknown) {
        toast.push({
          title: error instanceof Error ? error.message : t('cells.toast.stateFailed'),
          tone: 'danger',
        });
        await reload();
      } finally {
        setBusyId(null);
      }
    },
    [detail?.application.applicationId, reload, scope.envId, scope.projectId, t, toast, upsertRow],
  );

  const submitRevise = useCallback(async () => {
    if (!scope.projectId || !scope.envId || !detail) return;
    const definitionAcl = reviseAcl.trim();
    if (!definitionAcl) {
      toast.push({ title: t('cells.toast.reviseInvalid'), tone: 'danger' });
      return;
    }
    if (detail.application.aggregateVersion == null) {
      toast.push({ title: t('cells.toast.versionMissing'), tone: 'danger' });
      return;
    }
    setRevising(true);
    try {
      const updated = await reviseCloudDurableCell({
        applicationId: detail.application.applicationId,
        projectId: scope.projectId,
        environmentId: scope.envId,
        expectedVersion: detail.application.aggregateVersion,
        definitionAcl,
      });
      upsertRow(updated);
      await loadDetail(updated.applicationId);
      toast.push({ title: t('cells.toast.revised'), tone: 'success' });
    } catch (error: unknown) {
      toast.push({
        title: error instanceof Error ? error.message : t('cells.toast.reviseFailed'),
        tone: 'danger',
      });
    } finally {
      setRevising(false);
    }
  }, [detail, loadDetail, reviseAcl, scope.envId, scope.projectId, t, toast, upsertRow]);

  const submitDeploy = useCallback(async () => {
    if (!scope.projectId || !scope.envId || !detail) return;
    const service = serviceProfileAcl.trim();
    const workload = providerWorkloadAcl.trim();
    const storage = storageBindingAcl.trim();
    if (!service || !workload || !storage) {
      toast.push({ title: t('cells.toast.deployInvalid'), tone: 'danger' });
      return;
    }
    setDeploying(true);
    try {
      await deployCloudDurableCell({
        applicationId: detail.application.applicationId,
        revisionId: detail.application.currentRevisionId,
        projectId: scope.projectId,
        environmentId: scope.envId,
        serviceProfileAcl: service,
        storageProviderProfileAcl: storageProviderProfileAcl.trim() || undefined,
        providerWorkloadAcl: workload,
        storageBindingAcl: storage,
      });
      toast.push({ title: t('cells.toast.deployed'), tone: 'success' });
    } catch (error: unknown) {
      toast.push({
        title: error instanceof Error ? error.message : t('cells.toast.deployFailed'),
        tone: 'danger',
      });
    } finally {
      setDeploying(false);
    }
  }, [
    detail,
    providerWorkloadAcl,
    scope.envId,
    scope.projectId,
    serviceProfileAcl,
    storageBindingAcl,
    storageProviderProfileAcl,
    t,
    toast,
  ]);

  const submitPublishRoute = useCallback(async () => {
    if (!scope.projectId || !scope.envId || !detail) return;
    const service = routeServiceProfileAcl.trim();
    const scopeId = gatewayScopeId.trim();
    const claimId = domainClaimId.trim();
    const host = hostname.trim();
    const path = pathPrefix.trim();
    if (!service || !scopeId || !claimId || !host || !path) {
      toast.push({ title: t('cells.toast.routeInvalid'), tone: 'danger' });
      return;
    }
    setPublishingRoute(true);
    try {
      await publishCloudDurableCellRoute({
        applicationId: detail.application.applicationId,
        revisionId: detail.application.currentRevisionId,
        projectId: scope.projectId,
        environmentId: scope.envId,
        serviceProfileAcl: service,
        gatewayScopeId: scopeId,
        domainClaimId: claimId,
        hostname: host,
        pathPrefix: path,
      });
      toast.push({ title: t('cells.toast.routePublished'), tone: 'success' });
    } catch (error: unknown) {
      toast.push({
        title: error instanceof Error ? error.message : t('cells.toast.routeFailed'),
        tone: 'danger',
      });
    } finally {
      setPublishingRoute(false);
    }
  }, [
    detail,
    domainClaimId,
    gatewayScopeId,
    hostname,
    pathPrefix,
    routeServiceProfileAcl,
    scope.envId,
    scope.projectId,
    t,
    toast,
  ]);

  const counts = useMemo(
    () => ({
      all: rowsAll.length,
      running: rowsAll.filter((row) => row.desiredState === 'running').length,
      stopped: rowsAll.filter((row) => row.desiredState === 'stopped').length,
    }),
    [rowsAll],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rowsAll.filter((row) => {
      if (state !== 'all' && row.desiredState !== state) return false;
      if (!needle) return true;
      return (
        row.name.toLowerCase().includes(needle) ||
        row.applicationId.toLowerCase().includes(needle)
      );
    });
  }, [q, rowsAll, state]);

  const filtersActive = q.trim() !== '' || state !== 'all';

  return (
    <AdminPageShell title={t('nav.cells')} description={t('nav.cellsDesc')}>
      {loadError ? (
        <AppErrorBanner className="mb-3" message={loadError} onRetry={() => void reload()} />
      ) : null}
      <ListToolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t('cells.search')}
      />
      <Tabs
        value={state}
        onValueChange={(value) => {
          if (!isState(value)) return;
          setState(value);
          setExpandedId(null);
        }}
        className="gap-0"
      >
        <TabsList className="os-queue-tabs" aria-label={t('cells.queue')}>
          {STATES.map((item) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              className="os-queue-tab !h-auto !rounded-none !bg-transparent !px-3.5 !py-2.5 !shadow-none"
            >
              {t(item.label)}
              <span className="os-queue-tab__count tabular-nums">{counts[item.id]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {!scopeReady ? (
        <ConsoleEmptyState title={t('cells.needScope')} description={t('nav.cellsDesc')} />
      ) : (
        <I18nDataTable
          rows={rows}
          rowKey={(row) => row.applicationId}
          loading={loading && rowsAll.length === 0}
          onRefresh={reload}
          onRowClick={(row) => setSelectedId(row.applicationId)}
          defaultPagination={{ page: 1, pageSize: 10 }}
          pageSizeOptions={[10, 20, 50]}
          expandedRowKey={expandedId}
          onExpandedRowChange={setExpandedId}
          renderExpanded={(row) => (
            <dl className="os-work-expand">
              <div>
                <dt>{t('cells.col.name')}</dt>
                <dd className="font-mono text-xs">{row.applicationId}</dd>
              </div>
              <div>
                <dt>{t('cells.expand.revisionId')}</dt>
                <dd className="font-mono text-xs">
                  {row.currentRevisionId || <Dash />}
                </dd>
              </div>
              <div>
                <dt>{t('cells.expand.digest')}</dt>
                <dd className="break-all font-mono text-xs">
                  {row.currentDefinitionDigest || <Dash />}
                </dd>
              </div>
              <div>
                <dt>{t('cells.expand.version')}</dt>
                <dd className="tabular-nums">
                  {row.aggregateVersion == null ? <Dash /> : row.aggregateVersion}
                </dd>
              </div>
              <div>
                <dt>{t('cells.col.state')}</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  {row.desiredState === 'stopped' ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyId === row.applicationId}
                      onClick={() => void setDesiredState(row, 'running')}
                    >
                      {t('cells.action.start')}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === row.applicationId}
                      onClick={() => void setDesiredState(row, 'stopped')}
                    >
                      {t('cells.action.stop')}
                    </Button>
                  )}
                </dd>
              </div>
            </dl>
          )}
          columns={[
            {
              id: 'name',
              header: t('cells.col.name'),
              sortable: true,
              getSortValue: (row) => row.name,
              cell: (row) => (
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink">{row.name || <Dash />}</div>
                  <div className="font-mono text-[11px] text-ink-faint">{row.applicationId}</div>
                </div>
              ),
            },
            {
              id: 'state',
              header: t('cells.col.state'),
              cell: (row) =>
                row.desiredState ? (
                  <Badge tone={stateTone(row.desiredState)}>
                    {stateText(row.desiredState, t)}
                  </Badge>
                ) : (
                  <Dash />
                ),
            },
            {
              id: 'revision',
              header: t('cells.col.revision'),
              sortable: true,
              getSortValue: (row) => row.currentRevisionNumber ?? -1,
              cell: (row) =>
                row.currentRevisionNumber == null ? (
                  <Dash />
                ) : (
                  <span className="tabular-nums text-sm">{row.currentRevisionNumber}</span>
                ),
            },
            {
              id: 'updated',
              header: t('cells.col.updated'),
              sortable: true,
              getSortValue: (row) => row.updatedAt,
              cell: (row) =>
                row.updatedAt ? (
                  <span className="tabular-nums text-sm">{stamp(row.updatedAt)}</span>
                ) : (
                  <Dash />
                ),
            },
          ]}
          rowActions={(row) => (
            <ListRowActions>
              {row.desiredState === 'stopped' ? (
                <ListRowAction
                  disabled={busyId === row.applicationId}
                  onClick={(e) => {
                    e.stopPropagation();
                    void setDesiredState(row, 'running');
                  }}
                >
                  {t('cells.action.start')}
                </ListRowAction>
              ) : (
                <ListRowAction
                  disabled={busyId === row.applicationId}
                  onClick={(e) => {
                    e.stopPropagation();
                    void setDesiredState(row, 'stopped');
                  }}
                >
                  {t('cells.action.stop')}
                </ListRowAction>
              )}
            </ListRowActions>
          )}
          empty={
            <ConsoleEmptyState
              variant={!loading && rowsAll.length > 0 && filtersActive ? 'no-match' : 'no-data'}
              title={
                loading
                  ? '…'
                  : rowsAll.length === 0
                    ? t('cells.empty.title')
                    : t('admin.empty.title')
              }
              description={
                loading
                  ? undefined
                  : rowsAll.length === 0
                    ? t('cells.empty.body')
                    : t('admin.empty.description')
              }
              clearFiltersLabel={t('admin.empty.clearFilters')}
              onClearFilters={
                filtersActive
                  ? () => {
                      setQ('');
                      setState('all');
                    }
                  : undefined
              }
            />
          }
        />
      )}

      <ConsoleDrawer
        open={selectedId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        title={detail?.application.name ?? t('cells.detail.title')}
        description={detail?.application.applicationId}
        className="!w-[min(100%,42rem)]"
      >
        {detailLoading ? (
          <p className="text-sm text-ink-muted">{t('cells.detail.loading')}</p>
        ) : null}
        {detailError ? (
          <AppErrorBanner message={detailError} onRetry={() => selectedId && void loadDetail(selectedId)} />
        ) : null}
        {detail && !detailLoading ? (
          <div className="grid gap-5">
            <dl className="os-work-expand">
              <div>
                <dt>{t('cells.col.state')}</dt>
                <dd>
                  <Badge tone={stateTone(detail.application.desiredState)}>
                    {stateText(detail.application.desiredState, t)}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt>{t('cells.col.revision')}</dt>
                <dd className="tabular-nums">
                  {detail.application.currentRevisionNumber ?? <Dash />}
                </dd>
              </div>
              <div>
                <dt>{t('cells.expand.digest')}</dt>
                <dd className="break-all font-mono text-xs">
                  {detail.application.currentDefinitionDigest || <Dash />}
                </dd>
              </div>
              <div>
                <dt>{t('cells.expand.version')}</dt>
                <dd className="tabular-nums">
                  {detail.application.aggregateVersion ?? <Dash />}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2">
              {detail.application.desiredState === 'stopped' ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === detail.application.applicationId}
                  onClick={() => void setDesiredState(detail.application, 'running')}
                >
                  {t('cells.action.start')}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === detail.application.applicationId}
                  onClick={() => void setDesiredState(detail.application, 'stopped')}
                >
                  {t('cells.action.stop')}
                </Button>
              )}
            </div>

            <section className="grid gap-2">
              <h3 className="text-sm font-medium text-ink">{t('cells.detail.revise')}</h3>
              <p className="text-xs text-ink-muted">{t('cells.detail.reviseHint')}</p>
              <ConsoleTextarea
                value={reviseAcl}
                onChange={(e) => setReviseAcl(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
              <div>
                <Button
                  type="button"
                  size="sm"
                  disabled={revising}
                  onClick={() => void submitRevise()}
                >
                  {t('cells.action.revise')}
                </Button>
              </div>
            </section>

            <section className="grid gap-2">
              <h3 className="text-sm font-medium text-ink">{t('cells.detail.deploy')}</h3>
              <p className="text-xs text-ink-muted">{t('cells.detail.deployHint')}</p>
              <ConsoleFormField label={t('cells.field.serviceProfileAcl')} required>
                <ConsoleTextarea
                  value={serviceProfileAcl}
                  onChange={(e) => setServiceProfileAcl(e.target.value)}
                  rows={4}
                  className="font-mono text-xs"
                />
              </ConsoleFormField>
              <ConsoleFormField label={t('cells.field.providerWorkloadAcl')} required>
                <ConsoleTextarea
                  value={providerWorkloadAcl}
                  onChange={(e) => setProviderWorkloadAcl(e.target.value)}
                  rows={4}
                  className="font-mono text-xs"
                />
              </ConsoleFormField>
              <ConsoleFormField label={t('cells.field.storageBindingAcl')} required>
                <ConsoleTextarea
                  value={storageBindingAcl}
                  onChange={(e) => setStorageBindingAcl(e.target.value)}
                  rows={4}
                  className="font-mono text-xs"
                />
              </ConsoleFormField>
              <ConsoleFormField label={t('cells.field.storageProviderProfileAcl')}>
                <ConsoleTextarea
                  value={storageProviderProfileAcl}
                  onChange={(e) => setStorageProviderProfileAcl(e.target.value)}
                  rows={3}
                  className="font-mono text-xs"
                />
              </ConsoleFormField>
              <div>
                <Button
                  type="button"
                  size="sm"
                  disabled={deploying || !detail.application.currentRevisionId}
                  onClick={() => void submitDeploy()}
                >
                  {t('cells.action.deploy')}
                </Button>
              </div>
            </section>

            <section className="grid gap-2">
              <h3 className="text-sm font-medium text-ink">{t('cells.detail.route')}</h3>
              <p className="text-xs text-ink-muted">{t('cells.detail.routeHint')}</p>
              <ConsoleFormField label={t('cells.field.serviceProfileAcl')} required>
                <ConsoleTextarea
                  value={routeServiceProfileAcl}
                  onChange={(e) => setRouteServiceProfileAcl(e.target.value)}
                  rows={3}
                  className="font-mono text-xs"
                />
              </ConsoleFormField>
              <ConsoleFormField label={t('cells.field.gatewayScopeId')} required>
                <Input
                  value={gatewayScopeId}
                  onChange={(e) => setGatewayScopeId(e.target.value)}
                  className="font-mono text-xs"
                />
              </ConsoleFormField>
              <ConsoleFormField label={t('cells.field.domainClaimId')} required>
                <Input
                  value={domainClaimId}
                  onChange={(e) => setDomainClaimId(e.target.value)}
                  className="font-mono text-xs"
                />
              </ConsoleFormField>
              <ConsoleFormField label={t('cells.field.hostname')} required>
                <Input value={hostname} onChange={(e) => setHostname(e.target.value)} />
              </ConsoleFormField>
              <ConsoleFormField label={t('cells.field.pathPrefix')} required>
                <Input value={pathPrefix} onChange={(e) => setPathPrefix(e.target.value)} />
              </ConsoleFormField>
              <div>
                <Button
                  type="button"
                  size="sm"
                  disabled={publishingRoute || !detail.application.currentRevisionId}
                  onClick={() => void submitPublishRoute()}
                >
                  {t('cells.action.publishRoute')}
                </Button>
              </div>
            </section>

            <section className="grid gap-2">
              <h3 className="text-sm font-medium text-ink">{t('cells.detail.revisions')}</h3>
              {revisions.length === 0 ? (
                <p className="text-sm text-ink-muted">{t('cells.detail.revisionsEmpty')}</p>
              ) : (
                <ul className="grid gap-2">
                  {revisions.map((revision) => (
                    <li
                      key={revision.revisionId}
                      className="rounded-md border border-line px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="tabular-nums text-sm font-medium">
                          #{revision.revisionNumber ?? '—'}
                        </span>
                        <span className="tabular-nums text-xs text-ink-faint">
                          {revision.createdAt ? stamp(revision.createdAt) : '—'}
                        </span>
                      </div>
                      <div className="mt-1 break-all font-mono text-[11px] text-ink-muted">
                        {revision.definitionDigest || revision.revisionId}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </ConsoleDrawer>
    </AdminPageShell>
  );
}

function isState(value: string): value is StateFilter {
  return value === 'all' || value === 'running' || value === 'stopped';
}
