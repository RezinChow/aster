import { useEffect, useRef, useState, type RefObject } from 'react';
import { Button, ConsoleFormField, Input, ConsoleTextarea } from '@a3s-lab/ui';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import { useI18n } from '@/i18n/useI18n';
import {
  fetchTenantIndex,
  repairTenantRecord,
  saveTenantRecord,
  type TenantRecord,
} from '@/prefs/tenantAdminClient';
import { applyLaunchTenant, launchSlug, useLaunchBrandOverride } from '@/prefs/store';
import { tenantInfoFromRecord, type TenantInfo } from '@/prefs/tenantInfo';

type Draft = {
  nameZh: string;
  nameEn: string;
  product: string;
  descriptionZh: string;
  descriptionEn: string;
  brand: string;
  onBrand: string;
  themeLight: string;
  themeDark: string;
  body: string;
};

type Uploads = { light: string | null; dark: string | null };

const EMPTY_UPLOADS: Uploads = { light: null, dark: null };
const PNG_PREFIX = 'data:image/png;base64,';
const MAX_PNG_BYTES = 524288;

function draftFrom(info: TenantInfo): Draft {
  return {
    nameZh: info.name.zh,
    nameEn: info.name.en,
    product: info.product,
    descriptionZh: info.description.zh,
    descriptionEn: info.description.en,
    brand: info.brand,
    onBrand: info.on_brand,
    themeLight: info.theme_color.light,
    themeDark: info.theme_color.dark,
    body: info.body,
  };
}

function isDirty(info: TenantInfo, draft: Draft, uploads: Uploads): boolean {
  return (
    draft.nameZh !== info.name.zh ||
    draft.nameEn !== info.name.en ||
    draft.product !== info.product ||
    draft.descriptionZh !== info.description.zh ||
    draft.descriptionEn !== info.description.en ||
    draft.brand !== info.brand ||
    draft.onBrand !== info.on_brand ||
    draft.themeLight !== info.theme_color.light ||
    draft.themeDark !== info.theme_color.dark ||
    draft.body !== info.body ||
    !!uploads.light ||
    !!uploads.dark
  );
}

function readPngFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const name = file.name.toLowerCase();
    if ((file.type && file.type !== 'image/png') || (!file.type && !name.endsWith('.png'))) {
      reject(new Error('png'));
      return;
    }
    if (!name.endsWith('.png') && file.type !== 'image/png') {
      reject(new Error('png'));
      return;
    }
    if (file.size > MAX_PNG_BYTES) {
      reject(new Error('png'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('png'));
    reader.onload = () => {
      const raw = String(reader.result ?? '');
      if (!raw.startsWith(PNG_PREFIX)) {
        reject(new Error('png'));
        return;
      }
      try {
        const header = atob(raw.slice(PNG_PREFIX.length, PNG_PREFIX.length + 16));
        const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
        for (let i = 0; i < magic.length; i += 1) {
          if (header.charCodeAt(i) !== magic[i]) throw new Error('png');
        }
      } catch {
        reject(new Error('png'));
        return;
      }
      resolve(raw);
    };
    reader.readAsDataURL(file);
  });
}

function ColorField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const picker = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#000000';
  return (
    <ConsoleFormField label={label}>
      <div className="os-settings-color">
        <input
          type="color"
          value={picker}
          aria-label={label}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          value={value}
          maxLength={7}
          spellCheck={false}
          disabled={disabled}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </ConsoleFormField>
  );
}

