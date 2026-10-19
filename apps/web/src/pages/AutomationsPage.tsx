import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, ConsoleEmptyState, ListToolbar, type BadgeTone } from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { AdminPageShell } from '@/components/AdminPageShell';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import type { MessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/useI18n';
import { ApiRequestError } from '@/lib/apiEnvelope';
import {
  listCloudAutomationDefinitions,
  type CloudAutomationDefinition,
} from '@/lib/automationsApi';
import { useCloudScopeContext } from '@/shell/CloudScopeContext';

const TRIGGER_KEY: Record<string, MessageKey> = {
  webhook: 'automations.trigger.webhook',
  schedule: 'automations.trigger.schedule',
  event: 'automations.trigger.event',
};

function triggerLabel(kind: string, t: (key: MessageKey) => string): string {
  return TRIGGER_KEY[kind] ? t(TRIGGER_KEY[kind]) : kind;
}

function triggerTone(kind: string): BadgeTone {
  switch (kind) {
    case 'webhook':
      return 'primary';
    case 'schedule':
      return 'success';
    default:
      return 'neutral';
  }
}

export function AutomationsPage() {
  const { t } = useI18n();
  const scope = useCloudScopeContext();
  const orgReady = Boolean(scope.cloudOrganizationId);
  const [rows, setRows] = useState<CloudAutomationDefinition[]>([]);
  const [queried, setQueried] = useState(false);
  const [pending, setPending] = useState<'load' | null>(null);
  const [pageError, setPageError] = useState<MessageKey | null>(null);
  const [search, setSearch] = useState('');

  const onRefresh = useCallback(async () => {
    setPending('load');
    setPageError(null);
    try {
      const definitions = await listCloudAutomationDefinitions();
      setRows(definitions);
      setQueried(true);
    } catch (error) {
      setRows([]);
      setPageError(
        error instanceof ApiRequestError && error.code === 404
          ? 'automations.error.unavailable'
          : 'automations.error.load',
      );
    } finally {
      setPending(null);
    }
  }, []);

  useEffect(() => {
    if (!orgReady) return;
    void onRefresh();
  }, [orgReady, onRefresh]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(query) ||
        row.triggerKind.toLowerCase().includes(query),
    );
  }, [rows, search]);

  return (
    <AdminPageShell title={t('nav.automations')} description={t('nav.automationsDesc')}>
      {pageError ? (
        <AppErrorBanner message={t(pageError)} onRetry={onRefresh} />
      ) : null}

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('automations.search')}
      />

      {!orgReady ? (
        <ConsoleEmptyState title={t('automations.needSession')} />
      ) : (
        <I18nDataTable
          rows={filtered}
          rowKey={(row) => row.automationId}
          loading={pending === 'load'}
          onRefresh={queried ? onRefresh : undefined}
          empty={
            <ConsoleEmptyState
              title={
                search.trim()
                  ? t('automations.emptyFiltered')
                  : t('automations.empty.title')
              }
              variant={search.trim() ? 'no-match' : 'no-data'}
            />
          }
          columns={[
            {
              id: 'name',
              header: t('automations.col.name'),
              cell: (row) => <span className="font-mono text-xs">{row.name}</span>,
            },
            {
              id: 'trigger',
              header: t('automations.col.trigger'),
              cell: (row) => (
                <Badge tone={triggerTone(row.triggerKind)}>
                  {triggerLabel(row.triggerKind, t)}
                </Badge>
              ),
            },
            {
              id: 'revision',
              header: t('automations.col.revision'),
              cell: (row) => (
                <span className="font-mono text-xs">#{row.revisionNumber}</span>
              ),
            },
            {
              id: 'updatedAt',
              header: t('automations.col.updatedAt'),
              cell: (row) => <span className="text-xs text-ink">{row.updatedAt}</span>,
            },
          ]}
        />
      )}
    </AdminPageShell>
  );
}
