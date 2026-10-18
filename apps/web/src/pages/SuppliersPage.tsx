import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  cn,
  ConsoleEmptyState,
  FormDialog,
  ConsoleFormField,
  Input,
  ListToolbar,
  useToast,
} from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { AdminPageShell } from '@/components/AdminPageShell';
import { ProductMediaFields } from '@/components/ProductMediaFields';
import { SupplierAvatar } from '@/components/SupplierAvatar';
import { IconEdit, IconPlus } from '@/components/UiIcons';
import {
  createSupplier,
  defaultAvatarForName,
  isBuiltinSupplier,
  listSuppliers,
  supplierDisplayName,
  type Supplier,
  type SupplierConfig,
} from '@/data/suppliers';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { ModelSuppliersPanel } from '@/pages/modelService/ModelSuppliersPanel';

function createdLabel(value: string): string {
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : value;
}

function configKindLabel(
  config: SupplierConfig,
  t: (key: MessageKey) => string,
): string {
  return config.kind === 'platform'
    ? t('suppliers.config.platform')
    : t('suppliers.config.custom');
}

const rowActionClassName =
  'flex size-6 shrink-0 items-center justify-center rounded-[6px] text-[var(--spec-body)] outline-none hover:bg-[var(--spec-selected-row)] focus-visible:ring-2 focus-visible:ring-black/10';

function SupplierNameCell({
  row,
  locale,
  editLabel,
  builtinLabel,
  onEdit,
}: {
  row: Supplier;
  locale: 'zh' | 'en';
  editLabel: string;
  builtinLabel: string;
  onEdit: () => void;
}) {
  const secondary = locale === 'zh' ? row.names?.en || row.name : row.names?.zh || row.name;
  const builtin = isBuiltinSupplier(row.id);
  return (
    <div className="relative min-w-0">
      <div className="flex min-w-0 items-center gap-2.5 pr-8">
        <SupplierAvatar src={row.avatarUrl} className="size-8 rounded-full" />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="truncate text-sm font-medium text-ink">
              {supplierDisplayName(row, locale)}
            </div>
            {builtin ? <Badge tone="neutral">{builtinLabel}</Badge> : null}
          </div>
          <div className="truncate text-xs text-ink-muted">{secondary}</div>
        </div>
      </div>
      <div
        className={cn(
          'pointer-events-none absolute top-1/2 right-0 z-10 flex -translate-y-1/2 items-center bg-white pr-1 opacity-0',
          'group-focus-within:pointer-events-auto group-focus-within:bg-[var(--spec-hover-row)] group-focus-within:opacity-100',
          'group-hover:pointer-events-auto group-hover:bg-[var(--spec-hover-row)] group-hover:opacity-100',
        )}
      >
        <button
          type="button"
          className={rowActionClassName}
          aria-label={editLabel}
          title={editLabel}
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
        >
          <IconEdit width={14} height={14} />
        </button>
      </div>
    </div>
  );
}