export function TenantSystemSection() {
  const { t } = useI18n();
  const override = useLaunchBrandOverride();
  const lightInputRef = useRef<HTMLInputElement>(null);
  const darkInputRef = useRef<HTMLInputElement>(null);
  const [record, setRecord] = useState<TenantRecord | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploads, setUploads] = useState<Uploads>(EMPTY_UPLOADS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stamp, setStamp] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const index = await fetchTenantIndex();
        if (cancelled) return;
        const next = index.tenant?.slug === index.launch ? index.tenant : null;
        setRecord(next);
        setDraft(next?.info ? draftFrom(next.info) : null);
        setLoadError(null);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = !!(record?.info && draft && isDirty(record.info, draft, uploads));
  const shadowed = !!record && record.slug === launchSlug() && !!(override.name || override.logo);

  function patchDraft(partial: Partial<Draft>) {
    setNotice(null);
    setDraft((current) => (current ? { ...current, ...partial } : current));
  }

  function remember(saved: TenantInfo) {
    setRecord({ slug: saved.slug, info: saved, error: null });
    setDraft(draftFrom(saved));
    setUploads(EMPTY_UPLOADS);
    setStamp((value) => value + 1);
    setLogoError(null);
  }

  async function onSave() {
    if (!record?.info || !draft) return;
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      const info = tenantInfoFromRecord({
        ...record.info,
        name: { zh: draft.nameZh, en: draft.nameEn },
        product: draft.product,
        description: { zh: draft.descriptionZh, en: draft.descriptionEn },
        brand: draft.brand,
        on_brand: draft.onBrand,
        theme_color: { light: draft.themeLight, dark: draft.themeDark },
        body: draft.body,
      });
      const saved = await saveTenantRecord(info, uploads);
      applyLaunchTenant(saved);
      remember(saved);
      setNotice(t('settings.tenant.applied'));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('settings.tenant.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function onRepair() {
    if (!record) return;
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      const saved = await repairTenantRecord(record.slug);
      applyLaunchTenant(saved);
      remember(saved);
      setNotice(t('settings.tenant.repaired'));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('settings.tenant.unreadable'));
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    if (!record?.info) return;
    setDraft(draftFrom(record.info));
    setUploads(EMPTY_UPLOADS);
    setLogoError(null);
    setActionError(null);
    setNotice(null);
  }

  async function onPickLogo(surface: 'light' | 'dark', file: File | undefined) {
    if (!file) return;
    setLogoError(null);
    try {
      const dataUrl = await readPngFile(file);
      setNotice(null);
      setUploads((prev) => ({ ...prev, [surface]: dataUrl }));
    } catch {
      setLogoError(t('settings.tenant.logoError'));
    }
  }

  function logoSrc(file: string, dataUrl: string | null): string {
    if (dataUrl) return dataUrl;
    const query = stamp > 0 ? `?v=${stamp}` : '';
    return `/tenant/${record?.slug ?? ''}/${file}${query}`;
  }

  return (
    <div className="os-settings-form">
      {loadError ? (
        <AppErrorBanner
          message={`${t('settings.tenant.loadError')} ${loadError}`}
          onRetry={() => window.location.reload()}
        />
      ) : null}
      {actionError ? (
        <AppErrorBanner message={actionError} onRetry={() => setActionError(null)} />
      ) : null}

      {loading ? <p className="os-settings__placeholder">{t('settings.entries.loading')}</p> : null}

      {!loading && !loadError && !record ? (
        <p className="os-settings__placeholder">{t('settings.tenant.empty')}</p>
      ) : null}

      {record && !record.info ? (
        <div className="os-settings__fields">
          <p className="os-settings__field-error" role="alert">
            {t('settings.tenant.unreadable')}
            {record.error ? ` ${record.error}` : ''}
          </p>
          <div className="os-settings__actions">
            <Button type="button" variant="outline" disabled={saving} onClick={() => void onRepair()}>
              {t('settings.tenant.repair')}
            </Button>
          </div>
        </div>
      ) : null}

      {record?.info && draft ? (
        <>
          {shadowed ? (
            <p className="os-settings__field-error" role="status">
              {t('settings.tenant.override')}
            </p>
          ) : null}
          {logoError ? (
            <p className="os-settings__field-error" role="alert">
              {logoError}
            </p>
          ) : null}
          {notice ? (
            <p className="os-settings__field-hint" role="status">
              {notice}
            </p>
          ) : null}

          <section className="os-settings__group">
            <h4 className="os-settings__group-title">{t('settings.tenant.groupIdentity')}</h4>
            <div className="os-settings-tenant-grid">
              <ConsoleFormField label={t('settings.tenant.slug')}>
                <Input value={record.slug} disabled spellCheck={false} />
              </ConsoleFormField>
              <ConsoleFormField label={t('settings.tenant.product')}>
                <Input
                  value={draft.product}
                  maxLength={64}
                  disabled={saving}
                  placeholder={t('settings.tenant.productPlaceholder')}
                  onChange={(event) => patchDraft({ product: event.target.value })}
                />
              </ConsoleFormField>
              <ConsoleFormField label={t('settings.tenant.nameZh')}>
                <Input
                  value={draft.nameZh}
                  maxLength={64}
                  disabled={saving}
                  placeholder={t('settings.tenant.nameZhPlaceholder')}
                  onChange={(event) => patchDraft({ nameZh: event.target.value })}
                />
              </ConsoleFormField>
              <ConsoleFormField label={t('settings.tenant.nameEn')}>
                <Input
                  value={draft.nameEn}
                  maxLength={64}
                  disabled={saving}
                  placeholder={t('settings.tenant.nameEnPlaceholder')}
                  onChange={(event) => patchDraft({ nameEn: event.target.value })}
                />
              </ConsoleFormField>
              <ConsoleFormField label={t('settings.tenant.descriptionZh')}>
                <Input
                  value={draft.descriptionZh}
                  maxLength={120}
                  disabled={saving}
                  placeholder={t('settings.tenant.descriptionZhPlaceholder')}
                  onChange={(event) => patchDraft({ descriptionZh: event.target.value })}
                />
              </ConsoleFormField>
              <ConsoleFormField label={t('settings.tenant.descriptionEn')}>
                <Input
                  value={draft.descriptionEn}
                  maxLength={120}
                  disabled={saving}
                  placeholder={t('settings.tenant.descriptionEnPlaceholder')}
                  onChange={(event) => patchDraft({ descriptionEn: event.target.value })}
                />
              </ConsoleFormField>
              <ConsoleFormField label={t('settings.tenant.body')} className="is-wide">
                <ConsoleTextarea
                  rows={4}
                  value={draft.body}
                  disabled={saving}
                  onChange={(event) => patchDraft({ body: event.target.value })}
                />
              </ConsoleFormField>
            </div>
          </section>

          <section className="os-settings__group">
            <h4 className="os-settings__group-title">{t('settings.tenant.groupBrand')}</h4>
            <div className="os-settings-tenant-grid">
              <ColorField
                label={t('settings.tenant.brand')}
                value={draft.brand}
                disabled={saving}
                onChange={(brand) => patchDraft({ brand })}
              />
              <ColorField
                label={t('settings.tenant.onBrand')}
                value={draft.onBrand}
                disabled={saving}
                onChange={(onBrand) => patchDraft({ onBrand })}
              />
              <ColorField
                label={t('settings.tenant.themeLight')}
                value={draft.themeLight}
                disabled={saving}
                onChange={(themeLight) => patchDraft({ themeLight })}
              />
              <ColorField
                label={t('settings.tenant.themeDark')}
                value={draft.themeDark}
                disabled={saving}
                onChange={(themeDark) => patchDraft({ themeDark })}
              />
            </div>
          </section>

          <section className="os-settings__group">
            <h4 className="os-settings__group-title">{t('settings.tenant.groupLogos')}</h4>
            <div className="os-settings-logos">
              <LogoField
                label={t('settings.tenant.logoLight')}
                surface="light"
                src={logoSrc(record.info.logos.light_surface, uploads.light)}
                disabled={saving}
                replaceLabel={t('settings.tenant.replaceLogo')}
                inputRef={lightInputRef}
                onPick={(file) => void onPickLogo('light', file)}
              />
              <LogoField
                label={t('settings.tenant.logoDark')}
                surface="dark"
                src={logoSrc(record.info.logos.dark_surface, uploads.dark)}
                disabled={saving}
                replaceLabel={t('settings.tenant.replaceLogo')}
                inputRef={darkInputRef}
                onPick={(file) => void onPickLogo('dark', file)}
              />
            </div>
          </section>

          <footer className="os-settings__actions">
            <Button type="button" variant="outline" disabled={saving} onClick={() => void onRepair()}>
              {t('settings.tenant.repair')}
            </Button>
            <Button type="button" variant="outline" disabled={!dirty || saving} onClick={onReset}>
              {t('settings.actions.reset')}
            </Button>
            <Button type="button" disabled={!dirty || saving} onClick={() => void onSave()}>
              {saving ? t('settings.actions.saving') : t('settings.tenant.save')}
            </Button>
          </footer>
        </>
      ) : null}
    </div>
  );
}

function LogoField({
  label,
  surface,
  src,
  disabled,
  replaceLabel,
  inputRef,
  onPick,
}: {
  label: string;
  surface: 'light' | 'dark';
  src: string;
  disabled: boolean;
  replaceLabel: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onPick: (file: File | undefined) => void;
}) {
  return (
    <div className="os-settings-logo">
      <div className="os-settings-logo__stage" data-surface={surface}>
        <img src={src} alt={label} decoding="async" draggable={false} />
      </div>
      <div className="os-settings-logo__meta">
        <span>{label}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/png"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            onPick(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {replaceLabel}
        </Button>
      </div>
    </div>
  );
}
