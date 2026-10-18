import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  Card,
  Badge,
  Button,
  ConsoleConfirmDialog,
  DescriptionList,
  ConsoleFormField,
  Input,
  ResourceMetaHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type BadgeTone,
} from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import {
  marketListings,
  providerById,
  type ProviderHealth,
} from '@/data/marketplace';
import {
  DEFAULT_BOYUE_BASE,
  DEFAULT_SILICONFLOW_BASE,
  bindProviderSecret,
  functionEnvProjection,
  getProviderSecretView,
  isBoyueProvider,
  isSiliconflowProvider,
  isValidBoyueKey,
  isValidSiliconflowKey,
  isValidWorldMonitorKey,
  isWorldMonitorProvider,
  supportsProviderCredentials,
  testProviderConnection,
  unbindProviderSecret,
  type ProviderConnectionTestResult,
  type ProviderSecretView,
} from '@/data/providerSecrets';
import { useI18n } from '@/i18n/useI18n';

type Tab = 'overview' | 'credentials' | 'adapter';

function healthTone(health: ProviderHealth): BadgeTone {
  switch (health) {
    case 'healthy':
      return 'success';
    case 'degraded':
      return 'warn';
    case 'down':
      return 'danger';
  }
}

function credentialTone(view: ProviderSecretView): BadgeTone {
  if (view.status !== 'bound') return 'warn';
  if (view.lastTestStatus === 'fail') return 'danger';
  if (view.lastTestStatus === 'ok') return 'success';
  if (view.lastTestStatus === 'format_ok_network_blocked') return 'warn';
  return 'success';
}

