/**
 * Ops supplier detail — one partner, four projections.
 *
 * Jobs:
 * 1. Identify the supplier (avatar, name, type, website).
 * 2. Edit profile and relay services as one draft. Member models publish under the model class.
 * 3. Maintain integration config and the API-key pool.
 * The header save is the only write. Discard drops the draft.
 */

import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import {
  Card,
  Badge,
  Button,
  CopyButton,
  DescriptionList,
  ConsoleEmptyState,
  ConsoleFormField,
  Input,
  PopConfirm,
  ResourceMetaHeader,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import {
  IconCheck,
  IconCopy,
  IconPlus,
  IconRotateCcw,
  IconTrash,
  IconX,
} from '@/components/UiIcons';
import { ProductMediaFields } from '@/components/ProductMediaFields';
import { SupplierAvatar } from '@/components/SupplierAvatar';
import {
  PLATFORM_SUPPLIER_ID,
  createEmptySupplierApiKey,
  defaultAvatarForName,
  findSupplier,
  isBuiltinSupplier,
  listSupplierApiKeys,
  resetSupplierApiKeyCalls,
  supplierDisplayName,
  supplierServicesDraft,
  updateSupplier,
  type CustomSupplierConfig,
  type SupplierApiKey,
  type SupplierConfig,
} from '@/data/suppliers';
import { relayServicesEqual, type RelayService, type RelayServiceClass } from '@/data/relayServices';
import { RelayServicesPanel } from '@/pages/supplier/RelayServicesPanel';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { listServiceModels, listSuppliers as listModelSuppliers } from '@/lib/modelServiceApi';
import { RelayModelsPanel } from '@/pages/modelService/RelayModelsPanel';
import { scopedRelaySuppliers } from '@/pages/modelService/relayScope';

type DetailTab = 'profile' | 'relay' | 'config';

/** Draft shape for keys — call counts stay live in the store. */
type DraftApiKey = {
  id: string;
  label: string;
  value: string;
  weight: number;
  enabled: boolean;
  createdAt: string;
};

const SERVICE_CLASS_LABEL: Record<RelayServiceClass, MessageKey> = {
  model: 'suppliers.relay.class.model',
  api: 'suppliers.relay.class.api',
  mcp: 'suppliers.relay.class.mcp',
};

const KNOWN_FIELD_LABEL: Record<string, MessageKey> = {
  baseUrl: 'suppliers.config.known.baseUrl',
  apiKeyHeader: 'suppliers.config.known.apiKeyHeader',
  mcpUrl: 'suppliers.config.known.mcpUrl',
  sandboxBase: 'suppliers.config.known.sandboxBase',
  docsUrl: 'suppliers.config.known.docsUrl',
  defaultRateLimit: 'suppliers.config.known.defaultRateLimit',
};

function configKindLabel(
  config: SupplierConfig,
  t: (key: MessageKey) => string,
): string {
  return config.kind === 'platform'
    ? t('suppliers.config.platform')
    : t('suppliers.config.custom');
}

function normalizeWebsite(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes('.')) return null;
    return withScheme;
  } catch {
    return null;
  }
}

