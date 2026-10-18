import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import {
  Button,
  CopyButton,
  ConsoleDialog,
  ConsoleEmptyState,
  ConsoleFormField,
  Input,
  ListToolbar,
  PopConfirm,
  SecretReveal,
  Switch,
  useToast,
} from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { ListRowAction, ListRowActions } from '@/components/ListRowActions';
import {
  IconCheck,
  IconCopy,
  IconPlus,
  IconRotateCcw,
  IconTrash,
} from '@/components/UiIcons';
import {
  createDebugClientKey,
  listDebugClientKeys,
  maskDebugClientSecret,
  regenerateDebugClientSecret,
  removeDebugClientKey,
  updateDebugClientKey,
  type DebugClientKey,
} from '@/data/debugClientKeys';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import {
  discoverWorkConnect,
  getGatewayBaseUrlOverride,
  isPlaceholderGatewayBase,
  setGatewayBaseUrlOverride,
  type WorkConnectDiscovery,
} from '@/lib/workConnect';
import { IndustriesSection } from '@/pages/settings/IndustriesSection';
import { AdministrationSection } from '@/pages/settings/AdministrationSection';
import { ParksSection } from '@/pages/settings/ParksSection';
import { UniversitiesSection } from '@/pages/settings/UniversitiesSection';
import { TagsSection } from '@/pages/settings/TagsSection';
import { ProvincialChainsSection } from '@/pages/settings/ProvincialChainsSection';
import { AppsSection } from '@/pages/settings/AppsSection';
import { RegionsSection } from '@/pages/settings/RegionsSection';
import { TenantSystemSection } from '@/pages/settings/TenantSystemSection';
import { matchDestination } from '@/shell/destinations';
import { CaptchaSection } from '@/pages/settings/CaptchaSection';
import { RuntimeEntriesSection } from '@/pages/settings/RuntimeEntriesSection';
import { BootstrapSection } from '@/pages/settings/BootstrapSection';
import { SignInProvidersSection } from '@/pages/settings/SignInProvidersSection';
import { SmsSection } from '@/pages/settings/SmsSection';
import { NoticesSection } from '@/pages/settings/NoticesSection';

type SettingsSectionId = 'system' | 'apps' | 'notices' | 'sms' | 'captcha' | 'sign-in' | 'regions' | 'industries' | 'chains' | 'administration' | 'parks' | 'universities' | 'tags' | 'bootstrap' | 'runtime' | 'debug';

const SECTION_IDS: SettingsSectionId[] = [
  'system',
  'apps',
  'notices',
  'sms',
  'captcha',
  'sign-in',
  'regions',
  'industries',
  'chains',
  'administration',
  'parks',
  'universities',
  'tags',
  'bootstrap',
  'runtime',
  'debug',
];

const LEGACY_SECTIONS: Record<string, SettingsSectionId> = {
  login: 'sign-in',
  entries: 'runtime',
};

function isSettingsSection(value: string | undefined): value is SettingsSectionId {
  return !!value && SECTION_IDS.includes(value as SettingsSectionId);
}

export function SettingsPage() {
  const { t } = useI18n();
  const { section: sectionParam } = useParams<{ section?: string }>();

  if (!sectionParam) {
    return <Navigate to="/admin/settings/system" replace />;
  }
  const renamed = LEGACY_SECTIONS[sectionParam];
  if (renamed) {
    return <Navigate to={`/admin/settings/${renamed}`} replace />;
  }
  if (!isSettingsSection(sectionParam)) {
    return <Navigate to="/admin/settings/system" replace />;
  }
  const section = sectionParam;
  const destination = matchDestination(`/settings/${section}`);

  return (
    <AdminPageShell
      title={t(destination.labelKey)}
      description={t(destination.descriptionKey)}
    >
      <div className={section === 'apps' || section === 'regions' || section === 'industries' || section === 'chains' || section === 'administration' || section === 'parks' || section === 'universities' || section === 'tags' ? undefined : 'os-settings-page'}>
        {section === 'system' ? <TenantSystemSection /> : null}
        {section === 'apps' ? <AppsSection /> : null}
        {section === 'notices' ? <NoticesSection /> : null}
        {section === 'sms' ? <SmsSection /> : null}
        {section === 'captcha' ? <CaptchaSection /> : null}
        {section === 'sign-in' ? <SignInProvidersSection /> : null}
        {section === 'regions' ? <RegionsSection /> : null}
        {section === 'industries' ? <IndustriesSection /> : null}
        {section === 'chains' ? <ProvincialChainsSection /> : null}
        {section === 'administration' ? <AdministrationSection /> : null}
        {section === 'parks' ? <ParksSection /> : null}
        {section === 'universities' ? <UniversitiesSection /> : null}
        {section === 'tags' ? <TagsSection /> : null}
        {section === 'bootstrap' ? <BootstrapSection /> : null}
        {section === 'runtime' ? <RuntimeEntriesSection /> : null}
        {section === 'debug' ? <DebugSection t={t} /> : null}
      </div>
    </AdminPageShell>
  );
}

