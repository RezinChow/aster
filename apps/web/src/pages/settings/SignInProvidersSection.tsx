import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Badge, Button, ConsoleConfirmDialog, Switch, cn, useToast, type BadgeTone } from '@a3s-lab/ui';
import { IconChevronRight } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { getLoginBuiltins, putConfig, type CatalogItem, type FieldSchema } from '@/lib/configApi';
import { draftFrom, parseDraft, type Draft, type SchemaIssues } from '@/lib/configSchema';
import { ERROR_TEXT, FieldRow, SubHead, type Translate } from '@/pages/settings/configFields';
import { ConfigIcon, ProviderMark, type ConfigIconName } from '@/pages/settings/configIcons';
import { CopyAction, GroupCard, ListSkeleton, fill } from '@/pages/settings/configKit';
import {
  SIGN_IN_PROVIDERS,
  callbackUrl,
  filled,
  objectFields,
  providerById,
  providerSections,
  providerStatus,
  requiredFields,
  text,
  type ProviderRecord,
  type ProviderStatus,
  type SignInProvider,
} from '@/pages/settings/signInProviders';

const UPDATED_BY = 'settings-sign-in';

const STATUS: Record<ProviderStatus, { tone: BadgeTone; label: MessageKey }> = {
  live: { tone: 'success', label: 'settings.login.status.live' },
  off: { tone: 'neutral', label: 'settings.login.status.off' },
  incomplete: { tone: 'warn', label: 'settings.login.status.incomplete' },
};

type Entry = { provider: SignInProvider; item: CatalogItem };

function storedRecord(item: CatalogItem): ProviderRecord {
  return (item.schema ? draftFrom(item.schema, item.value) : {}) as ProviderRecord;
}

/** 授权登录: every OAuth provider in one list; `?provider=<id>` opens its settings. */
export function SignInProvidersSection() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setLoadError(null);
    try {
      const items = (await getLoginBuiltins()).flatMap((group) => group.items);
      setEntries(
        SIGN_IN_PROVIDERS.flatMap((provider) => {
          const item = items.find((entry) => entry.key === provider.key);
          return item?.schema?.type === 'object' ? [{ provider, item }] : [];
        }),
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  if (loading && !entries) return <ListSkeleton rows={4} />;
  if (loadError) {
    return (
      <Alert tone="danger">
        <p className="break-all">{loadError}</p>
        <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void reload()}>
          {t('settings.bootstrap.retry')}
        </Button>
      </Alert>
    );
  }
  if (!entries || entries.length === 0) {
    return <p className="py-16 text-center text-[14px] text-ink-faint">{t('settings.login.missing')}</p>;
  }

  const open = (id: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (id) next.set('provider', id);
        else next.delete('provider');
        return next;
      },
      { replace: false },
    );
  const selected = entries.find((entry) => entry.provider.id === providerById(params.get('provider'))?.id);

  if (selected) {
    return (
      <ProviderDetail
        key={selected.provider.id}
        entry={selected}
        onBack={() => open(null)}
        onSaved={() => reload()}
      />
    );
  }
  return <ProviderList t={t} entries={entries} onOpen={open} />;
}

