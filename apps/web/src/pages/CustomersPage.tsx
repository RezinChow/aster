import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  ConsoleEmptyState,
  ListToolbar,
  OrgMark,
  PageLoading,
  useShowPageLoading,
  PersonCell,
  SearchSelect,
  Tabs,
  TabsList,
  TabsTrigger,
  type BadgeTone,
} from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { RegionCascader } from '@/components/RegionCascader';
import { AdminPageShell } from '@/components/AdminPageShell';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import { IconBarChart, IconBuilding, IconLayers, IconUser } from '@/components/UiIcons';
import {
  listChannelPartners,
  subscribeChannelPartners,
  type ChannelPartner,
} from '@/data/channelPartners';
import { listPlans } from '@/data/subscriptions';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import {
  listCustomerPeople,
  listCustomers,
  type Customer,
  type CustomerKind,
  type CustomerPerson,
} from '@/lib/identityApi';
import { customerInChannel, customerInRegion } from '@/pages/customers/customerFilters';

const PLANS = listPlans().map((item) => item.id);
type PlanFilter = 'all' | (typeof PLANS)[number];
type StatusFilter = 'all' | 'active' | 'disabled' | 'pending_verification';

const QUEUES: { id: StatusFilter; label: MessageKey }[] = [
  { id: 'all', label: 'customers.status.all' },
  { id: 'active', label: 'customers.status.active' },
  { id: 'disabled', label: 'customers.status.disabled' },
  { id: 'pending_verification', label: 'customers.status.pending' },
];

const KIND_LABEL: Record<CustomerKind, MessageKey> = {
  individual: 'customers.kind.individual',
  organization: 'customers.kind.organization',
};

const PLAN_TINT: Record<PlanFilter, string> = {
  all: 'bg-surface text-ink-muted',
  free: 'bg-surface text-ink-muted',
  builder: 'bg-sky-100 text-sky-700',
  team: 'bg-emerald-100 text-emerald-700',
  enterprise: 'bg-violet-100 text-violet-700',
};

function isPlan(value: string): value is PlanFilter {
  return value === 'all' || (PLANS as readonly string[]).includes(value);
}

function isStatus(value: string): value is StatusFilter {
  return (
    value === 'all' ||
    value === 'active' ||
    value === 'disabled' ||
    value === 'pending_verification'
  );
}

function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'active':
      return 'success';
    case 'pending_verification':
      return 'warn';
    default:
      return 'neutral';
  }
}

function statusLabel(status: string): MessageKey {
  switch (status) {
    case 'active':
      return 'customers.status.active';
    case 'disabled':
      return 'customers.status.disabled';
    case 'pending_verification':
      return 'customers.status.pending';
    default:
      return 'customers.status.disabled';
  }
}

function PlanIcon({ plan }: { plan: PlanFilter }) {
  switch (plan) {
    case 'all':
      return <IconLayers />;
    case 'free':
      return <FreeIcon />;
    case 'builder':
      return <IconBarChart />;
    case 'team':
      return <IconUser />;
    case 'enterprise':
      return <IconBuilding />;
  }
}

function FreeIcon() {
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
      <circle cx="12" cy="12" r="7.25" />
      <path d="M12 8.5v7M9.25 11h5.5" />
    </svg>
  );
}

function planName(id: string): string {
  return listPlans().find((item) => item.id === id)?.name ?? id;
}

function fill(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
    template,
  );
}

function createdDate(value: string): string {
  return value.slice(0, 10);
}

function hasGivenName(name: string, phone: string | null): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (phone && trimmed === phone.trim()) return false;
  if (trimmed.includes('@')) return false;
  if (/^\d+$/.test(trimmed)) return false;
  return true;
}