type Translate = (key: MessageKey) => string;

function FormGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="os-settings__group">
      <h4 className="os-settings__group-title">{title}</h4>
      <div className="os-settings__fields">{children}</div>
    </section>
  );
}

function DebugSection({ t }: { t: Translate }) {
  const toast = useToast();
  const [tick, setTick] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<DebugClientKey | null>(null);
  const [gatewayDraft, setGatewayDraft] = useState('');
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [discovery, setDiscovery] = useState<WorkConnectDiscovery | null>(null);
  const [discovering, setDiscovering] = useState(true);
  const [showGatewayOverride, setShowGatewayOverride] = useState(
    () => Boolean(getGatewayBaseUrlOverride()),
  );

  const keys = useMemo(() => {
    void tick;
    return listDebugClientKeys();
  }, [tick]);

  const gatewayPlaceholder = isPlaceholderGatewayBase();

  async function runDiscovery() {
    setDiscovering(true);
    try {
      const next = await discoverWorkConnect();
      setDiscovery(next);
      if (!getGatewayBaseUrlOverride()) {
        setGatewayDraft(next.gatewayBaseUrl);
      } else {
        setGatewayDraft(getGatewayBaseUrlOverride() || next.gatewayBaseUrl);
      }
    } finally {
      setDiscovering(false);
    }
  }

  useEffect(() => {
    void runDiscovery();
  }, []);

  function saveGatewayBase() {
    const raw = gatewayDraft.trim();
    if (!raw) {
      setGatewayBaseUrlOverride(null);
      setGatewayError(null);
      void runDiscovery().then(() => {
        toast.push({ title: t('settings.debug.gatewayReset'), tone: 'info' });
      });
      return;
    }
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setGatewayError(t('settings.debug.gatewayInvalid'));
        return;
      }
    } catch {
      setGatewayError(t('settings.debug.gatewayInvalid'));
      return;
    }
    setGatewayBaseUrlOverride(raw);
    setGatewayError(null);
    setShowGatewayOverride(true);
    void runDiscovery().then(() => {
      toast.push({ title: t('settings.debug.gatewaySaved'), tone: 'success' });
    });
  }

  function useAutoDetected() {
    setGatewayBaseUrlOverride(null);
    setShowGatewayOverride(false);
    setGatewayError(null);
    void runDiscovery().then(() => {
      toast.push({ title: t('settings.debug.gatewayAutoApplied'), tone: 'success' });
    });
  }

  function openCreate() {
    setLabel('');
    setFormError(null);
    setCreateOpen(true);
  }

  function onCreate() {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setFormError(t('settings.debug.labelRequired'));
      return;
    }
    const created = createDebugClientKey({ label: trimmedLabel });
    setLabel('');
    setFormError(null);
    setCreateOpen(false);
    setRevealed(created);
    setTick((n) => n + 1);
    toast.push({ title: t('settings.debug.saved'), tone: 'success' });
  }

  function onRegenerate(id: string) {
    const next = regenerateDebugClientSecret(id);
    if (!next) return;
    setRevealed(next);
    setTick((n) => n + 1);
    toast.push({ title: t('settings.debug.regenerated'), tone: 'success' });
  }

  function onRemove(id: string) {
    removeDebugClientKey(id);
    if (revealed?.id === id) setRevealed(null);
    setTick((n) => n + 1);
    toast.push({ title: t('settings.debug.removed'), tone: 'info' });
  }

  return (
    <div className="os-settings-form space-y-5">
      <FormGroup title={t('settings.debug.gatewayTitle')}>
        <p className="os-settings__field-hint">
          {t('settings.debug.gatewayHint')}
        </p>

        <div className="rounded-md border border-border/70 bg-bg-muted/20 px-3 py-3 text-sm">
          {discovering && !discovery ? (
            <p className="text-ink-faint">{t('settings.debug.discovering')}</p>
          ) : discovery ? (
            <dl className="grid gap-2 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
              <dt className="text-ink-faint">
                {t('settings.debug.detect.gateway')}
              </dt>
              <dd className="min-w-0">
                <code className="break-all font-mono text-xs text-ink">
                  {discovery.gatewayBaseUrl}
                </code>
                <span className="mt-0.5 block text-[11px] text-ink-faint">
                  {t(
                    `settings.debug.source.${discovery.gatewaySource}` as MessageKey,
                  )}
                  {discovery.gatewayReachable === true
                    ? ` · ${t('settings.debug.gatewayReachable')}`
                    : discovery.gatewayReachable === false
                      ? ` · ${t('settings.debug.gatewayUnreachable')}`
                      : ''}
                </span>
              </dd>
              <dt className="text-ink-faint">
                {t('settings.debug.detect.api')}
              </dt>
              <dd className="min-w-0">
                <code className="break-all font-mono text-xs text-ink">
                  {discovery.apiProxyBase}
                  <span className="text-ink-faint">
                    {' '}
                    → {discovery.apiListenHint}
                  </span>
                </code>
                <span className="mt-0.5 block text-[11px] text-ink-faint">
                  {discovery.apiReachable === null
                    ? t('settings.debug.apiUnknown')
                    : discovery.apiReachable
                      ? t('settings.debug.apiUp')
                      : t('settings.debug.apiDown')}
                </span>
              </dd>
            </dl>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={discovering}
              onClick={() => void runDiscovery()}
            >
              {t('settings.debug.rediscover')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={discovering}
              onClick={useAutoDetected}
            >
              {t('settings.debug.useAuto')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowGatewayOverride((v) => !v)}
            >
              {showGatewayOverride
                ? t('settings.debug.hideOverride')
                : t('settings.debug.showOverride')}
            </Button>
          </div>
        </div>

        {gatewayPlaceholder ? (
          <p className="text-xs text-[color:var(--color-warning,#b45309)]">
            {t('settings.debug.gatewayPlaceholderWarn')}
          </p>
        ) : null}

        {showGatewayOverride ? (
          <div className="space-y-2 pt-1">
            <ConsoleFormField label={t('settings.debug.gatewayBase')}>
              <Input
                value={gatewayDraft}
                onChange={(e) => setGatewayDraft(e.target.value)}
                placeholder={discovery?.gatewayBaseUrl || 'http://127.0.0.1:3100/v1'}
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveGatewayBase();
                  }
                }}
              />
            </ConsoleFormField>
            {gatewayError ? (
              <p className="os-settings__field-error" role="alert">
                {gatewayError}
              </p>
            ) : null}
            <div className="os-settings__brand-actions">
              <Button type="button" size="sm" onClick={saveGatewayBase}>
                {t('settings.debug.gatewaySave')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={useAutoDetected}
              >
                {t('settings.debug.gatewayClear')}
              </Button>
            </div>
          </div>
        ) : null}
      </FormGroup>

      <ListToolbar
        primaryAction={
          <Button type="button" size="sm" onClick={openCreate}>
            <IconPlus />
            {t('settings.debug.add')}
          </Button>
        }
      />
      <p className="max-w-2xl text-sm text-ink-muted">
        {t('settings.debug.hint')}
      </p>

      {keys.length === 0 ? (
        <ConsoleEmptyState
          title={t('settings.debug.emptyTitle')}
          description={t('settings.debug.emptyBody')}
          action={
            <Button type="button" size="sm" onClick={openCreate}>
              <IconPlus />
              {t('settings.debug.add')}
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border/70">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-bg-muted/40 text-left text-xs font-medium text-ink-faint">
                <th className="px-2.5 py-2">{t('settings.debug.label')}</th>
                <th className="px-2.5 py-2">{t('settings.debug.secret')}</th>
                <th className="px-2.5 py-2 w-[7.5rem]">
                  {t('settings.debug.created')}
                </th>
                <th className="px-2.5 py-2 w-[5rem] text-center">
                  {t('settings.debug.enabled')}
                </th>
                <th className="px-2.5 py-2 w-[5.5rem]" />
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr
                  key={key.id}
                  className="border-b border-border/40 last:border-0"
                >
                  <td className="px-2.5 py-1.5 align-middle">
                    <input
                      className="h-[30px] w-full min-w-[8rem] rounded-lg bg-transparent px-2 text-sm text-ink outline-none hover:bg-surface-2 focus:bg-[color:var(--color-control-fill)] focus-visible:shadow-[var(--ring-focus)]"
                      defaultValue={key.label}
                      aria-label={t('settings.debug.label')}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (!next || next === key.label) {
                          e.target.value = key.label;
                          return;
                        }
                        updateDebugClientKey(key.id, { label: next });
                        setTick((n) => n + 1);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        }
                        if (e.key === 'Escape') {
                          (e.target as HTMLInputElement).value = key.label;
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                    />
                  </td>
                  <td className="px-2.5 py-1.5 align-middle">
                    <span
                      className="font-mono text-xs text-ink-muted"
                      title={t('settings.debug.prefixHint')}
                    >
                      {maskDebugClientSecret(key.secret)}
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5 align-middle text-xs text-ink-faint tabular-nums">
                    {formatDebugKeyDate(key.createdAt)}
                  </td>
                  <td className="px-2.5 py-1.5 align-middle text-center">
                    <Switch
                      checked={key.enabled}
                      aria-label={t('settings.debug.enabled')}
                      onCheckedChange={(checked) => {
                        updateDebugClientKey(key.id, { enabled: checked });
                        setTick((n) => n + 1);
                      }}
                    />
                  </td>
                  <td className="px-2.5 py-1.5 align-middle text-right">
                    <ListRowActions>
                      <PopConfirm
                        title={t('settings.debug.regenerateConfirm')}
                        description={t('settings.debug.regenerateConfirmBody')}
                        confirmLabel={t('settings.debug.regenerate')}
                        cancelLabel={t('settings.debug.cancel')}
                        tone="danger"
                        onConfirm={() => onRegenerate(key.id)}
                      >
                        <ListRowAction
                          type="button"
                          iconOnly
                          icon={<IconRotateCcw />}
                        >
                          {t('settings.debug.regenerate')}
                        </ListRowAction>
                      </PopConfirm>
                      <PopConfirm
                        title={t('settings.debug.removeConfirm')}
                        description={t('settings.debug.removeConfirmBody')}
                        confirmLabel={t('settings.debug.remove')}
                        cancelLabel={t('settings.debug.cancel')}
                        onConfirm={() => onRemove(key.id)}
                      >
                        <ListRowAction
                          type="button"
                          iconOnly
                          tone="danger"
                          icon={<IconTrash />}
                        >
                          {t('settings.debug.remove')}
                        </ListRowAction>
                      </PopConfirm>
                    </ListRowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConsoleDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setLabel('');
            setFormError(null);
          }
        }}
        title={t('settings.debug.add')}
        description={t('settings.debug.generateHint')}
        size="sm"
        footer={
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              {t('settings.debug.cancel')}
            </Button>
            <Button type="button" size="sm" onClick={onCreate}>
              {t('settings.debug.add')}
            </Button>
          </>
        }
      >
        <ConsoleFormField label={t('settings.debug.label')} required>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('settings.debug.labelPh')}
            autoComplete="off"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCreate();
              }
            }}
          />
        </ConsoleFormField>
        {formError ? (
          <p className="os-settings__field-error mt-2" role="alert">
            {formError}
          </p>
        ) : null}
      </ConsoleDialog>

      <ConsoleDialog
        open={Boolean(revealed)}
        onOpenChange={(open) => {
          if (!open) setRevealed(null);
        }}
        title={t('settings.debug.revealTitle')}
        description={t('settings.debug.revealHint')}
        size="md"
        footer={
          <Button type="button" size="sm" onClick={() => setRevealed(null)}>
            {t('settings.debug.revealDone')}
          </Button>
        }
      >
        {revealed ? (
          <div className="space-y-3">
            <SecretReveal
              key={revealed.id + revealed.updatedAt}
              value={revealed.secret}
              label={t('settings.debug.secret')}
              revealLabel={t('settings.debug.showOnce')}
              hideLabel={t('settings.debug.hideForever')}
            />
            <CopyButton
              value={revealed.secret}
              label={t('settings.debug.copy')}
              copiedLabel={t('settings.debug.copied')}
              icon={<IconCopy />}
              copiedIcon={<IconCheck />}
            />
          </div>
        ) : null}
      </ConsoleDialog>
    </div>
  );
}

function formatDebugKeyDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