function ProviderList({
  t,
  entries,
  onOpen,
}: {
  t: Translate;
  entries: Entry[];
  onOpen: (id: string) => void;
}) {
  const live = entries.filter(({ item }) => storedRecord(item).enabled === true).length;
  return (
    <div className="flex flex-col gap-4">
      <p className="flex max-w-2xl items-start gap-2 text-[13px] leading-5 text-ink-faint">
        <ConfigIcon name="info" className="mt-0.5 shrink-0" />
        {t('settings.login.hint')}
      </p>
      <GroupCard
        anchor="sign-in-providers"
        title={t('settings.login.providers')}
        icon="shield"
        meta={fill(t('settings.login.liveCount'), { n: live, total: entries.length })}
      >
        {entries.map(({ provider, item }) => {
          const fields = objectFields(item.schema);
          const status = STATUS[providerStatus(fields, storedRecord(item))];
          return (
            <li key={provider.id}>
              <button
                type="button"
                className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-[color:color-mix(in_srgb,var(--color-ink)_4%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--color-ink)]/20"
                onClick={() => onOpen(provider.id)}
              >
                <ProviderMark id={provider.id} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium text-ink">{t(provider.name)}</span>
                    <Badge tone={status.tone}>{t(status.label)}</Badge>
                  </span>
                  <span className="text-[12px] leading-5 text-ink-faint">{t(provider.description)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[13px] text-ink-muted">
                  {t('settings.login.configure')}
                  <IconChevronRight className="size-3.5" />
                </span>
              </button>
            </li>
          );
        })}
      </GroupCard>
    </div>
  );
}

function Checklist({ t, steps }: { t: Translate; steps: { label: string; done: boolean; hint?: string }[] }) {
  const done = steps.filter((step) => step.done).length;
  return (
    <section
      aria-labelledby="login-steps-title"
      className="rounded-[10px] border-[0.5px] border-border bg-bg-elevated px-4 py-3"
    >
      <header className="mb-2 flex items-center justify-between gap-3">
        <h3 id="login-steps-title" className="flex items-center gap-2 text-[14px] font-medium text-ink">
          <ConfigIcon name="checkCircle" className="text-ink-muted" />
          {t('settings.login.steps.title')}
        </h3>
        <span className="text-[12px] tabular-nums text-ink-faint">
          {fill(t('settings.login.steps.progress'), { done, total: steps.length })}
        </span>
      </header>
      <ol className="grid gap-x-6 gap-y-1.5 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.label} className="flex items-start gap-2 text-[13px] leading-5">
            <span
              className={cn(
                'mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] text-[11px] tabular-nums',
                step.done ? 'bg-ink text-on-primary' : 'bg-surface text-ink-faint',
              )}
              aria-hidden
            >
              {step.done ? '✓' : index + 1}
            </span>
            <span className={step.done ? 'text-ink-faint line-through' : 'text-ink'}>
              {step.label}
              {step.hint && !step.done ? (
                <span className="block text-[12px] text-ink-faint no-underline">{step.hint}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const SECTION_META: { id: 'credentials' | 'callback' | 'experience' | 'accounts'; icon: ConfigIconName; title: MessageKey }[] = [
  { id: 'credentials', icon: 'key', title: 'settings.login.section.credentials' },
  { id: 'callback', icon: 'link', title: 'settings.login.section.callback' },
  { id: 'experience', icon: 'qr', title: 'settings.login.section.experience' },
  { id: 'accounts', icon: 'userPlus', title: 'settings.login.section.accounts' },
];

function ProviderDetail({
  entry: { provider, item },
  onBack,
  onSaved,
}: {
  entry: Entry;
  onBack: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const schema = item.schema!;
  const baseline = draftFrom(schema, item.value);
  const [draft, setDraft] = useState<Draft>(baseline);
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const parsed = parseDraft(schema, draft, item.value);
  const issues: SchemaIssues = parsed.issues ?? {};
  const issueCount = Object.keys(issues).length;

  useEffect(() => {
    setDraft(draftFrom(schema, item.value));
  }, [item]);

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  const record = (draft ?? {}) as ProviderRecord;
  const stored = baseline as ProviderRecord;
  const fields = objectFields(schema);
  const sections = providerSections(provider, fields);
  const name = t(provider.name);
  const consoleName = t(provider.console);
  const set = (field: string) => (next: Draft) => {
    setDraft({ ...record, [field]: next });
    setSaveError(null);
  };
  const ok = (field: string) => filled(record, field) && !issues[field];

  const credentialsOk = sections.credentials.every((field) => ok(field.name));
  const domainOk = ok('callback_domain');
  const complete = requiredFields(fields).every((field) => ok(field.name));
  const enabled = record.enabled === true;
  const live = stored.enabled === true;
  const status = STATUS[providerStatus(fields, stored)];
  const domain = text(record, 'callback_domain');
  const canTest =
    text(stored, 'callback_domain') !== '' &&
    domain === text(stored, 'callback_domain') &&
    provider.testFields.every((field) => text(stored, field) !== '' && text(record, field) === text(stored, field));
  const enabledField = fields.find((field) => field.name === 'enabled');

  async function save() {
    if (!item.namespace) return;
    if (issueCount > 0) {
      setReveal(true);
      document.querySelector('[data-field-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await putConfig(item.namespace, item.key, { value: parsed.value, updated_by: UPDATED_BY });
      setReveal(false);
      toast.push({ title: fill(t('settings.login.saved'), { name }), tone: 'success' });
      await onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function row(entry: FieldSchema) {
    const required = !!entry.required_when && record[entry.required_when] === true;
    return (
      <li key={entry.name} className="px-4 py-4">
        <FieldRow
          t={t}
          head={(id) => (
            <SubHead t={t} id={id} label={entry.label} description={entry.description} required={required} />
          )}
          label={entry.label}
          schema={entry.schema}
          draft={record[entry.name] ?? null}
          issue={issues[entry.name]}
          reveal={reveal}
          onChange={set(entry.name)}
        />
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Button
        type="button"
        size="sm"
        variant="link"
        className="-ml-1 self-start text-ink-muted"
        onClick={() => (dirty ? setLeaving(true) : onBack())}
      >
        <IconChevronRight className="size-3.5 rotate-180" />
        {t('nav.settingsLogin')}
      </Button>

      <section
        aria-label={name}
        className="flex flex-wrap items-center gap-4 rounded-[10px] border-[0.5px] border-border bg-bg-elevated px-4 py-4"
      >
        <ProviderMark id={provider.id} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-medium text-ink">{name}</h3>
            <Badge tone={status.tone}>{t(status.label)}</Badge>
            {dirty ? <Badge tone="warn">{t('settings.runtime.unsaved')}</Badge> : null}
          </div>
          <p className="text-[12px] leading-5 text-ink-faint">{t(provider.description)}</p>
          {item.updated_by && item.configured ? (
            <p className="text-[12px] leading-5 text-ink-faint">
              {fill(t('settings.runtime.lastUpdated'), { who: item.updated_by })}
              {item.revision != null ? ` · ${t('settings.catalog.revision')} ${item.revision}` : ''}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canTest}
            title={canTest ? t('settings.login.test.hint') : t('settings.login.test.disabled')}
            onClick={() =>
              window.open(
                provider.testUrl(stored, callbackUrl(provider.id, text(stored, 'callback_domain'))),
                '_blank',
                'noopener,noreferrer,width=520,height=680',
              )
            }
          >
            <ConfigIcon name="external" />
            {t('settings.login.test')}
          </Button>
          {enabledField ? (
            <Switch
              aria-label={enabledField.label}
              checked={enabled}
              onCheckedChange={(next) => {
                set('enabled')(next);
                if (next && !complete) setReveal(true);
              }}
            />
          ) : null}
        </div>
      </section>

      {enabled && !complete ? (
        <Alert tone="warn">
          <div className="flex items-start gap-2">
            <ConfigIcon name="alert" className="mt-0.5 shrink-0" />
            <p>{t('settings.login.enableBlocked')}</p>
          </div>
        </Alert>
      ) : null}

      <Checklist
        t={t}
        steps={[
          {
            label: fill(t('settings.login.steps.app'), { console: consoleName }),
            done: credentialsOk,
          },
          {
            label: t('settings.login.steps.domain'),
            done: domainOk,
            hint: fill(t('settings.login.steps.domainHint'), { console: consoleName }),
          },
          { label: t('settings.login.steps.enable'), done: live && !dirty },
        ]}
      />

      {SECTION_META.map((meta) => {
        const entries = sections[meta.id].filter((field) => !provider.hidden?.(field.name, record));
        if (entries.length === 0) return null;
        return (
          <GroupCard
            key={meta.id}
            anchor={`login-${meta.id}`}
            title={t(meta.title)}
            icon={meta.icon}
            meta={
              meta.id === 'credentials' ? (
                <a
                  href={provider.consoleUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-[12px] text-ink-faint hover:text-ink"
                >
                  {fill(t('settings.login.openConsole'), { console: consoleName })}
                  <ConfigIcon name="external" size={12} />
                </a>
              ) : undefined
            }
          >
            {entries.map(row)}
            {meta.id === 'callback' ? (
              <li className="px-4 py-4">
                <div className="grid gap-x-8 gap-y-2 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] text-ink-muted">{t('settings.login.callbackUrl')}</span>
                    <p className="text-[12px] leading-5 text-ink-faint">
                      {fill(t('settings.login.callbackUrlHint'), { console: consoleName })}
                    </p>
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5">
                    {domain && domainOk ? (
                      <>
                        <code className="min-w-0 flex-1 break-all rounded-lg bg-[color:var(--color-control-fill)] px-3 py-2 font-mono text-[12px] leading-5 text-ink">
                          {callbackUrl(provider.id, domain)}
                        </code>
                        <CopyAction
                          value={callbackUrl(provider.id, domain)}
                          label={t('settings.bootstrap.copy')}
                          copiedLabel={t('settings.bootstrap.copied')}
                        />
                      </>
                    ) : (
                      <span className="text-[13px] text-ink-faint">{t('settings.login.callbackPending')}</span>
                    )}
                  </div>
                </div>
              </li>
            ) : null}
          </GroupCard>
        );
      })}

      {dirty || saveError ? (
        <div
          role="region"
          aria-label={t('settings.runtime.saveBar')}
          className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border-[0.5px] border-border bg-bg-elevated px-4 py-2.5 shadow-[var(--shadow-elevated)]"
        >
          <div className="flex min-w-0 flex-col">
            <span className="text-[13px] font-medium text-ink">{fill(t('settings.login.pending'), { name })}</span>
            {saveError ? (
              <span className={cn(ERROR_TEXT, 'flex items-start gap-1 break-all')} role="alert">
                <ConfigIcon name="alert" size={13} className="mt-[3px] shrink-0" />
                {saveError}
              </span>
            ) : reveal && issueCount > 0 ? (
              <span className={cn(ERROR_TEXT, 'flex items-center gap-1')}>
                <ConfigIcon name="alert" size={13} />
                {fill(t('settings.runtime.invalidCount'), { n: issueCount })}
              </span>
            ) : (
              <span className="text-[12px] text-ink-faint">{t('settings.login.pendingHint')}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setDraft(baseline);
                setReveal(false);
                setSaveError(null);
              }}
            >
              {t('settings.runtime.discard')}
            </Button>
            <Button type="button" size="sm" loading={saving} disabled={!dirty} onClick={() => void save()}>
              {t('settings.runtime.saveAll')}
            </Button>
          </div>
        </div>
      ) : null}

      <ConsoleConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={t('settings.login.leaveTitle')}
        description={fill(t('settings.login.leaveDesc'), { name })}
        confirmLabel={t('settings.runtime.discard')}
        cancelLabel={t('settings.login.keepEditing')}
        onConfirm={() => {
          setLeaving(false);
          onBack();
        }}
      />
    </div>
  );
}
