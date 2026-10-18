import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button, CopyButton, Input } from '@a3s-lab/ui';
import { SlideCaptcha } from '@/components/captcha/SlideCaptcha';
import { apiRequest } from '@/lib/apiClient';
import { putConfig } from '@/lib/configApi';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';

type EffectiveConfig = {
  tolerancePx: number;
  maxAttempts: number;
  challengeTtlSecs: number;
  tokenTtlSecs: number;
  minDurationMs: number;
};

type ConfigForm = {
  tolerancePx: string;
  maxAttempts: string;
  challengeTtlSecs: string;
  tokenTtlSecs: string;
  minDurationMs: string;
};

const CONFIG_KEYS: Record<keyof ConfigForm, string> = {
  tolerancePx: 'captcha.tolerance_px',
  maxAttempts: 'captcha.max_attempts',
  challengeTtlSecs: 'captcha.challenge_ttl_secs',
  tokenTtlSecs: 'captcha.token_ttl_secs',
  minDurationMs: 'captcha.min_duration_ms',
};

const DEFAULT_FORM: ConfigForm = {
  tolerancePx: '6',
  maxAttempts: '3',
  challengeTtlSecs: '180',
  tokenTtlSecs: '300',
  minDurationMs: '250',
};

const FIELDS = Object.keys(CONFIG_KEYS) as Array<keyof ConfigForm>;

type FieldSpec = {
  key: keyof ConfigForm;
  label: MessageKey;
  hint: MessageKey;
  unit?: string;
};

const GROUPS: Array<{ title: MessageKey; fields: FieldSpec[] }> = [
  {
    title: 'captcha.cfg.groupAlign',
    fields: [
      {
        key: 'tolerancePx',
        label: 'captcha.cfg.tolerance',
        hint: 'captcha.cfg.toleranceHint',
        unit: 'px',
      },
      {
        key: 'minDurationMs',
        label: 'captcha.cfg.minDuration',
        hint: 'captcha.cfg.minDurationHint',
        unit: 'ms',
      },
    ],
  },
  {
    title: 'captcha.cfg.groupAttempts',
    fields: [
      {
        key: 'maxAttempts',
        label: 'captcha.cfg.attempts',
        hint: 'captcha.cfg.attemptsHint',
      },
    ],
  },
  {
    title: 'captcha.cfg.groupLifetime',
    fields: [
      {
        key: 'challengeTtlSecs',
        label: 'captcha.cfg.challengeTtl',
        hint: 'captcha.cfg.challengeTtlHint',
        unit: 's',
      },
      {
        key: 'tokenTtlSecs',
        label: 'captcha.cfg.tokenTtl',
        hint: 'captcha.cfg.tokenTtlHint',
        unit: 's',
      },
    ],
  },
];

function toForm(config: EffectiveConfig): ConfigForm {
  return {
    tolerancePx: String(config.tolerancePx),
    maxAttempts: String(config.maxAttempts),
    challengeTtlSecs: String(config.challengeTtlSecs),
    tokenTtlSecs: String(config.tokenTtlSecs),
    minDurationMs: String(config.minDurationMs),
  };
}

function parseField(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

function sameForm(left: ConfigForm, right: ConfigForm): boolean {
  return FIELDS.every((field) => left[field].trim() === right[field].trim());
}

function tokenExpiry(seconds: number, t: (key: MessageKey) => string): string {
  if (seconds >= 60) {
    return t('captcha.tokenExpires').replace(
      '{n}',
      String(Math.max(1, Math.round(seconds / 60))),
    );
  }
  return t('captcha.tokenExpiresSecs').replace('{n}', String(Math.max(0, Math.round(seconds))));
}

function RuleField({
  id,
  spec,
  value,
  invalid,
  disabled,
  onChange,
}: {
  id: string;
  spec: FieldSpec;
  value: string;
  invalid: boolean;
  disabled: boolean;
  onChange: (key: keyof ConfigForm, value: string) => void;
}) {
  const { t } = useI18n();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="os-settings__field">
      <label className="os-settings__field-label" htmlFor={id}>
        {t(spec.label)}
      </label>
      <div className="os-captcha-field__control">
        <Input
          id={id}
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          value={value}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : hintId}
          onChange={(event) => onChange(spec.key, event.target.value)}
        />
        <span className="os-captcha-field__unit">{spec.unit ?? ''}</span>
      </div>
      {invalid ? (
        <p id={errorId} className="os-settings__field-error" role="alert">
          {t('captcha.cfg.invalid')}
        </p>
      ) : (
        <p id={hintId} className="os-settings__field-hint">
          {t(spec.hint)}
        </p>
      )}
    </div>
  );
}

