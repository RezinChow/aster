import { useMemo, useState, type FormEvent } from 'react';
import {
  Badge,
  ConsoleEmptyState,
  FormDialog,
  ListToolbar,
  SearchSelect,
  Tabs,
  TabsList,
  TabsTrigger,
  useToast,
  type BadgeTone,
} from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { AdminPageShell } from '@/components/AdminPageShell';
import { ListRowAction, ListRowActions } from '@/components/ListRowActions';
import {
  IconCheck,
  IconLayers,
  IconMail,
  IconPlay,
  IconRotateCcw,
  IconUser,
} from '@/components/UiIcons';
import { OsIcon } from '@/shell/icons';
import { adminUsers } from '@/data/admin';
import {
  LOCAL_ASSIGNEE_ID,
  WORK_ORDER_TYPES,
  assignWorkOrder,
  listWorkOrders,
  setWorkOrderStatus,
  workOrderAssigneeName,
  type WorkOrder,
  type WorkOrderSource,
  type WorkOrderStatus,
  type WorkOrderType,
} from '@/data/workOrders';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';

type Queue = WorkOrderStatus;

const QUEUES: { id: Queue; label: MessageKey }[] = [
  { id: 'open', label: 'workOrders.status.open' },
  { id: 'in_progress', label: 'workOrders.status.inProgress' },
  { id: 'resolved', label: 'workOrders.status.resolved' },
];

const TYPE_TONE: Record<WorkOrderType, BadgeTone> = {
  incident: 'danger',
  approval: 'primary',
  email: 'neutral',
  complaint: 'warn',
};

function statusTone(status: WorkOrderStatus): BadgeTone {
  switch (status) {
    case 'open':
      return 'warn';
    case 'in_progress':
      return 'primary';
    case 'resolved':
      return 'success';
  }
}

function statusKey(status: WorkOrderStatus): MessageKey {
  switch (status) {
    case 'open':
      return 'workOrders.status.open';
    case 'in_progress':
      return 'workOrders.status.inProgress';
    case 'resolved':
      return 'workOrders.status.resolved';
  }
}

function typeKey(type: WorkOrderType): MessageKey {
  switch (type) {
    case 'incident':
      return 'workOrders.type.incident';
    case 'approval':
      return 'workOrders.type.approval';
    case 'email':
      return 'workOrders.type.email';
    case 'complaint':
      return 'workOrders.type.complaint';
  }
}

function sourceKey(source: WorkOrderSource): MessageKey {
  return source === 'agent'
    ? 'workOrders.source.agent'
    : 'workOrders.source.workflow';
}

const TYPE_TAB_TINT: Record<'all' | WorkOrderType, string> = {
  all: 'bg-surface text-ink-muted',
  incident: 'bg-rose-100 text-rose-700',
  approval: 'bg-violet-100 text-violet-700',
  email: 'bg-sky-100 text-sky-700',
  complaint: 'bg-amber-100 text-amber-700',
};

const SOURCE_TAB_TINT: Record<'all' | WorkOrderSource, string> = {
  all: 'bg-surface text-ink-muted',
  workflow: 'bg-emerald-100 text-emerald-700',
  agent: 'bg-orange-100 text-orange-700',
};

function TypeTabIcon({ type }: { type: 'all' | WorkOrderType }) {
  switch (type) {
    case 'all':
      return <IconLayers />;
    case 'incident':
      return <IconAlert />;
    case 'approval':
      return <IconCheck />;
    case 'email':
      return <IconMail />;
    case 'complaint':
      return <IconMessage />;
  }
}

function IconAlert() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 4.5 3.5 19.5h17L12 4.5z" />
      <path d="M12 10v4.2" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function IconMessage() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 16.5H9l-4 3v-3H5A1.5 1.5 0 0 1 3.5 15V8A1.5 1.5 0 0 1 5 6.5z" />
    </svg>
  );
}

function isSource(value: string): value is 'all' | WorkOrderSource {
  return value === 'all' || value === 'agent' || value === 'workflow';
}

function isType(value: string): value is 'all' | WorkOrderType {
  return value === 'all' || (WORK_ORDER_TYPES as readonly string[]).includes(value);
}

