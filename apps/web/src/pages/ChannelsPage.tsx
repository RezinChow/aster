import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, ConsoleEmptyState, Input, ListToolbar, PersonCell, SearchSelect, useToast } from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { AdminPageShell } from '@/components/AdminPageShell';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import { ListRowAction, ListRowActions } from '@/components/ListRowActions';
import { IconChevronRight, IconEdit, IconPlus, IconUser } from '@/components/UiIcons';
import { channelCoverageLabel } from '@/data/channelCoverage';
import {
  CHANNEL_LEVELS,
  isChannelLevel,
  listChannelPartnerRows,
  type ChannelLevel,
  type ChannelPartner,
  type ChannelPartnerStatus,
} from '@/data/channelPartners';
import {
  loadLevelShares,
  loadPartnerShares,
  parseShare,
  savePartnerShare,
} from '@/data/channelShares';
import { listCloudOrganizations, ensureCloudOrganizationWorkspace } from '@/lib/cloudApi';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { ChannelCreateDialog } from '@/pages/channels/ChannelCreateDialog';
import { ChannelPartnerDialog } from '@/pages/channels/ChannelPartnerDialog';
import { levelLabel } from '@/pages/channels/ChannelTerritoryFields';
import { PartnerLogo } from '@/pages/channels/PartnerLogo';

const STATUS_LABEL: Record<ChannelPartnerStatus, MessageKey> = {
  active: 'channels.partnerStatus.active',
  inactive: 'channels.partnerStatus.inactive',
};

function createdLabel(value: string): string {
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : value;
}

function websiteHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return value.replace(/^https?:\/\//, '');
  }
}

function Dash() {
  return <span className="text-ink-faint">—</span>;
}

function hasGivenName(name: string, phone: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (phone && trimmed === phone.trim()) return false;
  if (trimmed.includes('@')) return false;
  if (/^\d+$/.test(trimmed)) return false;
  return true;
}

function ContactCell({
  name,
  email,
  phone,
}: {
  name: string;
  email: string;
  phone: string;
}) {
  const primary = name.trim() || phone.trim() || email.trim();
  if (!primary) return <Dash />;
  const secondary =
    name.trim() && phone.trim() && name.trim() !== phone.trim()
      ? phone.trim()
      : name.trim() && email.trim()
        ? email.trim()
        : '';
  if (!hasGivenName(name, phone)) {
    return (
      <div className="inline-flex min-w-0 items-center gap-1.5">
        <span className="ui-person-cell__mark ui-person-cell__mark--sm" aria-hidden>
          <IconUser width={14} height={14} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-ink">{primary}</div>
          {secondary ? (
            <div className="truncate text-[11px] text-ink-faint">{secondary}</div>
          ) : null}
        </div>
      </div>
    );
  }
  return <PersonCell name={name.trim()} email={secondary || null} mark size="sm" />;
}

function ExtraShareCell({
  name,
  level,
  value,
  onChange,
  onCommit,
}: {
  name: string;
  level: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
}) {
  const { t } = useI18n();
  const levelShare = isChannelLevel(level) ? loadLevelShares()[level] : '';
  return (
    <div
      className="flex w-28 items-center gap-1.5"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Input
        size="sm"
        inputMode="decimal"
        value={value}
        placeholder={levelShare || t('channels.levels.overridePlaceholder')}
        aria-label={`${name} ${t('channels.col.extraShare')}`}
        className="text-end tabular-nums"
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onCommit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      <span className="text-sm text-ink-muted">%</span>
    </div>
  );
}