function hostLabel(url: string): string {
  try {
    return new URL(url).host || url.replace(/^https?:\/\//, '');
  } catch {
    return url.replace(/^https?:\/\//, '');
  }
}

function fieldsEqual(
  a: CustomSupplierConfig['fields'],
  b: CustomSupplierConfig['fields'],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((row, i) => {
    const other = b[i];
    if (!other) return false;
    return (
      row.key === other.key &&
      row.value === other.value &&
      Boolean(row.secret) === Boolean(other.secret)
    );
  });
}

function toDraftKeys(keys: SupplierApiKey[] | undefined): DraftApiKey[] {
  return (keys ?? []).map((k) => ({
    id: k.id,
    label: k.label,
    value: k.value,
    weight: k.weight,
    enabled: k.enabled,
    createdAt: k.createdAt,
  }));
}

function draftKeysEqual(a: DraftApiKey[], b: DraftApiKey[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((row, i) => {
    const other = b[i];
    if (!other) return false;
    return (
      row.id === other.id &&
      row.label === other.label &&
      row.value === other.value &&
      row.weight === other.weight &&
      row.enabled === other.enabled
    );
  });
}

export function SupplierDetailPage() {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const toast = useToast();
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<DetailTab>('profile');

  const supplier = useMemo(() => {
    void tick;
    return findSupplier(id);
  }, [id, tick]);

  const liveApiKeys = useMemo(() => {
    void tick;
    return supplier ? listSupplierApiKeys(supplier.id) : [];
  }, [supplier, tick]);

  const liveCallMap = useMemo(() => {
    const map = new Map<string, { callCount: number; lastUsedAt?: string }>();
    for (const k of liveApiKeys) {
      map.set(k.id, { callCount: k.callCount, lastUsedAt: k.lastUsedAt });
    }
    return map;
  }, [liveApiKeys]);

  const [nameZh, setNameZh] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [customFields, setCustomFields] = useState<
    CustomSupplierConfig['fields']
  >([]);
  const [draftKeys, setDraftKeys] = useState<DraftApiKey[]>([]);
  const [services, setServices] = useState<RelayService[]>(() => {
    const current = findSupplier(id);
    return current ? supplierServicesDraft(current) : [];
  });
  const [relayCount, setRelayCount] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = findSupplier(id);
    if (!s) return;
    setNameZh(s.names?.zh || s.name);
    setNameEn(s.names?.en || s.name);
    setWebsiteUrl(s.websiteUrl ?? '');
    setAvatarUrl(s.avatarUrl);
    setRelayCount(0);
    setServices(supplierServicesDraft(s));
    if (s.config.kind === 'custom') {
      setCustomFields(
        s.config.fields.map((f) => ({
          ...f,
          secret: f.secret !== false,
        })),
      );
      setDraftKeys(toDraftKeys(s.config.apiKeys));
    } else {
      setCustomFields([]);
      setDraftKeys([]);
    }
  }, [id]);

  useEffect(() => {
    if (!supplier) return;
    const names = [supplier.name, supplier.names?.zh ?? '', supplier.names?.en ?? ''];
    let cancelled = false;
    Promise.all([listServiceModels(), listModelSuppliers()])
      .then(([models, apiSuppliers]) => {
        if (cancelled) return;
        const ids = new Set(scopedRelaySuppliers(apiSuppliers, names).map((row) => row.id));
        setRelayCount(
          models.filter((model) => model.routes.some((route) => ids.has(route.supplierId))).length,
        );
      })
      .catch(() => {
        if (!cancelled) setRelayCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [supplier]);

  const dirty = useMemo(() => {
    if (!supplier) return false;
    const prevZh = supplier.names?.zh || supplier.name;
    const prevEn = supplier.names?.en || supplier.name;
    if (nameZh.trim() !== prevZh) return true;
    if (nameEn.trim() !== prevEn) return true;
    if ((websiteUrl.trim() || '') !== (supplier.websiteUrl ?? '')) return true;
    if ((avatarUrl.trim() || supplier.avatarUrl) !== supplier.avatarUrl) {
      return true;
    }
    if (supplier.config.kind === 'custom') {
      if (!fieldsEqual(customFields, supplier.config.fields)) return true;
      if (!draftKeysEqual(draftKeys, toDraftKeys(supplier.config.apiKeys))) {
        return true;
      }
    }
    if (
      supplier.config.kind === 'custom' &&
      !relayServicesEqual(services, supplierServicesDraft(supplier))
    ) {
      return true;
    }
    return false;
  }, [
    supplier,
    nameZh,
    nameEn,
    websiteUrl,
    avatarUrl,
    customFields,
    draftKeys,
    services,
  ]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  if (!supplier) {
    return <Navigate to="/admin/suppliers" replace />;
  }

  const isPlatform = supplier.id === PLATFORM_SUPPLIER_ID;
  const displayTitle =
    supplierDisplayName(
      {
        name: nameZh.trim() || nameEn.trim() || supplier.name,
        names: {
          zh: nameZh.trim() || nameEn.trim() || supplier.name,
          en: nameEn.trim() || nameZh.trim() || supplier.name,
        },
      },
      locale,
    ) || supplierDisplayName(supplier, locale);
  const previewAvatar =
    avatarUrl.trim() || defaultAvatarForName(displayTitle || supplier.name);
  const websiteNormalized = normalizeWebsite(websiteUrl);
  const savedWebsite = supplier.websiteUrl;

  function discard() {
    if (!supplier) return;
    setNameZh(supplier.names?.zh || supplier.name);
    setNameEn(supplier.names?.en || supplier.name);
    setWebsiteUrl(supplier.websiteUrl ?? '');
    setAvatarUrl(supplier.avatarUrl);
    setServices(supplierServicesDraft(supplier));
    if (supplier.config.kind === 'custom') {
      setCustomFields(
        supplier.config.fields.map((f) => ({
          ...f,
          secret: f.secret !== false,
        })),
      );
      setDraftKeys(toDraftKeys(supplier.config.apiKeys));
    } else {
      setCustomFields([]);
      setDraftKeys([]);
    }
  }

  function mergeKeysForSave(): SupplierApiKey[] {
    const live = new Map(
      listSupplierApiKeys(supplier!.id).map((k) => [k.id, k] as const),
    );
    return draftKeys
      .filter((k) => k.value.trim().length > 0 || k.label.trim().length > 0)
      .map((k) => {
        const prev = live.get(k.id);
        return {
          id: k.id,
          label: k.label.trim() || k.id.slice(-6),
          value: k.value.trim(),
          weight: Math.max(1, Math.floor(k.weight) || 1),
          enabled: k.enabled,
          callCount: prev?.callCount ?? 0,
          lastUsedAt: prev?.lastUsedAt,
          resetAt: prev?.resetAt,
          createdAt: prev?.createdAt ?? k.createdAt,
        };
      });
  }

  async function save() {
    if (!supplier) return;
    const zh = nameZh.trim();
    const en = nameEn.trim();
    if (!zh && !en) {
      toast.push({ title: t('suppliers.create.nameRequired'), tone: 'danger' });
      setTab('profile');
      return;
    }

    const website = normalizeWebsite(websiteUrl);
    if (websiteUrl.trim() && !website) {
      toast.push({
        title: t('suppliers.field.websiteInvalid'),
        tone: 'danger',
      });
      setTab('profile');
      return;
    }
    let config: SupplierConfig = supplier.config;
    if (supplier.config.kind === 'custom') {
      const keys = customFields.map((f) => f.key.trim()).filter(Boolean);
      const dup = keys.find((k, i) => keys.indexOf(k) !== i);
      if (dup) {
        toast.push({
          title: t('suppliers.config.duplicateKey'),
          tone: 'danger',
        });
        setTab('config');
        return;
      }
      config = {
        kind: 'custom',
        fields: customFields
          .map((f) => ({
            key: f.key.trim(),
            value: f.value,
            secret: Boolean(f.secret),
          }))
          .filter((f) => f.key.length > 0),
        apiKeys: mergeKeysForSave(),
      };
    }

    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 180));
      updateSupplier(supplier.id, {
        names: { zh: zh || en, en: en || zh },
        avatarUrl: avatarUrl.trim() || supplier.avatarUrl,
        websiteUrl: website,
        config,
        ...(supplier.config.kind === 'custom' ? { services } : {}),
      });
      setTick((n) => n + 1);
      toast.push({ title: t('suppliers.toast.saved'), tone: 'success' });
    } finally {
      setSaving(false);
    }
  }

  function handleResetKey(keyId: string) {
    if (!supplier) return;
    const hit = listSupplierApiKeys(supplier.id).find((k) => k.id === keyId);
    if (!hit) {
      // Unsaved draft key — nothing live to reset.
      return;
    }
    resetSupplierApiKeyCalls(supplier.id, keyId);
    setTick((n) => n + 1);
    toast.push({ title: t('suppliers.config.keyResetDone'), tone: 'success' });
  }

  return (
    <AdminPageShell
      title={displayTitle}
      description={t('suppliers.detail.description')}
      backTo="/admin/suppliers"
      crumbs={[
        { label: t('suppliers.title'), to: '/suppliers' },
        { label: displayTitle },
      ]}
      actions={
        <>
          {dirty ? (
            <Button
              size="sm"
              variant="outline"
              type="button"
              disabled={saving}
              onClick={discard}
            >
              <IconX />
              {t('suppliers.cta.discard')}
            </Button>
          ) : null}
          <Button
            size="sm"
            type="button"
            loading={saving}
            disabled={!dirty || saving}
            onClick={() => void save()}
          >
            <IconCheck />
            {dirty ? t('suppliers.cta.save') : t('suppliers.cta.saved')}
          </Button>
        </>
      }
    >
      <ResourceMetaHeader
        title={
          <span className="inline-flex items-center gap-3 min-w-0">
            <SupplierAvatar
              src={previewAvatar}
              className="h-10 w-10 rounded-full ring-1 ring-black/5"
            />
            <span className="truncate">{displayTitle}</span>
          </span>
        }
        badge={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <Badge tone={isPlatform ? 'success' : 'neutral'}>
              {configKindLabel(supplier.config, t)}
            </Badge>
            {isBuiltinSupplier(supplier.id) ? (
              <Badge tone="neutral">{t('suppliers.badge.builtin')}</Badge>
            ) : null}
            {dirty ? (
              <Badge tone="warn">{t('suppliers.detail.unsaved')}</Badge>
            ) : null}
          </span>
        }
        summary={[
          {
            id: 'website',
            label: t('suppliers.col.website'),
            value: savedWebsite ? hostLabel(savedWebsite) : '—',
          },
          {
            id: 'relay',
            label: t('suppliers.relay.members'),
            value: String(relayCount),
          },
          {
            id: 'services',
            label: t('suppliers.relay.services'),
            value: isPlatform
              ? '—'
              : services.length
                ? services.map((service) => t(SERVICE_CLASS_LABEL[service.class])).join(' · ')
                : '—',
          },
          {
            id: 'created',
            label: t('suppliers.detail.created'),
            value: supplier.createdAt,
          },
          {
            id: 'id',
            label: 'ID',
            value: supplier.id,
          },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton
              value={supplier.id}
              label={t('suppliers.cta.copyId')}
              copiedLabel={t('shell.copied')}
              icon={<IconCopy />}
              copiedIcon={<IconCheck />}
            />
            {savedWebsite ? (
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() =>
                  window.open(savedWebsite, '_blank', 'noopener,noreferrer')
                }
              >
                {t('suppliers.cta.openWebsite')}
              </Button>
            ) : null}
          </div>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as DetailTab)}
        className="mt-4"
      >
        <TabsList>
          <TabsTrigger value="profile">
            {t('suppliers.detail.tab.profile')}
          </TabsTrigger>
          <TabsTrigger value="relay">
            {t('modelService.tab.models')}
            <span className="ml-1.5 text-ink-faint tabular-nums">
              {relayCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="config">
            {t('suppliers.detail.tab.config')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-4">
          <p className="text-sm text-ink-muted">
            {t('suppliers.detail.profileHint')}
          </p>
          {isPlatform ? (
            <Card as="p" className="px-3 py-2 text-sm text-ink-muted">
              {t('suppliers.detail.platformLocked')}
            </Card>
          ) : isBuiltinSupplier(supplier.id) ? (
            <Card as="p" className="px-3 py-2 text-sm text-ink-muted">
              {t('suppliers.detail.builtinLocked')}
            </Card>
          ) : null}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
            <ProductMediaFields
              showCover={false}
              logoShape="round"
              readOnly={isPlatform}
              logoUrl={avatarUrl}
              onLogoChange={setAvatarUrl}
              placeholderLogo={defaultAvatarForName(displayTitle || supplier.name)}
              labels={{
                logo: t('suppliers.field.avatar'),
                logoSpec: t('suppliers.media.avatarSpec'),
                logoEmpty: t('suppliers.media.avatarEmpty'),
                cropLogoTitle: t('suppliers.media.cropTitle'),
                hint: t('suppliers.media.hint'),
              }}
            />
            <div className="space-y-3">
              <ConsoleFormField label={t('suppliers.field.nameZh')} required>
                <Input
                  value={nameZh}
                  onChange={(e) => setNameZh(e.target.value)}
                  disabled={isPlatform}
                  placeholder={t('suppliers.field.nameZhPlaceholder')}
                />
              </ConsoleFormField>
              <ConsoleFormField label={t('suppliers.field.nameEn')} required>
                <Input
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  disabled={isPlatform}
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
                  inputMode="url"
                  autoComplete="url"
                />
              </ConsoleFormField>
              {websiteNormalized ? (
                <p className="text-xs text-ink-faint">
                  {t('suppliers.field.websitePreview')}:{' '}
                  <span className="text-ink-muted">{websiteNormalized}</span>
                </p>
              ) : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="config" className="mt-4 space-y-6">
          <p className="text-sm text-ink-muted">
            {isPlatform
              ? t('suppliers.config.platformHint')
              : t('suppliers.config.customHint')}
          </p>
          {supplier.config.kind === 'custom' ? (
            <p className="text-sm text-ink-muted">{t('suppliers.config.relayHint')}</p>
          ) : null}

          {supplier.config.kind === 'platform' ? (
            <DescriptionList
              items={[
                {
                  label: t('suppliers.config.kind'),
                  value: t('suppliers.config.platform'),
                },
                {
                  label: t('suppliers.config.note'),
                  value: t('suppliers.config.platformHint'),
                },
              ]}
            />
          ) : (
            <>
              <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-ink">
                    {t('suppliers.config.fieldsTitle')}
                  </h2>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setCustomFields([
                        ...customFields,
                        { key: '', value: '', secret: true },
                      ])
                    }
                  >
                    <IconPlus />
                    {t('suppliers.config.addField')}
                  </Button>
                </div>

                {customFields.length === 0 ? (
                  <ConsoleEmptyState
                    title={t('suppliers.config.emptyTitle')}
                    description={t('suppliers.config.emptyBody')}
                    action={
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          setCustomFields([
                            { key: '', value: '', secret: true },
                          ])
                        }
                      >
                        <IconPlus />
                        {t('suppliers.config.addField')}
                      </Button>
                    }
                  />
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border/70">
                    <table className="w-full min-w-[36rem] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-border/60 bg-bg-muted/40 text-left text-xs font-medium text-ink-faint">
                          <th className="px-2.5 py-2 w-[11rem]">
                            {t('suppliers.config.fieldKey')}
                          </th>
                          <th className="px-2.5 py-2">
                            {t('suppliers.config.fieldValue')}
                          </th>
                          <th className="px-2.5 py-2 w-[4.5rem] text-center">
                            {t('suppliers.config.secret')}
                          </th>
                          <th className="px-2.5 py-2 w-[4rem]" />
                        </tr>
                      </thead>
                      <tbody>
                        {customFields.map((field, index) => {
                          const known = KNOWN_FIELD_LABEL[field.key.trim()];
                          return (
                            <tr
                              key={`field-${index}`}
                              className="border-b border-border/40 last:border-0"
                            >
                              <td className="px-2.5 py-1.5 align-top">
                                <Input
                                  value={field.key}
                                  placeholder={t('suppliers.config.fieldKeyPh')}
                                  spellCheck={false}
                                  autoComplete="off"
                                  className="h-[30px]"
                                  onChange={(e) => {
                                    const next = customFields.map((f, i) =>
                                      i === index
                                        ? { ...f, key: e.target.value }
                                        : f,
                                    );
                                    setCustomFields(next);
                                  }}
                                />
                                <p className="mt-0.5 h-4 truncate text-[11px] leading-4 text-ink-faint">
                                  {known ? t(known) : '\u00a0'}
                                </p>
                              </td>
                              <td className="px-2.5 py-1.5 align-top">
                                <Input
                                  value={field.value}
                                  type={field.secret ? 'password' : 'text'}
                                  placeholder={t(
                                    'suppliers.config.fieldValuePh',
                                  )}
                                  spellCheck={false}
                                  autoComplete={
                                    field.secret ? 'new-password' : 'off'
                                  }
                                  className="h-[30px]"
                                  onChange={(e) => {
                                    const next = customFields.map((f, i) =>
                                      i === index
                                        ? { ...f, value: e.target.value }
                                        : f,
                                    );
                                    setCustomFields(next);
                                  }}
                                />
                                <p
                                  className="mt-0.5 h-4 leading-4"
                                  aria-hidden
                                >
                                  &nbsp;
                                </p>
                              </td>
                              <td className="px-2.5 py-1.5 align-top text-center">
                                <div className="flex h-8 items-center justify-center">
                                  <Switch
                                    checked={Boolean(field.secret)}
                                    aria-label={t('suppliers.config.secret')}
                                    onCheckedChange={(checked) => {
                                      const next = customFields.map((f, i) =>
                                        i === index
                                          ? { ...f, secret: checked }
                                          : f,
                                      );
                                      setCustomFields(next);
                                    }}
                                  />
                                </div>
                              </td>
                              <td className="px-2.5 py-1.5 align-top text-right">
                                <div className="flex h-8 items-center justify-end">
                                  <PopConfirm
                                    title={t(
                                      'suppliers.config.removeFieldConfirm',
                                    )}
                                    description={t(
                                      'suppliers.config.removeFieldConfirmBody',
                                    )}
                                    confirmLabel={t(
                                      'suppliers.config.confirmDelete',
                                    )}
                                    cancelLabel={t(
                                      'suppliers.config.confirmCancel',
                                    )}
                                    onConfirm={() =>
                                      setCustomFields(
                                        customFields.filter(
                                          (_, i) => i !== index,
                                        ),
                                      )
                                    }
                                  >
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      aria-label={t(
                                        'suppliers.config.removeField',
                                      )}
                                      className="!size-8 !px-0 text-ink-muted hover:!text-[color:var(--color-error)]"
                                    >
                                      <IconTrash />
                                    </Button>
                                  </PopConfirm>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <h2 className="text-sm font-medium text-ink">
                      {t('suppliers.config.keysTitle')}
                    </h2>
                    <p className="text-xs text-ink-muted">
                      {t('suppliers.config.keysHint')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraftKeys([
                        ...draftKeys,
                        toDraftKeys([createEmptySupplierApiKey()])[0]!,
                      ])
                    }
                  >
                    <IconPlus />
                    {t('suppliers.config.addKey')}
                  </Button>
                </div>

                {draftKeys.length === 0 ? (
                  <ConsoleEmptyState
                    title={t('suppliers.config.keysEmptyTitle')}
                    description={t('suppliers.config.keysEmptyBody')}
                    action={
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          setDraftKeys(
                            toDraftKeys([createEmptySupplierApiKey()]),
                          )
                        }
                      >
                        <IconPlus />
                        {t('suppliers.config.addKey')}
                      </Button>
                    }
                  />
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border/70">
                    <table className="w-full min-w-[44rem] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-border/60 bg-bg-muted/40 text-left text-xs font-medium text-ink-faint">
                          <th className="px-2.5 py-2 w-[8rem]">
                            {t('suppliers.config.keyLabel')}
                          </th>
                          <th className="px-2.5 py-2">
                            {t('suppliers.config.keyValue')}
                          </th>
                          <th className="px-2.5 py-2 w-[4.5rem]">
                            {t('suppliers.config.keyWeight')}
                          </th>
                          <th className="px-2.5 py-2 w-[3.5rem] text-center">
                            {t('suppliers.config.keyEnabled')}
                          </th>
                          <th className="px-2.5 py-2 w-[5rem] text-right">
                            {t('suppliers.config.keyCalls')}
                          </th>
                          <th className="px-2.5 py-2 w-[8rem]" />
                        </tr>
                      </thead>
                      <tbody>
                        {draftKeys.map((key, index) => {
                          const live = liveCallMap.get(key.id);
                          const callCount = live?.callCount ?? 0;
                          const isPersisted = liveApiKeys.some(
                            (k) => k.id === key.id,
                          );
                          return (
                            <tr
                              key={key.id}
                              className="border-b border-border/40 last:border-0"
                            >
                              <td className="px-2.5 py-1.5 align-middle">
                                <Input
                                  value={key.label}
                                  placeholder={t(
                                    'suppliers.config.keyLabelPh',
                                  )}
                                  spellCheck={false}
                                  autoComplete="off"
                                  className="h-[30px]"
                                  onChange={(e) => {
                                    const next = draftKeys.map((k, i) =>
                                      i === index
                                        ? { ...k, label: e.target.value }
                                        : k,
                                    );
                                    setDraftKeys(next);
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-1.5 align-middle">
                                <Input
                                  value={key.value}
                                  type="password"
                                  placeholder={t(
                                    'suppliers.config.keyValuePh',
                                  )}
                                  spellCheck={false}
                                  autoComplete="new-password"
                                  className="h-[30px] font-mono text-xs"
                                  onChange={(e) => {
                                    const next = draftKeys.map((k, i) =>
                                      i === index
                                        ? { ...k, value: e.target.value }
                                        : k,
                                    );
                                    setDraftKeys(next);
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-1.5 align-middle">
                                <Input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={key.weight}
                                  className="h-[30px] tabular-nums"
                                  onChange={(e) => {
                                    const n = Number(e.target.value);
                                    const next = draftKeys.map((k, i) =>
                                      i === index
                                        ? {
                                            ...k,
                                            weight: Number.isFinite(n)
                                              ? Math.max(1, Math.floor(n))
                                              : 1,
                                          }
                                        : k,
                                    );
                                    setDraftKeys(next);
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-1.5 align-middle text-center">
                                <Switch
                                  checked={key.enabled}
                                  aria-label={t('suppliers.config.keyEnabled')}
                                  onCheckedChange={(checked) => {
                                    const next = draftKeys.map((k, i) =>
                                      i === index
                                        ? { ...k, enabled: checked }
                                        : k,
                                    );
                                    setDraftKeys(next);
                                  }}
                                />
                              </td>
                              <td className="px-2.5 py-1.5 align-middle text-right">
                                <span className="tabular-nums text-ink-muted">
                                  {callCount}
                                </span>
                              </td>
                              <td className="px-2.5 py-1.5 align-middle">
                                <div className="flex justify-end gap-1">
                                  <PopConfirm
                                    title={t(
                                      'suppliers.config.keyResetConfirm',
                                    )}
                                    description={t(
                                      'suppliers.config.keyResetConfirmBody',
                                    )}
                                    confirmLabel={t(
                                      'suppliers.config.keyReset',
                                    )}
                                    cancelLabel={t(
                                      'suppliers.config.confirmCancel',
                                    )}
                                    tone="default"
                                    disabled={!isPersisted || callCount === 0}
                                    onConfirm={() => handleResetKey(key.id)}
                                  >
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      disabled={
                                        !isPersisted || callCount === 0
                                      }
                                      aria-label={t(
                                        'suppliers.config.keyReset',
                                      )}
                                      className="!size-8 !px-0 text-ink-muted"
                                    >
                                      <IconRotateCcw />
                                    </Button>
                                  </PopConfirm>
                                  <PopConfirm
                                    title={t(
                                      'suppliers.config.keyRemoveConfirm',
                                    )}
                                    description={t(
                                      'suppliers.config.keyRemoveConfirmBody',
                                    )}
                                    confirmLabel={t(
                                      'suppliers.config.confirmDelete',
                                    )}
                                    cancelLabel={t(
                                      'suppliers.config.confirmCancel',
                                    )}
                                    onConfirm={() =>
                                      setDraftKeys(
                                        draftKeys.filter((_, i) => i !== index),
                                      )
                                    }
                                  >
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      aria-label={t(
                                        'suppliers.config.keyRemove',
                                      )}
                                      className="!size-8 !px-0 text-ink-muted hover:!text-[color:var(--color-error)]"
                                    >
                                      <IconTrash />
                                    </Button>
                                  </PopConfirm>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </TabsContent>

        <TabsContent value="relay" className="mt-4 min-w-0">
          {isPlatform ? (
            <RelayModelsPanel
              partnerNames={[supplier.name, supplier.names?.zh ?? '', supplier.names?.en ?? '']}
              onCount={setRelayCount}
            />
          ) : (
            <RelayServicesPanel
              key={supplier.id}
              services={services}
              onChange={setServices}
              partnerNames={[supplier.name, supplier.names?.zh ?? '', supplier.names?.en ?? '']}
            />
          )}
        </TabsContent>


      </Tabs>
    </AdminPageShell>
  );
}