function formatWaiting(
  waiting: string | undefined,
  labels: { hours: string; minutes: string; seconds: string },
): string {
  if (!waiting) return '—';
  const match = /^(\d+)([hms])$/.exec(waiting);
  if (!match) return waiting;
  const template =
    match[2] === 'h'
      ? labels.hours
      : match[2] === 'm'
        ? labels.minutes
        : labels.seconds;
  return template.replaceAll('{n}', match[1]);
}

function Dash() {
  return <span className="text-ink-faint">—</span>;
}

export function WorkOrdersPage() {
  const { locale, t } = useI18n();
  const toast = useToast();
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState('');
  const [queue, setQueue] = useState<Queue>('open');
  const [source, setSource] = useState<'all' | WorkOrderSource>('all');
  const [kind, setKind] = useState<'all' | WorkOrderType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<WorkOrder | null>(null);
  const [assigneePick, setAssigneePick] = useState('');

  const activeUsers = useMemo(
    () => adminUsers.filter((user) => user.status === 'active'),
    [],
  );

  const all = useMemo(() => {
    void tick;
    return listWorkOrders();
  }, [tick]);

  const counts = useMemo(() => {
    return {
      open: all.filter((row) => row.status === 'open').length,
      in_progress: all.filter((row) => row.status === 'in_progress').length,
      resolved: all.filter((row) => row.status === 'resolved').length,
    };
  }, [all]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((row) => {
      if (row.status !== queue) return false;
      if (source !== 'all' && row.source !== source) return false;
      if (kind !== 'all' && row.type !== kind) return false;
      if (!needle) return true;
      const assignee = workOrderAssigneeName(row.assigneeId) ?? '';
      return (
        row.id.toLowerCase().includes(needle) ||
        row.summary.zh.toLowerCase().includes(needle) ||
        row.summary.en.toLowerCase().includes(needle) ||
        row.scope.toLowerCase().includes(needle) ||
        row.type.includes(needle) ||
        t(typeKey(row.type)).toLowerCase().includes(needle) ||
        assignee.toLowerCase().includes(needle)
      );
    });
  }, [all, kind, q, queue, source, t]);

  const waitingLabels = {
    hours: t('workOrders.waiting.hours'),
    minutes: t('workOrders.waiting.minutes'),
    seconds: t('workOrders.waiting.seconds'),
  };

  function refresh() {
    setTick((n) => n + 1);
  }

  function fail() {
    toast.push({ title: t('workOrders.toast.failed'), tone: 'danger' });
  }

  function transition(row: WorkOrder, next: WorkOrderStatus, title: MessageKey) {
    const updated = setWorkOrderStatus(row.id, next);
    if (!updated) {
      fail();
      return;
    }
    refresh();
    setQueue(next);
    setExpandedId(null);
    toast.push({ title: t(title), tone: 'success' });
  }

  function openAssign(row: WorkOrder) {
    const current =
      row.assigneeId &&
      activeUsers.some((user) => user.id === row.assigneeId)
        ? row.assigneeId
        : (activeUsers[0]?.id ?? '');
    if (!current) {
      fail();
      return;
    }
    setAssigneePick(current);
    setAssignTarget(row);
  }

  function onAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignTarget) return;
    const updated = assignWorkOrder(assignTarget.id, assigneePick);
    if (!updated) {
      fail();
      return;
    }
    refresh();
    setAssignTarget(null);
    toast.push({ title: t('workOrders.toast.assigned'), tone: 'success' });
  }

  function assigneeLabel(row: WorkOrder) {
    if (!row.assigneeId) return null;
    if (row.assigneeId === LOCAL_ASSIGNEE_ID) return t('shell.localUser');
    return workOrderAssigneeName(row.assigneeId) ?? row.assigneeId;
  }

  function detail(label: string, value: string) {
    return (
      <div>
        <dt>{label}</dt>
        <dd>{value === '—' ? <Dash /> : value}</dd>
      </div>
    );
  }

  return (
    <AdminPageShell
      title={t('nav.tasks')}
      description={t('workOrders.description')}
    >
      <ListToolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t('workOrders.search')}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={kind}
              onValueChange={(value) => {
                if (!isType(value)) return;
                setKind(value);
                setExpandedId(null);
              }}
              className="gap-0"
            >
              <TabsList
                className="os-market-kind-tabs"
                aria-label={t('workOrders.filter.type')}
              >
                {(
                  ['all', ...WORK_ORDER_TYPES] as const
                ).map((type) => (
                  <TabsTrigger
                    key={type}
                    value={type}
                    className="os-market-kind-tab gap-1.5"
                  >
                    <span
                      className={`inline-flex size-4 shrink-0 items-center justify-center rounded ${TYPE_TAB_TINT[type]}`}
                    >
                      <TypeTabIcon type={type} />
                    </span>
                    {type === 'all'
                      ? t('workOrders.filter.allTypes')
                      : t(typeKey(type))}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Tabs
              value={source}
              onValueChange={(value) => {
                if (!isSource(value)) return;
                setSource(value);
                setExpandedId(null);
              }}
              className="gap-0"
            >
              <TabsList
                className="os-market-kind-tabs"
                aria-label={t('workOrders.filter.source')}
              >
                {(
                  [
                    ['all', 'workOrders.filter.allSources'],
                    ['workflow', 'workOrders.source.workflow'],
                    ['agent', 'workOrders.source.agent'],
                  ] as const
                ).map(([value, label]) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="os-market-kind-tab gap-1.5"
                  >
                    <span
                      className={`inline-flex size-4 shrink-0 items-center justify-center rounded ${SOURCE_TAB_TINT[value]}`}
                    >
                      {value === 'all' ? (
                        <IconLayers />
                      ) : (
                        <OsIcon name={value === 'workflow' ? 'workflows' : 'agents'} />
                      )}
                    </span>
                    {t(label)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        }
      />

      <Tabs
        value={queue}
        onValueChange={(value) => {
          setQueue(value as Queue);
          setExpandedId(null);
        }}
        className="gap-0"
      >
        <TabsList className="os-queue-tabs" aria-label={t('workOrders.queue')}>
          {QUEUES.map((item) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              className="os-queue-tab !h-auto !rounded-none !bg-transparent !px-3.5 !py-2.5 !shadow-none"
            >
              {t(item.label)}
              <span className="os-queue-tab__count tabular-nums">
                {counts[item.id]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <I18nDataTable
        rows={rows}
        rowKey={(row) => row.id}
        onRefresh={() => setTick((n) => n + 1)}
        defaultPagination={{ page: 1, pageSize: 10 }}
        pageSizeOptions={[10, 20, 50]}
        expandedRowKey={expandedId}
        onExpandedRowChange={setExpandedId}
        renderExpanded={(row) => {
          const summary = row.summary[locale];
          const other = locale === 'zh' ? row.summary.en : row.summary.zh;
          const owner = assigneeLabel(row);
          return (
            <dl className="os-work-expand">
              <div className="os-work-expand__summary">
                <dt>{t('workOrders.col.summary')}</dt>
                <dd>{summary}</dd>
                {other !== summary ? (
                  <dd className="text-ink-muted">
                    <span className="text-ink-faint">
                      {t('workOrders.expand.other')}
                      {' · '}
                    </span>
                    {other}
                  </dd>
                ) : null}
              </div>
              {detail(t('workOrders.col.id'), row.id)}
              {detail(t('workOrders.col.type'), t(typeKey(row.type)))}
              {detail(
                t('workOrders.col.source'),
                row.source ? t(sourceKey(row.source)) : '—',
              )}
              {detail(t('workOrders.col.scope'), row.scope)}
              {detail(
                t('workOrders.col.priority'),
                row.priority ? t('workOrders.priority.sev2') : '—',
              )}
              {detail(
                t('workOrders.col.waiting'),
                formatWaiting(row.waiting, waitingLabels),
              )}
              {detail(t('workOrders.col.status'), t(statusKey(row.status)))}
              {detail(t('workOrders.col.assignee'), owner ?? '—')}
            </dl>
          );
        }}
        columns={[
          {
            id: 'id',
            header: t('workOrders.col.id'),
            cell: (row) => (
              <span className="font-mono text-xs text-ink-muted">{row.id}</span>
            ),
          },
          {
            id: 'summary',
            header: t('workOrders.col.summary'),
            cell: (row) => (
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">
                  {row.summary[locale]}
                </div>
                <div className="text-[11px] text-ink-faint">{row.scope}</div>
              </div>
            ),
          },
          {
            id: 'type',
            header: t('workOrders.col.type'),
            cell: (row) => (
              <Badge tone={TYPE_TONE[row.type]}>{t(typeKey(row.type))}</Badge>
            ),
          },
          {
            id: 'source',
            header: t('workOrders.col.source'),
            cell: (row) =>
              row.source ? (
                <Badge tone="neutral">{t(sourceKey(row.source))}</Badge>
              ) : (
                <Dash />
              ),
          },
          {
            id: 'priority',
            header: t('workOrders.col.priority'),
            cell: (row) =>
              row.priority ? (
                <Badge tone="danger">{t('workOrders.priority.sev2')}</Badge>
              ) : (
                <Dash />
              ),
          },
          {
            id: 'waiting',
            header: t('workOrders.col.waiting'),
            cell: (row) => (
              <span className="tabular-nums text-sm">
                {formatWaiting(row.waiting, waitingLabels)}
              </span>
            ),
          },
          {
            id: 'status',
            header: t('workOrders.col.status'),
            cell: (row) => (
              <Badge tone={statusTone(row.status)}>
                {t(statusKey(row.status))}
              </Badge>
            ),
          },
          {
            id: 'assignee',
            header: t('workOrders.col.assignee'),
            cell: (row) => assigneeLabel(row) ?? <Dash />,
          },
        ]}
        rowActions={(row) => (
          <ListRowActions>
            {row.status !== 'resolved' ? (
              <ListRowAction
                iconOnly
                icon={<IconUser />}
                aria-label={t('workOrders.action.assign')}
                onClick={() => openAssign(row)}
              />
            ) : null}
            {row.status === 'open' ? (
              <ListRowAction
                iconOnly
                icon={<IconPlay />}
                aria-label={t('workOrders.action.claim')}
                onClick={() =>
                  transition(row, 'in_progress', 'workOrders.toast.claimed')
                }
              />
            ) : null}
            {row.status === 'in_progress' ? (
              <ListRowAction
                iconOnly
                icon={<IconCheck />}
                aria-label={t('workOrders.action.resolve')}
                onClick={() =>
                  transition(row, 'resolved', 'workOrders.toast.resolved')
                }
              />
            ) : null}
            {row.status === 'resolved' ? (
              <ListRowAction
                iconOnly
                icon={<IconRotateCcw />}
                aria-label={t('workOrders.action.reopen')}
                onClick={() =>
                  transition(row, 'open', 'workOrders.toast.reopened')
                }
              />
            ) : null}
          </ListRowActions>
        )}
        empty={
          <ConsoleEmptyState
            variant={
              q.trim() || source !== 'all' || kind !== 'all'
                ? 'no-match'
                : 'no-data'
            }
            title={t('workOrders.emptyTitle')}
            description={t('workOrders.emptyBody')}
          />
        }
      />

      <FormDialog
        open={assignTarget != null}
        onOpenChange={(open) => {
          if (!open) setAssignTarget(null);
        }}
        size="sm"
        title={t('workOrders.assign.title')}
        description={
          assignTarget
            ? `${assignTarget.id} · ${assignTarget.summary[locale]}`
            : t('workOrders.assign.description')
        }
        closeLabel={t('workOrders.assign.close')}
        cancelLabel={t('workOrders.assign.cancel')}
        submitLabel={t('workOrders.assign.submit')}
        submitDisabled={!assigneePick}
        onSubmit={onAssign}
      >
        <div className="space-y-1.5">
          <div className="text-[11px] text-ink-muted">
            {t('workOrders.assign.user')}
          </div>
          <SearchSelect
            searchable={false}
            allowClear={false}
            value={assigneePick}
            onChange={setAssigneePick}
            options={activeUsers.map((user) => ({
              value: user.id,
              label: user.name,
            }))}
            aria-label={t('workOrders.assign.user')}
          />
          <p className="text-[11px] leading-4 text-ink-faint">
            {t('workOrders.assign.description')}
          </p>
        </div>
      </FormDialog>
    </AdminPageShell>
  );
}
