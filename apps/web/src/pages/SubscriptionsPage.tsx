import { useMemo, useState, type FormEvent } from 'react';
import {
  Badge,
  Button,
  DescriptionList,
  ConsoleDrawer,
  ConsoleEmptyState,
  FormDialog,
  ConsoleFormField,
  Input,
  ListToolbar,
  SearchSelect,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  ConsoleTextarea,
  useToast,
  type BadgeTone,
} from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { AdminPageShell } from '@/components/AdminPageShell';
import { ListRowAction, ListRowActions } from '@/components/ListRowActions';
import { IconEdit } from '@/components/UiIcons';
import {
  listPlans,
  updatePlan,
  type CatalogPlan,
  type PlanId,
  type PlanMeter,
  type PlanPrices,
  type PlanUnit,
} from '@/data/subscriptions';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import type { Locale } from '@/prefs/store';

type Draft = {
  audienceZh: string;
  audienceEn: string;
  descriptionZh: string;
  descriptionEn: string;
  featuresZh: string;
  featuresEn: string;
  includesZh: string;
  includesEn: string;
  highlighted: boolean;
  custom: boolean;
  unit: 'none' | PlanUnit;
  meter: 'none' | PlanMeter;
  cnyMonthly: string;
  cnyAnnual: string;
  usdMonthly: string;
  usdAnnual: string;
};

type KindFilter = 'all' | 'listed' | 'custom';

/** Long enough for the toolbar icon to paint a spin before the local catalog returns. */
const REFRESH_FLOOR_MS = 400;

function lines(value: string): string[] {
  return value.split('\n');
}

function joinLines(value: string[]): string {
  return value.join('\n');
}

function formatAmount(amount: number, currency: 'CNY' | 'USD'): string {
  const text = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return currency === 'CNY' ? `¥${text}` : `$${text}`;
}

function priceText(
  prices: PlanPrices,
  interval: 'monthly' | 'annual',
  currency: 'CNY' | 'USD',
  customLabel: string,
): string {
  const amount = prices[interval];
  if (amount == null) return customLabel;
  return formatAmount(amount, currency);
}

function parseListed(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return undefined;
  return Number(trimmed);
}

function draftFrom(plan: CatalogPlan): Draft {
  return {
    audienceZh: plan.audience.zh,
    audienceEn: plan.audience.en,
    descriptionZh: plan.description.zh,
    descriptionEn: plan.description.en,
    featuresZh: joinLines(plan.features.zh),
    featuresEn: joinLines(plan.features.en),
    includesZh: joinLines(plan.includes.zh),
    includesEn: joinLines(plan.includes.en),
    highlighted: plan.highlighted,
    custom: plan.custom,
    unit: plan.unit ?? 'none',
    meter: plan.meter ?? 'none',
    cnyMonthly: plan.cny.monthly == null ? '' : String(plan.cny.monthly),
    cnyAnnual: plan.cny.annual == null ? '' : String(plan.cny.annual),
    usdMonthly: plan.usd.monthly == null ? '' : String(plan.usd.monthly),
    usdAnnual: plan.usd.annual == null ? '' : String(plan.usd.annual),
  };
}

function copyOf(locale: Locale, copy: { zh: string; en: string }): string {
  return copy[locale];
}

function matchesKind(plan: CatalogPlan, kind: KindFilter): boolean {
  if (kind === 'listed') return !plan.custom;
  if (kind === 'custom') return plan.custom;
  return true;
}

function statusOf(plan: CatalogPlan): {
  label: MessageKey;
  tone: BadgeTone;
} {
  if (plan.custom) {
    return { label: 'subscriptions.price.custom', tone: 'neutral' };
  }
  if (plan.highlighted) {
    return { label: 'subscriptions.highlighted', tone: 'primary' };
  }
  return { label: 'subscriptions.status.listed', tone: 'success' };
}

