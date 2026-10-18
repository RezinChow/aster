import { useEffect, useState } from 'react';
import { Alert, Badge, Button, FilterChip, Tabs, TabsList, TabsTrigger, cn } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import {
  getBootstrapCatalog,
  type BootstrapItem,
  type BootstrapService,
} from '@/lib/configApi';
import {
  ConfigToolbar,
  CopyAction,
  EmptyNote,
  GroupCard,
  ListSkeleton,
  fill,
  sectionAnchor,
} from '@/pages/settings/configKit';
import { ConfigIcon, groupIcon, type ConfigIconName } from '@/pages/settings/configIcons';

type Translate = (key: MessageKey) => string;
type SourceFilter = 'all' | 'env' | 'default' | 'attention';

const FILTER_ICONS: Record<SourceFilter, ConfigIconName> = {
  all: 'layers',
  env: 'terminal',
  default: 'settings',
  attention: 'alert',
};

function isUnset(value: unknown) {
  return value === null || value === undefined || value === '';
}

/** A secret still on its built-in value: worth replacing before production. */
function onDevDefault(item: BootstrapItem) {
  return item.sensitive && !item.configured && typeof item.value === 'string' && item.value !== '';
}

function needsAttention(item: BootstrapItem) {
  return onDevDefault(item) || (item.required === true && isUnset(item.value));
}

function matchesQuery(item: BootstrapItem, query: string) {
  if (!query) return true;
  return [item.key, item.label, item.description, ...(item.aliases ?? [])]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

function matchesSource(item: BootstrapItem, filter: SourceFilter) {
  switch (filter) {
    case 'env':
      return item.configured;
    case 'default':
      return !item.configured;
    case 'attention':
      return needsAttention(item);
    default:
      return true;
  }
}

function allItems(service: BootstrapService) {
  return service.groups.flatMap((group) => group.items);
}

function ItemValue({ t, item }: { t: Translate; item: BootstrapItem }) {
  const { value } = item;
  if (isUnset(value)) {
    return <span className="text-[13px] text-ink-faint">{t('settings.bootstrap.unset')}</span>;
  }
  if (typeof value === 'boolean') {
    return (
      <span className="text-[13px] text-ink">
        {value ? t('settings.bootstrap.on') : t('settings.bootstrap.off')}
      </span>
    );
  }
  if (item.sensitive) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-ink">
        <ConfigIcon name="lock" size={14} className="text-ink-muted" />
        {t('settings.bootstrap.secretSet')}
        <span className="font-mono text-[12px] tracking-[0.08em] text-ink-faint">{String(value)}</span>
      </span>
    );
  }
  return (
    <code className="min-w-0 break-all font-mono text-[12px] leading-5 text-ink">
      {typeof value === 'string' ? value : JSON.stringify(value)}
    </code>
  );
}

function copyText(item: BootstrapItem) {
  const { value } = item;
  if (item.sensitive || isUnset(value) || typeof value === 'boolean') return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function ItemRow({ t, item }: { t: Translate; item: BootstrapItem }) {
  const copy = copyText(item);
  const missing = item.required === true && isUnset(item.value);
  return (
    <li className="group grid gap-x-6 gap-y-2 px-4 py-3 transition-colors hover:bg-surface-2 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-medium text-ink">{item.label}</span>
          {item.required ? <Badge>{t('settings.bootstrap.required')}</Badge> : null}
        </div>
        <code className="break-all font-mono text-[12px] leading-5 text-ink-muted">
          {item.key}
          {item.aliases?.length ? (
            <span className="text-ink-faint">
              {' · '}
              {t('settings.bootstrap.alias')} {item.aliases.join(', ')}
            </span>
          ) : null}
        </code>
        {item.description ? (
          <p className="text-[12px] leading-5 text-ink-faint">{item.description}</p>
        ) : null}
      </div>
      <div className="flex min-w-0 items-start gap-2 md:justify-end">
        <div className="flex min-w-0 flex-col gap-1 md:items-end md:text-right">
          <ItemValue t={t} item={item} />
          <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[12px]',
                item.configured ? 'text-ink-muted' : 'text-ink-faint',
              )}
            >
              <ConfigIcon name={item.configured ? 'terminal' : 'settings'} size={12} />
              {item.configured ? t('settings.bootstrap.fromEnv') : t('settings.bootstrap.fromDefault')}
            </span>
            {onDevDefault(item) ? (
              <Badge tone="danger" title={t('settings.bootstrap.devDefaultHint')}>
                {t('settings.bootstrap.devDefault')}
              </Badge>
            ) : null}
            {missing ? <Badge tone="danger">{t('settings.bootstrap.requiredUnset')}</Badge> : null}
          </div>
        </div>
        {copy ? (
          <CopyAction
            value={copy}
            label={`${t('settings.bootstrap.copy')} ${item.key}`}
            copiedLabel={t('settings.bootstrap.copied')}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          />
        ) : (
          <span className="size-6 shrink-0" aria-hidden />
        )}
      </div>
    </li>
  );
}