export function ChannelsPage() {
  const { locale, t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | ChannelLevel>('all');
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ChannelPartner | null>(null);
  const [tick, setTick] = useState(0);
  const [organizations, setOrganizations] = useState<
    { id: string; name: string; createdAt: string }[]
  >([]);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [extraShares, setExtraShares] = useState<Record<string, string>>(() => loadPartnerShares());

  const reloadCloud = useCallback(async () => {
    setLoading(true);
    setExtraShares(loadPartnerShares());
    setTick((value) => value + 1);
    try {
      const next = await listCloudOrganizations();
      setOrganizations(next);
      setCloudError(null);
      void Promise.allSettled(next.map((org) => ensureCloudOrganizationWorkspace(org.id)));
    } catch (error: unknown) {
      setOrganizations([]);
      setCloudError(error instanceof Error ? error.message : t('admin.error.title'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await listCloudOrganizations();
        if (cancelled) return;
        setOrganizations(next);
        setCloudError(null);
        // Official operator: provision Project `default` + Env `production` per channel.
        await Promise.allSettled(
          next.map((org) => ensureCloudOrganizationWorkspace(org.id)),
        );
      } catch (error: unknown) {
        if (cancelled) return;
        setOrganizations([]);
        setCloudError(error instanceof Error ? error.message : t('admin.error.title'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const partners = useMemo(() => {
    void tick;
    return listChannelPartnerRows(organizations);
  }, [organizations, tick]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return partners.filter((row) => {
      if (levelFilter !== 'all' && row.level !== levelFilter) return false;
      if (!needle) return true;
      return [
        row.id,
        row.name,
        row.legalName,
        row.website,
        row.region,
        row.industry,
        row.level,
        levelLabel(row.level, t),
        channelCoverageLabel(row, locale, t('channels.field.nationwide')),
        ...row.territories.flatMap((item) => [item.province, item.city, item.county]),
        row.contactName,
        row.contactEmail,
        row.phone,
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [levelFilter, locale, partners, q, t]);

  const filtersActive = q.trim() !== '' || levelFilter !== 'all';

  function openCreate() {
    setCreateOpen(true);
  }

  function changeExtraShare(id: string, value: string) {
    setExtraShares((current) => ({ ...current, [id]: value }));
  }

  function commitExtraShare(id: string, value: string) {
    const parsed = parseShare(value);
    if (parsed === 'invalid' || savePartnerShare(id, value) === 'invalid') {
      toast.push({ tone: 'danger', title: t('channels.levels.invalid') });
      setExtraShares(loadPartnerShares());
      return;
    }
    setExtraShares(loadPartnerShares());
  }

  function territory(row: ChannelPartner): string {
    return channelCoverageLabel(row, locale, t('channels.field.nationwide'));
  }

  return (
    <AdminPageShell
      title={t('channels.title')}
      description={t('channels.description')}
    >
      {cloudError ? (
        <AppErrorBanner className="mb-3" message={cloudError} onRetry={reloadCloud} />
      ) : null}
      <ListToolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t('channels.search')}
        filters={
          <SearchSelect
            size="sm"
            searchable={false}
            allowClear={false}
            className="w-36"
            aria-label={t('channels.filter.level')}
            value={levelFilter}
            onChange={(value) => {
              setLevelFilter(isChannelLevel(value) ? value : 'all');
              setExpandedId(null);
            }}
            options={[
              { value: 'all', label: t('channels.filter.allLevels') },
              ...CHANNEL_LEVELS.map((value) => ({
                value,
                label: levelLabel(value, t),
              })),
            ]}
          />
        }
        secondaryActions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => navigate('/admin/channels/levels')}
          >
            {t('channels.levels.action')}
          </Button>
        }
        primaryAction={
          <Button type="button" size="sm" onClick={openCreate}>
            <IconPlus />
            {t('channels.add')}
          </Button>
        }
      />
      <I18nDataTable
        rows={rows}
        rowKey={(row) => row.id}
        loading={loading}
        onRefresh={() => reloadCloud()}
        defaultPagination={{ page: 1, pageSize: 10 }}
        pageSizeOptions={[10, 20, 50]}
        expandedRowKey={expandedId}
        onExpandedRowChange={setExpandedId}
        renderExpanded={(row) => (
            <dl className="os-work-expand">
              <div>
                <dt>{t('channels.col.tenant')}</dt>
                <dd className="font-mono text-xs">{row.id}</dd>
              </div>
              <div>
                <dt>{t('channels.field.level')}</dt>
                <dd>{levelLabel(row.level, t) || <Dash />}</dd>
              </div>
              <div>
                <dt>{t('channels.field.region')}</dt>
                <dd>{territory(row) || <Dash />}</dd>
              </div>
              <div>
                <dt>{t('channels.field.legalName')}</dt>
                <dd>{row.legalName || <Dash />}</dd>
              </div>
              <div>
                <dt>{t('channels.field.website')}</dt>
                <dd>
                  {row.website ? (
                    <a
                      href={row.website}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {websiteHost(row.website)}
                    </a>
                  ) : (
                    <Dash />
                  )}
                </dd>
              </div>
              <div>
                <dt>{t('channels.field.industry')}</dt>
                <dd>{row.industry || <Dash />}</dd>
              </div>
              <div>
                <dt>{t('channels.field.phone')}</dt>
                <dd>{row.phone || <Dash />}</dd>
              </div>
              <div>
                <dt>{t('channels.field.notes')}</dt>
                <dd>{row.notes || <Dash />}</dd>
              </div>
            </dl>
          )}
        columns={[
          {
            id: 'name',
            header: t('channels.col.name'),
            sortable: true,
            getSortValue: (row) => row.name,
            cell: (row) => (
              <div className="flex min-w-0 items-center gap-2.5">
                <PartnerLogo name={row.name} logoUrl={row.logoUrl} />
                <div className="min-w-0">
                  <Link
                    to={`/admin/channels/${row.id}`}
                    className="block truncate text-sm font-medium text-ink hover:opacity-80"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {row.name || <Dash />}
                  </Link>
                  {row.legalName || row.website ? (
                    <div className="truncate text-[11px] text-ink-faint">
                      {row.legalName || websiteHost(row.website)}
                    </div>
                  ) : null}
                  <div className="truncate font-mono text-[11px] text-ink-faint">{row.id}</div>
                </div>
              </div>
            ),
          },
          {
            id: 'region',
            header: t('channels.col.region'),
            sortable: true,
            getSortValue: (row) => territory(row),
            cell: (row) => {
              const label = territory(row);
              return label ? <span className="text-sm">{label}</span> : <Dash />;
            },
          },
          {
            id: 'level',
            header: t('channels.field.level'),
            sortable: true,
            getSortValue: (row) => row.level,
            cell: (row) => {
              const label = levelLabel(row.level, t);
              return label ? <span className="text-sm">{label}</span> : <Dash />;
            },
          },
          {
            id: 'extraShare',
            header: t('channels.col.extraShare'),
            width: '9.5rem',
            cell: (row) => (
              <ExtraShareCell
                name={row.name}
                level={row.level}
                value={extraShares[row.id] ?? ''}
                onChange={(value) => changeExtraShare(row.id, value)}
                onCommit={(value) => commitExtraShare(row.id, value)}
              />
            ),
          },
          {
            id: 'contact',
            header: t('channels.col.contact'),
            cell: (row) => (
              <ContactCell name={row.contactName} email={row.contactEmail} phone={row.phone} />
            ),
          },
          {
            id: 'status',
            header: t('channels.field.status'),
            sortable: true,
            getSortValue: (row) => row.status ?? '',
            cell: (row) =>
              row.status ? (
                <Badge tone={row.status === 'active' ? 'success' : 'neutral'}>
                  {t(STATUS_LABEL[row.status])}
                </Badge>
              ) : (
                <Dash />
              ),
          },
          {
            id: 'created',
            header: t('channels.col.created'),
            sortable: true,
            getSortValue: (row) => row.createdAt,
            cell: (row) =>
              row.createdAt ? (
                <span className="tabular-nums text-sm">{createdLabel(row.createdAt)}</span>
              ) : (
                <Dash />
              ),
          },
        ]}
        rowActions={(row) => (
          <ListRowActions>
            <ListRowAction
              iconOnly
              icon={<IconEdit />}
              aria-label={t('channels.form.editTitle')}
              onClick={() => {
                setEditing(row);
                setEditorOpen(true);
              }}
            />
            <ListRowAction
              iconOnly
              icon={<IconChevronRight />}
              aria-label={t('channels.action.open')}
              onClick={() => navigate(`/admin/channels/${row.id}`)}
            />
          </ListRowActions>
        )}
        empty={
          <ConsoleEmptyState
            variant={filtersActive ? 'no-match' : 'no-data'}
            title={filtersActive ? t('admin.empty.title') : t('channels.empty.title')}
            description={
              filtersActive ? t('admin.empty.description') : t('channels.empty.description')
            }
            clearFiltersLabel={t('admin.empty.clearFilters')}
            onClearFilters={
              filtersActive
                ? () => {
                    setQ('');
                    setLevelFilter('all');
                  }
                : undefined
            }
            action={
              filtersActive ? undefined : (
                <Button type="button" size="sm" onClick={openCreate}>
                  <IconPlus />
                  {t('channels.add')}
                </Button>
              )
            }
          />
        }
      />

      <ChannelCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => setTick((value) => value + 1)}
      />
      <ChannelPartnerDialog
        open={editorOpen}
        partner={editing}
        onOpenChange={setEditorOpen}
        onSaved={() => setTick((value) => value + 1)}
      />
    </AdminPageShell>
  );
}