export function SubscriptionsPage() {
  const { locale, t } = useI18n();
  const toast = useToast();
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [selectedId, setSelectedId] = useState<PlanId | null>(null);
  const [editing, setEditing] = useState<CatalogPlan | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const all = useMemo(() => {
    void tick;
    return listPlans();
  }, [tick]);

  const counts = useMemo(
    () => ({
      all: all.length,
      listed: all.filter((plan) => !plan.custom).length,
      custom: all.filter((plan) => plan.custom).length,
    }),
    [all],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((plan) => {
      if (!matchesKind(plan, kind)) return false;
      if (!needle) return true;
      const blob = [
        plan.id,
        plan.name,
        plan.audience.zh,
        plan.audience.en,
        plan.description.zh,
        plan.description.en,
        ...plan.features.zh,
        ...plan.features.en,
        ...plan.includes.zh,
        ...plan.includes.en,
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(needle);
    });
  }, [all, kind, q]);

  const selected = all.find((plan) => plan.id === selectedId) ?? null;
  const filtersActive = q.trim() !== '' || kind !== 'all';
  const customLabel = t('subscriptions.price.custom');
  const listCurrency = locale === 'zh' ? 'CNY' : 'USD';

  function reloadPlans() {
    setTick((n) => n + 1);
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, REFRESH_FLOOR_MS);
    });
  }

  function openEdit(plan: CatalogPlan) {
    setDraft(draftFrom(plan));
    setEditing(plan);
  }

  function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !draft) return;
    const custom = draft.custom;
    const cnyMonthly = custom ? null : parseListed(draft.cnyMonthly);
    const cnyAnnual = custom ? null : parseListed(draft.cnyAnnual);
    const usdMonthly = custom ? null : parseListed(draft.usdMonthly);
    const usdAnnual = custom ? null : parseListed(draft.usdAnnual);
    if (
      !custom &&
      (cnyMonthly == null ||
        cnyAnnual == null ||
        usdMonthly == null ||
        usdAnnual == null)
    ) {
      toast.push({
        title: t('subscriptions.toast.invalidPrice'),
        tone: 'danger',
      });
      return;
    }
    const updated = updatePlan(editing.id, {
      audience: { zh: draft.audienceZh, en: draft.audienceEn },
      description: { zh: draft.descriptionZh, en: draft.descriptionEn },
      features: { zh: lines(draft.featuresZh), en: lines(draft.featuresEn) },
      includes: { zh: lines(draft.includesZh), en: lines(draft.includesEn) },
      unit: draft.unit === 'none' ? null : draft.unit,
      meter: draft.meter === 'none' ? null : draft.meter,
      highlighted: draft.highlighted,
      custom,
      cny: { monthly: cnyMonthly ?? null, annual: cnyAnnual ?? null },
      usd: { monthly: usdMonthly ?? null, annual: usdAnnual ?? null },
    });
    if (!updated) {
      toast.push({ title: t('subscriptions.toast.failed'), tone: 'danger' });
      return;
    }
    setTick((n) => n + 1);
    setEditing(null);
    toast.push({ title: t('subscriptions.toast.saved'), tone: 'success' });
  }

  return (
    <AdminPageShell
      title={t('nav.subscriptions')}
      description={t('subscriptions.description')}
    >
      <ListToolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t('subscriptions.search')}
      />

      <Tabs
        value={kind}
        onValueChange={(value) => setKind(value as KindFilter)}
        className="gap-0"
      >
        <TabsList
          className="os-market-shelf-tabs"
          aria-label={t('subscriptions.filter.label')}
        >
          {(
            [
              ['all', 'subscriptions.filter.all', counts.all],
              ['listed', 'subscriptions.filter.listed', counts.listed],
              ['custom', 'subscriptions.filter.custom', counts.custom],
            ] as const
          ).map(([value, labelKey, count]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="os-market-shelf-tab !h-auto !rounded-none !bg-transparent !px-3.5 !py-2.5 !shadow-none"
            >
              {t(labelKey)}
              <span className="os-market-shelf-tab__count tabular-nums">
                {count}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <I18nDataTable
        rows={rows}
        rowKey={(plan) => plan.id}
        defaultPagination={{ page: 1, pageSize: 10 }}
        pageSizeOptions={[10, 20, 50]}
        onRefresh={reloadPlans}
        onRowClick={(plan) => setSelectedId(plan.id)}
        columns={[
          {
            id: 'name',
            header: t('subscriptions.col.plan'),
            sortable: true,
            getSortValue: (plan) => plan.name,
            cell: (plan) => (
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">
                  {plan.name}
                </div>
                <div className="truncate font-mono text-[11px] text-ink-faint">
                  {plan.id}
                </div>
              </div>
            ),
          },
          {
            id: 'audience',
            header: t('subscriptions.col.audience'),
            cell: (plan) => (
              <span className="text-sm text-ink">
                {copyOf(locale, plan.audience)}
              </span>
            ),
          },
          {
            id: 'price',
            header: t('subscriptions.col.price'),
            sortable: true,
            getSortValue: (plan) => {
              const prices = listCurrency === 'CNY' ? plan.cny : plan.usd;
              return prices.monthly ?? Number.POSITIVE_INFINITY;
            },
            cell: (plan) => {
              const prices = listCurrency === 'CNY' ? plan.cny : plan.usd;
              const monthly = priceText(
                prices,
                'monthly',
                listCurrency,
                customLabel,
              );
              const annual =
                plan.custom || prices.annual == null
                  ? null
                  : formatAmount(prices.annual, listCurrency);
              return (
                <div>
                  <div className="tabular-nums text-sm font-medium text-ink">
                    {monthly}
                  </div>
                  {annual ? (
                    <div className="tabular-nums text-[11px] text-ink-faint">
                      {t('subscriptions.price.annual')} {annual}
                    </div>
                  ) : null}
                </div>
              );
            },
          },
          {
            id: 'status',
            header: t('subscriptions.col.status'),
            cell: (plan) => {
              const status = statusOf(plan);
              return (
                <Badge tone={status.tone} className="shrink-0">
                  {t(status.label)}
                </Badge>
              );
            },
          },
        ]}
        rowActions={(plan) => (
          <ListRowActions>
            <ListRowAction
              iconOnly
              icon={<IconEdit />}
              aria-label={t('subscriptions.action.edit')}
              onClick={(event) => {
                event.stopPropagation();
                openEdit(plan);
              }}
            />
          </ListRowActions>
        )}
        empty={
          <ConsoleEmptyState
            variant={filtersActive ? 'no-match' : 'no-data'}
            title={
              filtersActive
                ? t('admin.empty.title')
                : t('subscriptions.emptyTitle')
            }
            description={
              filtersActive
                ? t('admin.empty.description')
                : t('subscriptions.emptyBody')
            }
            clearFiltersLabel={t('admin.empty.clearFilters')}
            onClearFilters={
              filtersActive
                ? () => {
                    setQ('');
                    setKind('all');
                  }
                : undefined
            }
          />
        }
      />

      <ConsoleDrawer
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        title={selected?.name ?? t('nav.subscriptions')}
        description={selected ? copyOf(locale, selected.audience) : undefined}
        className="!w-[min(100%,32rem)]"
        footer={
          selected ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openEdit(selected)}
            >
              <IconEdit />
              {t('subscriptions.action.edit')}
            </Button>
          ) : null
        }
      >
        {selected ? (
          <SubscriptionDetail
            plan={selected}
            locale={locale}
            customLabel={customLabel}
          />
        ) : null}
      </ConsoleDrawer>

      <FormDialog
        open={editing != null && draft != null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        size="lg"
        title={t('subscriptions.edit.title')}
        description={editing?.name}
        closeLabel={t('subscriptions.edit.close')}
        cancelLabel={t('subscriptions.edit.cancel')}
        submitLabel={t('subscriptions.edit.save')}
        onSubmit={onSave}
      >
        {draft ? (
          <div className="space-y-5">
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-ink">
                {t('subscriptions.section.pricing')}
              </h3>
              <div className="flex flex-wrap gap-6">
                <Switch
                  checked={draft.highlighted}
                  onCheckedChange={(highlighted) =>
                    setDraft({ ...draft, highlighted })
                  }
                  label={t('subscriptions.highlighted')}
                />
                <Switch
                  checked={draft.custom}
                  onCheckedChange={(custom) => setDraft({ ...draft, custom })}
                  label={t('subscriptions.custom')}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ConsoleFormField label={t('subscriptions.col.unit')}>
                  <SearchSelect
                    size="sm"
                    searchable={false}
                    allowClear={false}
                    value={draft.unit}
                    onChange={(value) => {
                      if (value === 'none' || value === 'seat_month') {
                        setDraft({ ...draft, unit: value });
                      }
                    }}
                    options={[
                      { value: 'none', label: t('subscriptions.unit.none') },
                      {
                        value: 'seat_month',
                        label: t('subscriptions.unit.seatMonth'),
                      },
                    ]}
                    aria-label={t('subscriptions.col.unit')}
                  />
                </ConsoleFormField>
                <ConsoleFormField label={t('subscriptions.col.meter')}>
                  <SearchSelect
                    size="sm"
                    searchable={false}
                    allowClear={false}
                    value={draft.meter}
                    onChange={(value) => {
                      if (value === 'none' || value === 'os_usage') {
                        setDraft({ ...draft, meter: value });
                      }
                    }}
                    options={[
                      { value: 'none', label: t('subscriptions.meter.none') },
                      {
                        value: 'os_usage',
                        label: t('subscriptions.meter.osUsage'),
                      },
                    ]}
                    aria-label={t('subscriptions.col.meter')}
                  />
                </ConsoleFormField>
              </div>
              {draft.custom ? (
                <p className="text-xs text-ink-muted">
                  {t('subscriptions.edit.customHint')}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ConsoleFormField label={t('subscriptions.col.cnyMonthly')}>
                    <Input
                      value={draft.cnyMonthly}
                      inputMode="decimal"
                      onChange={(event) =>
                        setDraft({ ...draft, cnyMonthly: event.target.value })
                      }
                    />
                  </ConsoleFormField>
                  <ConsoleFormField label={t('subscriptions.col.cnyAnnual')}>
                    <Input
                      value={draft.cnyAnnual}
                      inputMode="decimal"
                      onChange={(event) =>
                        setDraft({ ...draft, cnyAnnual: event.target.value })
                      }
                    />
                  </ConsoleFormField>
                  <ConsoleFormField label={t('subscriptions.col.usdMonthly')}>
                    <Input
                      value={draft.usdMonthly}
                      inputMode="decimal"
                      onChange={(event) =>
                        setDraft({ ...draft, usdMonthly: event.target.value })
                      }
                    />
                  </ConsoleFormField>
                  <ConsoleFormField label={t('subscriptions.col.usdAnnual')}>
                    <Input
                      value={draft.usdAnnual}
                      inputMode="decimal"
                      onChange={(event) =>
                        setDraft({ ...draft, usdAnnual: event.target.value })
                      }
                    />
                  </ConsoleFormField>
                </div>
              )}
            </section>
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-ink">
                {t('subscriptions.section.copy')}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <ConsoleFormField label={t('subscriptions.edit.audienceZh')}>
                  <Input
                    value={draft.audienceZh}
                    onChange={(event) =>
                      setDraft({ ...draft, audienceZh: event.target.value })
                    }
                  />
                </ConsoleFormField>
                <ConsoleFormField label={t('subscriptions.edit.audienceEn')}>
                  <Input
                    value={draft.audienceEn}
                    onChange={(event) =>
                      setDraft({ ...draft, audienceEn: event.target.value })
                    }
                  />
                </ConsoleFormField>
              </div>
              <ConsoleFormField label={t('subscriptions.edit.descriptionZh')}>
                <ConsoleTextarea
                  value={draft.descriptionZh}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      descriptionZh: event.target.value,
                    })
                  }
                />
              </ConsoleFormField>
              <ConsoleFormField label={t('subscriptions.edit.descriptionEn')}>
                <ConsoleTextarea
                  value={draft.descriptionEn}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      descriptionEn: event.target.value,
                    })
                  }
                />
              </ConsoleFormField>
              <ConsoleFormField
                label={t('subscriptions.edit.featuresZh')}
                hint={t('subscriptions.edit.linesHint')}
              >
                <ConsoleTextarea
                  value={draft.featuresZh}
                  onChange={(event) =>
                    setDraft({ ...draft, featuresZh: event.target.value })
                  }
                />
              </ConsoleFormField>
              <ConsoleFormField
                label={t('subscriptions.edit.featuresEn')}
                hint={t('subscriptions.edit.linesHint')}
              >
                <ConsoleTextarea
                  value={draft.featuresEn}
                  onChange={(event) =>
                    setDraft({ ...draft, featuresEn: event.target.value })
                  }
                />
              </ConsoleFormField>
              <ConsoleFormField
                label={t('subscriptions.edit.includesZh')}
                hint={t('subscriptions.edit.linesHint')}
              >
                <ConsoleTextarea
                  value={draft.includesZh}
                  onChange={(event) =>
                    setDraft({ ...draft, includesZh: event.target.value })
                  }
                />
              </ConsoleFormField>
              <ConsoleFormField
                label={t('subscriptions.edit.includesEn')}
                hint={t('subscriptions.edit.linesHint')}
              >
                <ConsoleTextarea
                  value={draft.includesEn}
                  onChange={(event) =>
                    setDraft({ ...draft, includesEn: event.target.value })
                  }
                />
              </ConsoleFormField>
            </section>
          </div>
        ) : null}
      </FormDialog>
    </AdminPageShell>
  );
}