function ServicePanel({
  t,
  service,
  query,
  filter,
  onFilter,
  onRetry,
}: {
  t: Translate;
  service: BootstrapService;
  query: string;
  filter: SourceFilter;
  onFilter: (next: SourceFilter) => void;
  onRetry: () => void;
}) {
  if (service.error) {
    return (
      <Alert tone="danger" title={t('settings.bootstrap.unreachable')}>
        <p className="break-all">{service.error}</p>
        <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onRetry}>
          {t('settings.bootstrap.retry')}
        </Button>
      </Alert>
    );
  }

  const items = allItems(service);
  const attention = items.filter(needsAttention);
  const counts: Record<SourceFilter, number> = {
    all: items.length,
    env: items.filter((item) => item.configured).length,
    default: items.filter((item) => !item.configured).length,
    attention: attention.length,
  };
  const filters: SourceFilter[] =
    attention.length > 0 ? ['all', 'env', 'default', 'attention'] : ['all', 'env', 'default'];
  const groups = service.groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => matchesSource(item, filter) && matchesQuery(item, query)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-5">
      {attention.length > 0 && filter !== 'attention' ? (
        <Alert tone="warn">
          <div className="flex items-start gap-2">
            <ConfigIcon name="alert" className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">
                {fill(t('settings.bootstrap.attention.title'), { n: attention.length })}
              </p>
              <p>{t('settings.bootstrap.attention.body')}</p>
              <button
                type="button"
                className="mt-1 text-[13px] font-medium underline-offset-2 hover:underline"
                onClick={() => onFilter('attention')}
              >
                {t('settings.bootstrap.attention.show')}
              </button>
            </div>
          </div>
        </Alert>
      ) : null}
      <div
        role="group"
        aria-label={t('settings.bootstrap.filter.label')}
        className="flex flex-wrap gap-0.5"
      >
        {filters.map((id) => (
          <FilterChip
            key={id}
            label={t(`settings.bootstrap.filter.${id}`)}
            icon={<ConfigIcon name={FILTER_ICONS[id]} />}
            count={counts[id]}
            active={filter === id}
            onClick={() => onFilter(id)}
          />
        ))}
      </div>
      {groups.length === 0 ? (
        <EmptyNote>{t('settings.bootstrap.noMatch')}</EmptyNote>
      ) : (
        groups.map((group) => (
          <GroupCard
            key={group.id}
            anchor={sectionAnchor(`bootstrap-${service.id}`, group.id)}
            title={group.label}
            icon={groupIcon(group.id)}
            meta={fill(t('settings.bootstrap.groupCount'), { n: group.items.length })}
          >
            {group.items.map((item) => (
              <ItemRow key={item.key} t={t} item={item} />
            ))}
          </GroupCard>
        ))
      )}
    </div>
  );
}

/** Startup environment of each process, read-only; edited only through `.env` / orchestration. */
export function BootstrapSection() {
  const { t } = useI18n();
  const [services, setServices] = useState<BootstrapService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [serviceId, setServiceId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      setServices(await getBootstrapCatalog());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const active = services.find((service) => service.id === serviceId) ?? services[0];
  const needle = query.trim().toLowerCase();

  return (
    <div className="flex flex-col gap-5">
      <p className="flex max-w-2xl items-start gap-2 text-[13px] leading-5 text-ink-faint">
        <ConfigIcon name="info" className="mt-0.5 shrink-0" />
        {t('settings.bootstrap.hint')}
      </p>
      <Tabs
        value={active?.id ?? ''}
        onValueChange={(next) => {
          setServiceId(next);
          setFilter('all');
        }}
      >
        <ConfigToolbar
          leading={
            services.length > 0 ? (
              <TabsList aria-label={t('settings.bootstrap.services')}>
                {services.map((service) => (
                  <TabsTrigger key={service.id} value={service.id} className="gap-1.5">
                    {service.label}
                    <span
                      className={cn(
                        'tabular-nums text-[12px] font-normal',
                        service.error ? 'text-[color:var(--color-danger-text)]' : 'text-ink-faint',
                      )}
                    >
                      {service.error ? '!' : allItems(service).length}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            ) : null
          }
          query={query}
          onQuery={setQuery}
          searchLabel={t('settings.bootstrap.search')}
          refreshLabel={t('settings.entries.refresh')}
          refreshing={loading}
          onRefresh={() => reload()}
        />
      </Tabs>
      {error ? (
        <Alert tone="danger">
          <p className="break-all">{error}</p>
        </Alert>
      ) : null}
      {loading && services.length === 0 ? (
        <ListSkeleton />
      ) : active ? (
        <ServicePanel
          key={active.id}
          t={t}
          service={active}
          query={needle}
          filter={filter}
          onFilter={setFilter}
          onRetry={() => void reload()}
        />
      ) : null}
    </div>
  );
}