function CustomerLogo({
  name,
  phone,
  logoUrl,
}: {
  name: string;
  phone: string | null;
  logoUrl: string;
}) {
  if (logoUrl) {
    return <img src={logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />;
  }
  if (!hasGivenName(name, phone)) {
    return (
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink text-[color:var(--color-bg)]"
        aria-hidden
      >
        <IconUser />
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink text-[11px] font-medium text-[color:var(--color-bg)]"
      aria-hidden
    >
      {[...name.trim()][0]}
    </span>
  );
}

function Dash() {
  return <span className="text-ink-faint">—</span>;
}

function subtitle(customer: Customer): string {
  if (customer.kind === 'individual') return customer.phone ?? '';
  return customer.industry || customer.phone || '';
}

export function CustomersPage() {
  const { t } = useI18n();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState<PlanFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [channelId, setChannelId] = useState('all');
  const [region, setRegion] = useState({ province: '', city: '', county: '' });
  const [partners, setPartners] = useState<ChannelPartner[]>(() => listChannelPartners());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [peopleById, setPeopleById] = useState<Record<string, CustomerPerson[]>>({});

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const rows = await listCustomers();
      setCustomers(rows);
      setPeopleById({});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => subscribeChannelPartners(() => setPartners(listChannelPartners())), []);

  const firstCustomersLoad = useShowPageLoading(loading && customers.length === 0);

  useEffect(() => {
    if (!expandedId || peopleById[expandedId]) return;
    const id = expandedId;
    let cancelled = false;
    listCustomerPeople(id)
      .then((people) => {
        if (cancelled) return;
        setPeopleById((current) => ({ ...current, [id]: people }));
      })
      .catch(() => {
        if (cancelled) return;
        setPeopleById((current) => ({ ...current, [id]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [expandedId, peopleById]);

  const regionPath = useMemo(
    () => [region.province, region.city, region.county].filter((part) => part.length > 0),
    [region.county, region.city, region.province],
  );
  const activeChannelId = partners.some((item) => item.id === channelId) ? channelId : 'all';

  const counts = useMemo(() => {
    const scoped = customers.filter(
      (row) =>
        (plan === 'all' || row.plan === plan) &&
        customerInChannel(row, partners, activeChannelId) &&
        customerInRegion(row, partners, regionPath),
    );
    return {
      all: scoped.length,
      active: scoped.filter((row) => row.status === 'active').length,
      disabled: scoped.filter((row) => row.status === 'disabled').length,
      pending_verification: scoped.filter((row) => row.status === 'pending_verification').length,
    };
  }, [activeChannelId, customers, partners, plan, regionPath]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return customers.filter((customer) => {
      if (status !== 'all' && customer.status !== status) return false;
      if (plan !== 'all' && customer.plan !== plan) return false;
      if (!customerInChannel(customer, partners, activeChannelId)) return false;
      if (!customerInRegion(customer, partners, regionPath)) return false;
      if (!needle) return true;
      return [customer.name, customer.phone, customer.owner_name, customer.owner_phone, customer.industry, customer.id]
        .some((value) => (value ?? '').toLowerCase().includes(needle));
    });
  }, [activeChannelId, customers, partners, plan, q, regionPath, status]);

  function seats(customer: Customer) {
    return fill(t('customers.seats'), {
      used: customer.seats_used,
      total: customer.seats_total,
    });
  }

  return (
    <AdminPageShell title={t('customers.title')} description={t('customers.description')}>
      <ListToolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t('customers.search')}
        filters={
          <>
          <SearchSelect
            size="sm"
            searchable={partners.length + 1 > 8}
            allowClear={false}
            className="w-44"
            aria-label={t('customers.filter.channel')}
            value={activeChannelId}
            onChange={(value) => {
              setChannelId(value || 'all');
              setExpandedId(null);
            }}
            options={[
              { value: 'all', label: t('customers.filter.allChannels') },
              ...partners.map((item) => ({
                value: item.id,
                label: item.name,
                keywords: item.contactName,
                icon: <OrgMark name={item.name} logoUrl={item.logoUrl} size={16} />,
              })),
            ]}
          />
          <RegionCascader
            size="sm"
            className="w-44"
            expandSingleChild={false}
            province={region.province}
            city={region.city}
            county={region.county}
            placeholder={t('customers.filter.allRegions')}
            aria-label={t('customers.filter.region')}
            onChange={(next) => {
              setRegion(next);
              setExpandedId(null);
            }}
          />
          <Tabs
            value={plan}
            onValueChange={(value) => {
              if (!isPlan(value)) return;
              setPlan(value);
              setExpandedId(null);
            }}
            className="gap-0"
          >
            <TabsList className="os-market-kind-tabs" aria-label={t('customers.filter.plan')}>
              {(['all', ...PLANS] as const).map((item) => (
                <TabsTrigger key={item} value={item} className="os-market-kind-tab gap-1.5">
                  <span
                    className={`inline-flex size-5 shrink-0 items-center justify-center rounded ${PLAN_TINT[item]}`}
                  >
                    <PlanIcon plan={item} />
                  </span>
                  {item === 'all' ? t('customers.filter.allPlans') : planName(item)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          </>
        }
      />

      <Tabs
        value={status}
        onValueChange={(value) => {
          if (!isStatus(value)) return;
          setStatus(value);
          setExpandedId(null);
        }}
        className="gap-0"
      >
        <TabsList className="os-queue-tabs" aria-label={t('customers.queue')}>
          {QUEUES.map((item) => (
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

      {error ? (
        <AppErrorBanner
          message={error}
          onRetry={() => {
            void reload();
          }}
        />
      ) : null}

      {firstCustomersLoad ? (
        <PageLoading variant="contain" />
      ) : (
        <I18nDataTable
          rows={rows}
          loading={loading}
          onRefresh={() => reload()}
          rowKey={(customer) => customer.id}
          defaultPagination={{ page: 1, pageSize: 10 }}
          pageSizeOptions={[10, 20, 50]}
          expandedRowKey={expandedId}
          onExpandedRowChange={setExpandedId}
          renderExpanded={(customer) => {
            const people = peopleById[customer.id];
            return (
              <dl className="os-work-expand">
                <div>
                  <dt>{t('customers.field.kind')}</dt>
                  <dd>{t(KIND_LABEL[customer.kind])}</dd>
                </div>
                <div>
                  <dt>{t('customers.col.phone')}</dt>
                  <dd>{customer.phone || <Dash />}</dd>
                </div>
                {customer.kind === 'organization' ? (
                  <div>
                    <dt>{t('customers.field.industry')}</dt>
                    <dd>{customer.industry || <Dash />}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>{t('customers.col.plan')}</dt>
                  <dd>
                    {planName(customer.plan)}
                    {customer.subscription_status === 'cancelled'
                      ? ` · ${t('customers.subscription.cancelled')}`
                      : ''}
                  </dd>
                </div>
                <div>
                  <dt>{t('customers.col.seats')}</dt>
                  <dd className="tabular-nums">{seats(customer)}</dd>
                </div>
                <div>
                  <dt>{t('customers.col.owner')}</dt>
                  <dd>
                    {customer.owner_name ? (
                      <PersonCell
                        name={customer.owner_name}
                        email={customer.owner_phone ?? undefined}
                        mark
                        size="sm"
                      />
                    ) : (
                      <Dash />
                    )}
                  </dd>
                </div>
                <div>
                  <dt>ID</dt>
                  <dd className="font-mono text-xs">{customer.id}</dd>
                </div>
                <div>
                  <dt>{t('customers.col.created')}</dt>
                  <dd className="tabular-nums">{createdDate(customer.created_at)}</dd>
                </div>
                <div className="os-work-expand__summary">
                  <dt>{t('customers.expand.members')}</dt>
                  <dd>
                    {!people ? null : people.length === 0 ? (
                      <span className="text-ink-muted">{t('customers.expand.noMembers')}</span>
                    ) : (
                      <ul className="space-y-2">
                        {people.map((person) => (
                          <li key={person.id}>
                            <PersonCell
                              name={person.name}
                              email={person.phone || person.email || undefined}
                              mark
                              size="sm"
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
              </dl>
            );
          }}
          columns={[
            {
              id: 'customer',
              header: t('customers.col.customer'),
              sortable: true,
              getSortValue: (customer) => customer.name,
              cell: (customer) => (
                <div className="flex min-w-0 items-center gap-2.5">
                  <CustomerLogo
                    name={customer.name}
                    phone={customer.phone}
                    logoUrl={customer.logo}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{customer.name}</div>
                    {subtitle(customer) ? (
                      <div className="truncate text-[11px] text-ink-faint">{subtitle(customer)}</div>
                    ) : null}
                  </div>
                </div>
              ),
            },
            {
              id: 'kind',
              header: t('customers.field.kind'),
              cell: (customer) => <span className="text-sm">{t(KIND_LABEL[customer.kind])}</span>,
            },
            {
              id: 'plan',
              header: t('customers.col.plan'),
              cell: (customer) => <Badge tone="neutral">{planName(customer.plan)}</Badge>,
            },
            {
              id: 'seats',
              header: t('customers.col.seats'),
              cell: (customer) => <span className="tabular-nums text-sm">{seats(customer)}</span>,
            },
            {
              id: 'owner',
              header: t('customers.col.owner'),
              cell: (customer) =>
                customer.owner_name ? (
                  <PersonCell
                    name={customer.owner_name}
                    email={customer.owner_phone ?? undefined}
                    mark
                    size="sm"
                  />
                ) : (
                  <Dash />
                ),
            },
            {
              id: 'status',
              header: t('customers.col.status'),
              cell: (customer) => (
                <Badge tone={statusTone(customer.status)}>{t(statusLabel(customer.status))}</Badge>
              ),
            },
            {
              id: 'created',
              header: t('customers.col.created'),
              sortable: true,
              getSortValue: (customer) => customer.created_at,
              cell: (customer) => (
                <span className="tabular-nums text-sm">{createdDate(customer.created_at)}</span>
              ),
            },
          ]}
          empty={
            <ConsoleEmptyState
              variant={
                q.trim() || plan !== 'all' || status !== 'all' || activeChannelId !== 'all' || regionPath.length > 0
                  ? 'no-match'
                  : 'no-data'
              }
              title={t('customers.emptyTitle')}
              description={t('customers.emptyBody')}
            />
          }
        />
      )}
    </AdminPageShell>
  );
}
