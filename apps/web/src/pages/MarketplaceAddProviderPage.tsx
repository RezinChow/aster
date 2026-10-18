import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Button, ConsoleFormField, Input, Steps } from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import {
  bindProviderSecret,
  isValidWorldMonitorKey,
  testProviderConnection,
} from '@/data/providerSecrets';
import { useI18n } from '@/i18n/useI18n';

const TARGET_PROVIDER = 'prov_a3s_monitor';

type StepId = 'template' | 'connect' | 'test' | 'confirm';

/**
 * Bind World Monitor upstream for the Kense Monitor Solution Provider.
 * First principles: template → connect (secret) → test → confirm.
 */
export function MarketplaceAddProviderPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState<StepId>('template');
  const [baseUrl, setBaseUrl] = useState('https://api.worldmonitor.app');
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [testDetail, setTestDetail] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [boundPrefix, setBoundPrefix] = useState<string | null>(null);

  const steps = [
    { id: 'template', title: t('market.wizard.step.template') },
    { id: 'connect', title: t('market.wizard.step.connect') },
    { id: 'test', title: t('market.wizard.step.test') },
    { id: 'confirm', title: t('market.wizard.step.confirm') },
  ];

  function onBindAndNext() {
    setError(null);
    const res = bindProviderSecret({
      providerId: TARGET_PROVIDER,
      plaintext: keyInput,
      baseUrl,
      name: 'World Monitor API Key',
    });
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setBoundPrefix(res.view.prefix);
    setKeyInput('');
    setStep('test');
  }

  async function onTestAndNext() {
    setTesting(true);
    setError(null);
    try {
      const res = await testProviderConnection(TARGET_PROVIDER);
      setTestDetail(res.detail);
      if (!res.ok && res.status === 'fail') {
        setError(res.detail);
        return;
      }
      setStep('confirm');
    } finally {
      setTesting(false);
    }
  }

  return (
    <AdminPageShell
      title={t('market.wizard.title')}
      description={t('market.wizard.description')}
      backTo="/admin/marketplace"
      crumbs={[
        { label: t('nav.marketplace'), to: '/marketplace' },
        { label: t('market.wizard.title') },
      ]}
    >
      <Steps steps={steps} currentId={step} />

      {step === 'template' ? (
        <Card className="mt-4 space-y-3 p-4">
          <h2 className="text-sm font-medium text-ink">
            {t('market.wizard.templateTitle')}
          </h2>
          <p className="text-sm text-ink-muted">
            {t('market.wizard.templateBody')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">World Monitor</Badge>
            <Badge tone="neutral">function+openapi</Badge>
            <Badge tone="neutral">Monitor API</Badge>
          </div>
          <ul className="list-inside list-disc text-xs text-ink-muted">
            <li>Upstream: https://api.worldmonitor.app</li>
            <li>Header: X-WorldMonitor-Key</li>
            <li>Function env: WM_KEY ← secret://… (Work never sees wm_)</li>
          </ul>
          <Button type="button" size="sm" onClick={() => setStep('connect')}>
            {t('market.wizard.next')}
          </Button>
        </Card>
      ) : null}

      {step === 'connect' ? (
        <Card className="mt-4 space-y-3 p-4">
          <h2 className="text-sm font-medium text-ink">
            {t('market.wizard.connectTitle')}
          </h2>
          <p className="text-sm text-ink-muted">
            {t('market.wizard.connectBody')}
          </p>
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
              keyInput && !isValidWorldMonitorKey(keyInput)
                ? t('market.provider.cred.invalidFormat')
                : t('market.provider.cred.keyHint')
            }
          >
            <Input
              type="password"
              autoComplete="off"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="wm_…"
              spellCheck={false}
            />
          </ConsoleFormField>
          {error ? (
            <p className="text-sm text-[color:var(--color-error)]">{error}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setStep('template')}
            >
              {t('market.wizard.back')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!keyInput.trim()}
              onClick={onBindAndNext}
            >
              {t('market.wizard.bindNext')}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 'test' ? (
        <Card className="mt-4 space-y-3 p-4">
          <h2 className="text-sm font-medium text-ink">
            {t('market.wizard.testTitle')}
          </h2>
          <p className="text-sm text-ink-muted">
            {t('market.wizard.testBody')}
          </p>
          {boundPrefix ? (
            <p className="font-mono text-xs text-ink">
              {t('market.provider.cred.prefix')}: {boundPrefix}
            </p>
          ) : null}
          {testDetail ? (
            <p className="text-xs text-ink-faint">{testDetail}</p>
          ) : null}
          {error ? (
            <p className="text-sm text-[color:var(--color-error)]">{error}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setStep('connect')}
            >
              {t('market.wizard.back')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={testing}
              onClick={() => void onTestAndNext()}
            >
              {testing
                ? t('market.provider.cred.testing')
                : t('market.wizard.testNext')}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 'confirm' ? (
        <Card className="mt-4 space-y-3 p-4">
          <h2 className="text-sm font-medium text-ink">
            {t('market.wizard.confirmTitle')}
          </h2>
          <p className="text-sm text-ink-muted">
            {t('market.wizard.confirmBody')}
          </p>
          {boundPrefix ? (
            <p className="font-mono text-xs text-ink">
              {boundPrefix} · WM_KEY=secret://…
            </p>
          ) : null}
          {testDetail ? (
            <p className="text-xs text-ink-faint">{testDetail}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() =>
                navigate(`/admin/marketplace/providers/${TARGET_PROVIDER}`)
              }
            >
              {t('market.wizard.openProvider')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigate('/admin/gateway')}
            >
              {t('market.wizard.openGateway')}
            </Button>
          </div>
        </Card>
      ) : null}
    </AdminPageShell>
  );
}