function SubscriptionDetail({
  plan,
  locale,
  customLabel,
}: {
  plan: CatalogPlan;
  locale: Locale;
  customLabel: string;
}) {
  const { t } = useI18n();
  const features = plan.features[locale];
  const includes = plan.includes[locale];
  return (
    <div className="space-y-4">
      <Badge tone={statusOf(plan).tone}>{t(statusOf(plan).label)}</Badge>
      <DescriptionList
        className="!bg-transparent !shadow-none"
        items={[
          {
            label: t('subscriptions.col.description'),
            value: copyOf(locale, plan.description),
          },
          {
            label: t('subscriptions.col.unit'),
            value: plan.unit
              ? t('subscriptions.unit.seatMonth')
              : t('subscriptions.unit.none'),
          },
          {
            label: t('subscriptions.col.meter'),
            value: plan.meter
              ? t('subscriptions.meter.osUsage')
              : t('subscriptions.meter.none'),
          },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ['subscriptions.col.cnyMonthly', plan.cny, 'monthly', 'CNY'],
            ['subscriptions.col.cnyAnnual', plan.cny, 'annual', 'CNY'],
            ['subscriptions.col.usdMonthly', plan.usd, 'monthly', 'USD'],
            ['subscriptions.col.usdAnnual', plan.usd, 'annual', 'USD'],
          ] as const
        ).map(([label, prices, interval, currency]) => (
          <div key={label} className="min-w-0">
            <div className="text-xs text-ink-faint">{t(label)}</div>
            <div className="tabular-nums text-sm font-medium text-ink">
              {priceText(prices, interval, currency, customLabel)}
            </div>
          </div>
        ))}
      </div>
      <section className="space-y-1">
        <h3 className="text-sm font-medium text-ink">
          {t('subscriptions.col.features')}
        </h3>
        {features.length === 0 ? (
          <p className="text-sm text-ink-faint">—</p>
        ) : (
          <ul className="space-y-1 text-sm text-ink">
            {features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-1">
        <h3 className="text-sm font-medium text-ink">
          {t('subscriptions.col.includes')}
        </h3>
        <p className="text-sm text-ink">
          {includes.length === 0 ? '—' : includes.join(' · ')}
        </p>
      </section>
    </div>
  );
}