export function SuppliersPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const tab = params.get('tab') === 'models' ? 'models' : 'partners';
  const [q, setQ] = useState('');
  const [tick, setTick] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [avatarCropping, setAvatarCropping] = useState(false);
  const [nameZh, setNameZh] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  const all = useMemo(() => {
    void tick;
    return listSuppliers();
  }, [tick]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matched = needle
      ? all.filter((s) => {
          const zh = (s.names?.zh || s.name).toLowerCase();
          const en = (s.names?.en || s.name).toLowerCase();
          return (
            zh.includes(needle) ||
            en.includes(needle) ||
            s.name.toLowerCase().includes(needle) ||
            (s.websiteUrl?.toLowerCase().includes(needle) ?? false) ||
            s.id.toLowerCase().includes(needle)
          );
        })
      : all;
    return matched.slice().sort((a, b) => {
      const byTime = a.createdAt.localeCompare(b.createdAt);
      if (byTime !== 0) return byTime;
      return supplierDisplayName(a, locale).localeCompare(
        supplierDisplayName(b, locale),
        locale === 'zh' ? 'zh' : 'en',
      );
    });
  }, [all, q, locale]);

  function openCreate() {
    setNameZh('');
    setNameEn('');
    setWebsiteUrl('');
    setAvatarUrl('');
    setAvatarCropping(false);
    setCreateOpen(true);
  }

  async function submitCreate() {
    if (avatarCropping) return;
    const zh = nameZh.trim();
    const en = nameEn.trim();
    if (!zh && !en) {
      toast.push({ title: t('suppliers.create.nameRequired'), tone: 'danger' });
      return;
    }
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 180));
      const label = zh || en;
      const created = createSupplier({
        names: { zh: zh || en, en: en || zh },
        websiteUrl: websiteUrl.trim() || undefined,
        avatarUrl: avatarUrl.trim() || defaultAvatarForName(label),
        config: { kind: 'custom', fields: [], apiKeys: [] },
      });
      setCreateOpen(false);
      setTick((n) => n + 1);
      toast.push({ title: t('suppliers.toast.created'), tone: 'success' });
      navigate(`/admin/suppliers/${created.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshList() {
    setLoading(true);
    try {
      setTick((n) => n + 1);
      await new Promise((resolve) => {
        window.setTimeout(resolve, 0);
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminPageShell
      title={t('suppliers.title')}
      description={t('suppliers.description')}
    >
      {tab === 'models' ? <ModelSuppliersPanel /> : null}
      {tab === 'partners' ? (
      <>
      <ListToolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t('suppliers.search')}
        primaryAction={
          <Button type="button" size="sm" onClick={openCreate}>
            <IconPlus />
            {t('suppliers.cta.add')}
          </Button>
        }
      />

      <I18nDataTable
        rows={rows}
        rowKey={(row) => row.id}
        loading={loading}
        defaultSort={{ id: 'created', direction: 'asc' }}
        onRefresh={() => refreshList()}
        onRowClick={(row) => navigate(`/admin/suppliers/${row.id}`)}
        columns={[
          {
            id: 'name',
            header: t('suppliers.col.name'),
            sortable: true,
            getSortValue: (row: Supplier) =>
              supplierDisplayName(row, locale),
            cell: (row) => (
              <SupplierNameCell
                row={row}
                locale={locale}
                editLabel={t('admin.action.edit')}
                builtinLabel={t('suppliers.badge.builtin')}
                onEdit={() => navigate(`/admin/suppliers/${row.id}`)}
              />
            ),
          },
          {
            id: 'website',
            header: t('suppliers.col.website'),
            cell: (row) =>
              row.websiteUrl ? (
                <a
                  href={row.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-ink hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.websiteUrl.replace(/^https?:\/\//, '')}
                </a>
              ) : (
                <span className="text-sm text-ink-muted">—</span>
              ),
          },
          {
            id: 'config',
            header: t('suppliers.col.config'),
            cell: (row) => (
              <Badge tone="neutral">{configKindLabel(row.config, t)}</Badge>
            ),
          },
          {
            id: 'created',
            header: t('suppliers.col.created'),
            sortable: true,
            getSortValue: (row: Supplier) => row.createdAt,
            cell: (row) => (
              <span className="tabular-nums text-sm">
                {row.createdAt ? createdLabel(row.createdAt) : '—'}
              </span>
            ),
          },
        ]}
        empty={
          <ConsoleEmptyState
            variant={q.trim() ? 'no-match' : 'no-data'}
            title={
              q.trim()
                ? t('admin.empty.title')
                : t('suppliers.empty.title')
            }
            description={
              q.trim()
                ? t('admin.empty.description')
                : t('suppliers.empty.description')
            }
            clearFiltersLabel={t('admin.empty.clearFilters')}
            onClearFilters={q.trim() ? () => setQ('') : undefined}
            action={
              !q.trim() ? (
                <Button type="button" size="sm" onClick={openCreate}>
                  <IconPlus />
                  {t('suppliers.cta.add')}
                </Button>
              ) : undefined
            }
          />
        }
      />

      <FormDialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open && (submitting || avatarCropping)) return;
          if (!open) setAvatarCropping(false);
          setCreateOpen(open);
        }}
        title={
          avatarCropping
            ? t('suppliers.media.cropTitle')
            : t('suppliers.create.title')
        }
        description={
          avatarCropping
            ? t('marketCatalog.media.cropHint')
            : t('suppliers.create.body')
        }
        closeLabel={t('dialog.close')}
        cancelLabel={t('suppliers.cancel')}
        submitLabel={t('suppliers.create.submit')}
        submitting={submitting}
        hideFooter={avatarCropping}
        onSubmit={submitCreate}
      >
        {avatarCropping ? null : (
          <>
            <ConsoleFormField label={t('suppliers.field.nameZh')} required>
              <Input
                value={nameZh}
                onChange={(e) => setNameZh(e.target.value)}
                placeholder={t('suppliers.field.nameZhPlaceholder')}
              />
            </ConsoleFormField>
            <ConsoleFormField label={t('suppliers.field.nameEn')} required>
              <Input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder={t('suppliers.field.nameEnPlaceholder')}
              />
            </ConsoleFormField>
            <ConsoleFormField
              label={t('suppliers.field.website')}
              hint={t('suppliers.field.websiteHint')}
            >
              <Input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://"
              />
            </ConsoleFormField>
          </>
        )}
        <ProductMediaFields
          showCover={false}
          logoShape="round"
          logoUrl={avatarUrl}
          onLogoChange={setAvatarUrl}
          placeholderLogo={
            nameZh.trim() || nameEn.trim()
              ? defaultAvatarForName(nameZh.trim() || nameEn.trim())
              : undefined
          }
          labels={{
            logo: t('suppliers.field.avatar'),
            logoSpec: t('suppliers.media.avatarSpec'),
            logoEmpty: t('suppliers.media.avatarEmpty'),
            cropLogoTitle: t('suppliers.media.cropTitle'),
            hint: t('suppliers.media.hint'),
          }}
          onCroppingChange={setAvatarCropping}
        />
        {avatarCropping ? null : (
          <p className="text-xs text-ink-faint">
            {t('suppliers.create.configNote')}
          </p>
        )}
      </FormDialog>
      </>
      ) : null}
    </AdminPageShell>
  );
}