export function MarketplaceProviderPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const provider = providerById(id);
  const [tab, setTab] = useState<Tab>('credentials');
  const [tick, setTick] = useState(0);
  const [keyInput, setKeyInput] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.worldmonitor.app');
  const [bindError, setBindError] = useState<string | null>(null);
  const [testOut, setTestOut] = useState<ProviderConnectionTestResult | null>(
    null,
  );
  const [testing, setTesting] = useState(false);
  const [unbindOpen, setUnbindOpen] = useState(false);

  const secret = useMemo(() => {
    void tick;
    return getProviderSecretView(id);
  }, [id, tick]);

  const listings = useMemo(
    () => marketListings.filter((l) => l.providerId === id),
    [id],
  );

  const envProj = useMemo(() => {
    void tick;
    return functionEnvProjection(id);
  }, [id, tick]);

  const credCapable = provider
    ? supportsProviderCredentials(provider.id)
    : false;
  const boyue = provider ? isBoyueProvider(provider.id) : false;
  const siliconflow = provider ? isSiliconflowProvider(provider.id) : false;

  useEffect(() => {
    if (!provider) return;
    if (isBoyueProvider(provider.id)) {
      setBaseUrl(secret.baseUrl || DEFAULT_BOYUE_BASE);
    } else if (isSiliconflowProvider(provider.id)) {
      setBaseUrl(secret.baseUrl || DEFAULT_SILICONFLOW_BASE);
    } else if (isWorldMonitorProvider(provider.id)) {
      setBaseUrl(secret.baseUrl || 'https://api.worldmonitor.app');
    }
  }, [provider, secret.baseUrl]);

  if (!provider) {
    return <Navigate to="/admin/marketplace" replace />;
  }

  async function onBind() {
    setBindError(null);
    setTestOut(null);
    const res = bindProviderSecret({
      providerId: provider!.id,
      plaintext: keyInput,
      baseUrl,
    });
    if (!res.ok) {
      setBindError(res.message);
      return;
    }
    setKeyInput('');
    setTick((n) => n + 1);
  }

  async function onTest() {
    setTesting(true);
    setTestOut(null);
    try {
      const res = await testProviderConnection(provider!.id);
      setTestOut(res);
      setTick((n) => n + 1);
    } finally {
      setTesting(false);
    }
  }

  async function onUnbindConfirm() {
    unbindProviderSecret(provider!.id);
    setUnbindOpen(false);
    setTestOut(null);
    setTick((n) => n + 1);
  }

  const keyValid = boyue
    ? !keyInput || isValidBoyueKey(keyInput)
    : siliconflow
      ? !keyInput || isValidSiliconflowKey(keyInput)
      : !keyInput || isValidWorldMonitorKey(keyInput);

  const adapterBlurb = boyue
    ? `provider: ${provider.id}
adapter: ${provider.adapter}
upstream: ${DEFAULT_BOYUE_BASE}
header: Authorization Bearer
runtime_env: BOYUE_API_KEY ← vault sync from Console (never Work-visible)
`
    : siliconflow
      ? `provider: ${provider.id}
adapter: ${provider.adapter}
upstream: ${DEFAULT_SILICONFLOW_BASE}
header: Authorization Bearer
runtime_env: SILICONFLOW_API_KEY ← vault sync from Console (never Work-visible)
`
      : `provider: ${provider.id}
adapter: ${provider.adapter}
upstream: https://www.worldmonitor.app
header: X-WorldMonitor-Key
runtime_env: WM_KEY ← vault sync from Console (never Work-visible)
`;

  return (
    <AdminPageShell
      title={provider.name}
      description={`${provider.adapter} · ${provider.trust}`}
      backTo="/admin/marketplace"
      crumbs={[
        { label: t('nav.marketplace'), to: '/marketplace' },
        { label: provider.name },
      ]}
    >
      <ResourceMetaHeader
        title={provider.name}
        badge={
          <>
            <Badge tone={healthTone(provider.health)}>
              {t(`market.health.${provider.health}`)}
            </Badge>
            <Badge tone={credentialTone(secret)}>
              {secret.status === 'bound'
                ? t('market.provider.cred.bound')
                : t('market.provider.cred.missing')}
            </Badge>
          </>
        }
        summary={[
          {
            id: 'adapter',
            label: t('market.provider.adapter'),
            value: provider.adapter,
          },
          {
            id: 'listings',
            label: t('market.stat.listings'),
            value: String(listings.length),
          },
          {
            id: 'secret',
            label: t('market.provider.cred.prefix'),
            value: secret.status === 'bound' ? secret.prefix : '—',
          },
        ]}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList aria-label={provider.name}>
          <TabsTrigger value="overview">
            {t('market.provider.tab.overview')}
          </TabsTrigger>
          <TabsTrigger value="credentials">
            {t('market.provider.tab.credentials')}
          </TabsTrigger>
          <TabsTrigger value="adapter">
            {t('market.provider.tab.adapter')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-3 space-y-3">
          <DescriptionList
            items={[
              {
                label: t('market.provider.trust'),
                value: provider.trust,
              },
              {
                label: t('market.provider.cred.status'),
                value:
                  secret.status === 'bound'
                    ? `${t('market.provider.cred.bound')} · v${secret.version}`
                    : t('market.provider.cred.missing'),
              },
            ]}
          />
          <ul className="space-y-1 text-sm">
            {listings.map((listing) => (
              <li key={listing.id}>
                <Link
                  to={`/admin/marketplace/listings/${listing.id}`}
                  className="font-mono text-ink hover:opacity-80"
                >
                  {listing.sku}
                </Link>
                <span className="text-ink-muted"> · {listing.name}</span>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="credentials" className="mt-3 space-y-4">
          {!credCapable ? (
            <p className="text-sm text-ink-muted">
              {t('market.provider.cred.notSupported')}
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-muted">
                {boyue || siliconflow
                  ? t('market.provider.cred.hintBoyue')
                  : t('market.provider.cred.hint')}
              </p>

              <Card className="p-4">
                <h3 className="text-sm font-medium text-ink">
                  {t('market.provider.cred.current')}
                </h3>
                <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-ink-faint">
                      {t('market.provider.cred.status')}
                    </dt>
                    <dd className="font-mono text-ink">
                      {secret.status === 'bound'
                        ? t('market.provider.cred.bound')
                        : t('market.provider.cred.missing')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">
                      {t('market.provider.cred.prefix')}
                    </dt>
                    <dd className="font-mono text-ink">{secret.prefix}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">
                      {t('market.provider.cred.version')}
                    </dt>
                    <dd className="font-mono text-ink">
                      {secret.version || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-faint">
                      {t('market.provider.cred.lastTest')}
                    </dt>
                    <dd className="font-mono text-ink">
                      {secret.lastTestStatus}
                      {secret.lastTestAt
                        ? ` · ${secret.lastTestAt.slice(0, 19)}`
                        : ''}
                    </dd>
                  </div>
                </dl>
                {secret.lastTestDetail ? (
                  <p className="mt-2 text-[11px] text-ink-faint">
                    {secret.lastTestDetail}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={secret.status !== 'bound' || testing}
                    onClick={() => void onTest()}
                  >
                    {testing
                      ? t('market.provider.cred.testing')
                      : t('market.provider.cred.test')}
                  </Button>
                  {secret.status === 'bound' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="!border-[color:var(--color-error)] !text-[color:var(--color-error)]"
                      onClick={() => setUnbindOpen(true)}
                    >
                      {t('market.provider.cred.unbind')}
                    </Button>
                  ) : null}
                </div>
                {testOut ? (
                  <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-[color:var(--color-control-fill)] p-3 font-mono text-[12px] text-ink">
                    {JSON.stringify(testOut, null, 2)}
                  </pre>
                ) : null}
              </Card>

              <Card className="p-4">
                <h3 className="text-sm font-medium text-ink">
                  {secret.status === 'bound'
                    ? t('market.provider.cred.rotate')
                    : t('market.provider.cred.bind')}
                </h3>
                <p className="mt-1 text-xs text-ink-muted">
                  {boyue
                    ? t('market.provider.cred.bindHintBoyue')
                    : t('market.provider.cred.bindHint')}
                </p>
                <div className="mt-3 space-y-3">
                  <ConsoleFormField label="Base URL">
                    <Input
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      spellCheck={false}
                    />
                  </ConsoleFormField>
                  <ConsoleFormField
                    label={t('market.provider.cred.key')}
                    required
                    hint={
                      keyInput && !keyValid
                        ? t('market.provider.cred.invalidFormat')
                        : boyue
                          ? t('market.provider.cred.keyHintBoyue')
                          : t('market.provider.cred.keyHint')
                    }
                  >
                    <Input
                      type="password"
                      autoComplete="off"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder={boyue || siliconflow ? 'sk-…' : 'wm_…'}
                      spellCheck={false}
                    />
                  </ConsoleFormField>
                  {bindError ? (
                    <p className="text-sm text-[color:var(--color-error)]">
                      {bindError}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    disabled={!keyInput.trim() || !keyValid}
                    onClick={() => void onBind()}
                  >
                    {secret.status === 'bound'
                      ? t('market.provider.cred.rotateSubmit')
                      : t('market.provider.cred.bindSubmit')}
                  </Button>
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="text-sm font-medium text-ink">
                  {t('market.provider.cred.envTitle')}
                </h3>
                <p className="mt-1 text-xs text-ink-muted">
                  {t('market.provider.cred.envHint')}
                </p>
                <pre className="mt-3 overflow-x-auto rounded-md bg-[color:var(--color-control-fill)] p-3 font-mono text-[12px] text-ink">
                  {Object.entries(envProj)
                    .map(([k, v]) => `${k}=${v}`)
                    .join('\n') || t('market.provider.cred.envEmpty')}
                </pre>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="adapter" className="mt-3">
          <pre className="os-market-code">{adapterBlurb}</pre>
        </TabsContent>
      </Tabs>

      <ConsoleConfirmDialog
        open={unbindOpen}
        onOpenChange={setUnbindOpen}
        title={t('market.provider.cred.unbind')}
        description={
          boyue || siliconflow
            ? t('market.provider.cred.unbindConfirmBoyue')
            : t('market.provider.cred.unbindConfirm')
        }
        confirmLabel={t('market.provider.cred.unbind')}
        cancelLabel={t('market.cancel')}
        tone="danger"
        onConfirm={() => void onUnbindConfirm()}
      />
    </AdminPageShell>
  );
}