/** 设置里的滑动拼图：参数写入 default 命名空间，预览走真实签发。 */
export function CaptchaSection() {
  const { t } = useI18n();
  const baseId = useId();
  const [config, setConfig] = useState<EffectiveConfig | null>(null);
  const [form, setForm] = useState<ConfigForm>(DEFAULT_FORM);
  const [baseline, setBaseline] = useState<ConfigForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(0);
  const [checkState, setCheckState] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [checking, setChecking] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const formRef = useRef(form);
  const baselineRef = useRef(baseline);
  const savingRef = useRef(false);
  formRef.current = form;
  baselineRef.current = baseline;

  const loadConfig = useCallback(async () => {
    try {
      const effective = await apiRequest<EffectiveConfig>('/captcha/config');
      const next = toForm(effective);
      const keepDraft = !sameForm(formRef.current, baselineRef.current);
      setConfig(effective);
      setBaseline(next);
      baselineRef.current = next;
      if (!keepDraft) {
        setForm(next);
        formRef.current = next;
      }
      return true;
    } catch {
      setConfig(null);
      return false;
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const persist = useCallback(
    async (next: ConfigForm) => {
      if (savingRef.current) return;
      if (FIELDS.some((field) => parseField(next[field]) == null)) return;
      savingRef.current = true;
      setSaving(true);
      setSaveFailed(false);
      try {
        for (const field of FIELDS) {
          const numeric = parseField(next[field]);
          if (numeric == null) return;
          await putConfig('default', fieldKey(field), {
            value: numeric,
            updated_by: 'settings-captcha',
          });
        }
        const loaded = await loadConfig();
        if (!loaded) {
          setSaveFailed(true);
          return;
        }
        setToken(null);
        setSavedAt(new Date().toLocaleTimeString());
        setPreviewKey((key) => key + 1);
      } catch {
        setSaveFailed(true);
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [loadConfig],
  );

  function updateField(key: keyof ConfigForm, value: string) {
    setSaveFailed(false);
    setSavedAt(null);
    setForm((previous) => {
      const next = { ...previous, [key]: value };
      formRef.current = next;
      return next;
    });
  }

  function discard() {
    setSaveFailed(false);
    setSavedAt(null);
    formRef.current = baseline;
    setForm(baseline);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = formRef.current;
    if (savingRef.current || sameForm(next, baseline)) return;
    if (FIELDS.some((field) => parseField(next[field]) == null)) return;
    void persist(next);
  }

  async function checkToken() {
    if (!token || checking) return;
    setChecking(true);
    try {
      const result = await apiRequest<{ valid: boolean }>('/captcha/token-verifications', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setCheckState(result.valid ? 'valid' : 'invalid');
    } catch {
      setCheckState('invalid');
    } finally {
      setChecking(false);
    }
  }

  const dirty = !sameForm(form, baseline);
  const invalid = FIELDS.some((field) => parseField(form[field]) == null);
  const atDefaults = sameForm(form, DEFAULT_FORM) && sameForm(baseline, DEFAULT_FORM);

  return (
    <div className="os-captcha">
      <div className="os-captcha-layout">
      <section className="os-captcha-col" aria-labelledby={`${baseId}-preview`}>
        <h3 id={`${baseId}-preview`} className="os-settings__group-title">
          {t('captcha.preview')}
        </h3>
        <SlideCaptcha
          key={previewKey}
          onVerified={(issued, expiresInSecs) => {
            setToken(issued);
            setExpiresIn(expiresInSecs);
            setCheckState('idle');
          }}
        />
        {token ? (
          <div className="os-captcha-token">
            <div className="os-captcha-token__head">
              <span className="os-captcha-token__title">{t('captcha.tokenLabel')}</span>
              <span className="os-captcha-token__expires">{tokenExpiry(expiresIn, t)}</span>
            </div>
            <p className="os-captcha-token__note">{t('captcha.tokenNote')}</p>
            <p className="os-captcha-token__value">{token}</p>
            <div className="os-captcha-token__actions">
              <CopyButton
                value={token}
                label={t('captcha.tokenCopy')}
                copiedLabel={t('captcha.tokenCopied')}
              />
              <Button
                type="button"
                size="sm"
                loading={checking}
                onClick={() => void checkToken()}
              >
                {t('captcha.tokenCheck')}
              </Button>
              {checkState === 'valid' ? (
                <span className="os-captcha-ok">{t('captcha.tokenValid')}</span>
              ) : null}
              {checkState === 'invalid' ? (
                <span className="os-captcha-bad">{t('captcha.tokenInvalid')}</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className="os-captcha-col" aria-labelledby={`${baseId}-rules`}>
        <h3 id={`${baseId}-rules`} className="os-settings__group-title">
          {t('captcha.cfg.title')}
        </h3>
        <form className="os-captcha-rules" onSubmit={onSubmit}>
          {GROUPS.map((group) => (
            <section key={group.title} className="os-settings__group">
              <h4 className="os-settings__group-title">{t(group.title)}</h4>
              <div className="os-captcha-fields">
                {group.fields.map((spec) => (
                  <RuleField
                    key={spec.key}
                    id={`${baseId}-${spec.key}`}
                    spec={spec}
                    value={form[spec.key]}
                    invalid={parseField(form[spec.key]) == null}
                    disabled={saving}
                    onChange={updateField}
                  />
                ))}
              </div>
            </section>
          ))}

          <p className="os-captcha-status">
            {config
              ? t('captcha.cfg.effective')
                  .replace('{tolerance}', String(config.tolerancePx))
                  .replace('{duration}', String(config.minDurationMs))
                  .replace('{attempts}', String(config.maxAttempts))
                  .replace('{challenge}', String(config.challengeTtlSecs))
                  .replace('{token}', String(config.tokenTtlSecs))
              : t('captcha.cfg.unavailable')}
          </p>
          {saveFailed ? (
            <p className="os-settings__field-error" role="alert">
              {t('captcha.cfg.saveFailed')}
            </p>
          ) : null}

          <footer className="os-settings__actions">
            {dirty ? (
              <Button type="button" variant="ghost" disabled={saving} onClick={discard}>
                {t('captcha.cfg.revert')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={saving || atDefaults}
              onClick={() => {
                formRef.current = DEFAULT_FORM;
                setForm(DEFAULT_FORM);
                void persist(DEFAULT_FORM);
              }}
            >
              {t('captcha.cfg.reset')}
            </Button>
            <Button type="submit" disabled={!dirty || saving || invalid} loading={saving}>
              {saving ? t('settings.actions.saving') : t('captcha.cfg.save')}
            </Button>
            {savedAt && !dirty ? (
              <span className="os-captcha-saved">
                {t('captcha.cfg.savedAt').replace('{n}', savedAt)}
              </span>
            ) : null}
          </footer>
        </form>
      </section>
      </div>
    </div>
  );
}

function fieldKey(field: keyof ConfigForm): string {
  return CONFIG_KEYS[field];
}
