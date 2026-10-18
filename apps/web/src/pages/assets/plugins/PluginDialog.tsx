import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Checkbox, FormDialog, ConsoleFormField, Input, SearchSelect, useToast } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import {
  createPlugin,
  currentNamespace,
  PLUGIN_CATEGORIES,
  PLUGIN_SURFACES,
  pluginCategoryKey,
  pluginSurfaceKey,
  updatePlugin,
  type PackageVisibility,
  type PluginCard,
  type PluginSurface,
  type PluginWrite,
} from '@/lib/pluginHubApi';
import { AssetMark } from '@/pages/assets/shared/AssetHub';
import { FeaturedSwitch } from '@/pages/assets/shared/AssetFields';
import { errorMessage } from '@/pages/assets/shared/useAssetQuery';

type Draft = PluginWrite;

const EMPTY: Draft = {
  publisher: 'a3s',
  name: '',
  title: '',
  version: '1.0.0',
  category: 'general',
  description: '',
  surfaces: ['ui'],
  featured: false,
  visibility: 'public',
  note: '',
};

function draftOf(plugin: PluginCard): Draft {
  return {
    publisher: plugin.publisher,
    name: plugin.name,
    title: plugin.title ?? '',
    version: plugin.version,
    category: plugin.category,
    description: plugin.description,
    surfaces: plugin.surfaces,
    featured: plugin.featured,
    visibility: 'public',
    note: '',
  };
}

export function PluginDialog({
  open,
  onOpenChange,
  plugin,
  onSaved,
  fixedSurfaces,
  labels,
  namespaceScope = 'org',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plugin?: PluginCard;
  onSaved: (plugin: PluginCard) => void;
  /** Create flow that always publishes these surfaces. */
  fixedSurfaces?: readonly PluginSurface[];
  labels?: { create: string; edit: string; description: string };
  /** `org` on the organization page. `member` on the personal page. */
  namespaceScope?: 'org' | 'member';
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [logo, setLogo] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [archive, setArchive] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [home, setHome] = useState<string | null>(null);
  const logoUrl = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo]);
  const coverUrl = useMemo(() => (cover ? URL.createObjectURL(cover) : null), [cover]);

  useEffect(() => {
    return () => {
      if (logoUrl) URL.revokeObjectURL(logoUrl);
    };
  }, [logoUrl]);
  useEffect(() => {
    return () => {
      if (coverUrl) URL.revokeObjectURL(coverUrl);
    };
  }, [coverUrl]);

  useEffect(() => {
    if (!open) return;
    const base = plugin ? draftOf(plugin) : EMPTY;
    setDraft(fixedSurfaces ? { ...base, surfaces: [...fixedSurfaces] } : base);
    setLogo(null);
    setCover(null);
    setArchive(null);
    if (plugin) {
      setHome(plugin.publisher);
      return;
    }
    let live = true;
    setHome(null);
    currentNamespace(namespaceScope)
      .then((row) => {
        if (!live || !row.name) return;
        setHome(row.name);
        setDraft((current) => ({
          ...current,
          publisher: row.name ?? current.publisher,
          visibility: row.name === 'a3s' ? 'public' : current.visibility,
        }));
      })
      .catch(() => {
        if (live) setHome(null);
      });
    return () => {
      live = false;
    };
  }, [open, plugin, fixedSurfaces, namespaceScope]);

  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));
  const toggleSurface = (surface: PluginSurface, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      surfaces: checked
        ? [...current.surfaces, surface]
        : current.surfaces.filter((item) => item !== surface),
    }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const files = { logo, cover, pkg: archive };
      const publisher = plugin ? plugin.publisher : home;
      if (!publisher) return;
      const visibility: PackageVisibility = publisher === 'a3s' ? 'public' : (draft.visibility ?? 'public');
      const saved = plugin
        ? await updatePlugin(
            plugin.publisher,
            plugin.name,
            {
              title: draft.title,
              version: draft.version,
              category: draft.category,
              description: draft.description,
              surfaces: draft.surfaces,
              featured: draft.featured,
              visibility,
              note: draft.note,
            },
            files,
          )
        : await createPlugin({ ...draft, publisher, visibility }, files);
      onOpenChange(false);
      onSaved(saved);
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const ready =
    Boolean((plugin || home) && draft.name.trim() && draft.version.trim() && draft.surfaces.length > 0) &&
    (Boolean(plugin) || Boolean(logo && cover));

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={plugin ? (labels?.edit ?? t('assets.plugins.edit')) : (labels?.create ?? t('assets.plugins.create'))}
      description={labels?.description ?? t('assets.plugins.createDesc')}
      cancelLabel={t('assets.action.cancel')}
      submitLabel={plugin ? t('assets.action.save') : t('assets.action.create')}
      submitting={submitting}
      submitDisabled={!ready}
      onSubmit={submit}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <ConsoleFormField label={t('assets.plugins.field.publisher')} required>
          <Input value={plugin ? plugin.publisher : (home ?? '')} disabled readOnly />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.plugins.field.name')} required>
          <Input
            value={draft.name}
            disabled={Boolean(plugin)}
            placeholder="review"
            onChange={(event) => patch({ name: event.target.value })}
          />
        </ConsoleFormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ConsoleFormField label={t('assets.plugins.field.version')} required>
          <Input
            value={draft.version}
            placeholder="1.0.0"
            onChange={(event) => patch({ version: event.target.value })}
          />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.plugins.field.category')} required>
          <SearchSelect
            value={draft.category}
            searchable={false}
            allowClear={false}
            options={PLUGIN_CATEGORIES.map((category) => ({
              value: category,
              label: t(pluginCategoryKey(category)),
            }))}
            onChange={(next) => patch({ category: (next || 'general') as Draft['category'] })}
          />
        </ConsoleFormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ConsoleFormField label={t('assets.plugins.field.visibility')} required>
          <SearchSelect
            value={draft.publisher === 'a3s' || home === 'a3s' ? 'public' : (draft.visibility ?? 'public')}
            searchable={false}
            allowClear={false}
            options={
              (plugin ? plugin.publisher : home) === 'a3s'
                ? [{ value: 'public', label: t('assets.plugins.visibility.public') }]
                : [
                    { value: 'public', label: t('assets.plugins.visibility.public') },
                    { value: 'namespace', label: t('assets.plugins.visibility.namespace') },
                  ]
            }
            onChange={(next) =>
              patch({ visibility: (next === 'namespace' ? 'namespace' : 'public') as PackageVisibility })
            }
          />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.plugins.field.note')}>
          <Input
            value={draft.note ?? ''}
            maxLength={200}
            onChange={(event) => patch({ note: event.target.value.slice(0, 200) })}
          />
        </ConsoleFormField>
      </div>
      <ConsoleFormField label={t('assets.plugins.field.title')}>
        <Input
          value={draft.title}
          placeholder={draft.name || t('assets.plugins.field.name')}
          onChange={(event) => patch({ title: event.target.value })}
        />
      </ConsoleFormField>
      <ConsoleFormField label={t('assets.field.description')}>
        <Input
          value={draft.description}
          onChange={(event) => patch({ description: event.target.value })}
        />
      </ConsoleFormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <ConsoleFormField label={t('assets.plugins.field.logo')} required={!plugin}>
          <div className="flex items-center gap-3">
            <AssetMark
              name={draft.name || draft.publisher || '?'}
              color="#6E5CE6"
              iconUrl={logoUrl ?? plugin?.logoUrl}
              size={44}
            />
            <FilePick
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              label={t('assets.field.iconPick')}
              onFile={setLogo}
            />
          </div>
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.plugins.field.cover')} required={!plugin}>
          <div className="space-y-2">
            {coverUrl || plugin?.coverUrl ? (
              <img
                src={coverUrl ?? plugin?.coverUrl ?? ''}
                alt=""
                width={320}
                height={132}
                className="aspect-[320/132] w-full max-w-[320px] rounded-[14px] object-cover"
              />
            ) : null}
            <FilePick
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              label={t('assets.plugins.field.cover')}
              onFile={setCover}
            />
          </div>
        </ConsoleFormField>
      </div>
      <ConsoleFormField label={t('assets.plugins.field.archive')}>
        <FilePick accept=".aix" label={archive?.name || t('assets.plugins.field.archive')} onFile={setArchive} />
      </ConsoleFormField>
      {fixedSurfaces ? null : (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">{t('assets.plugins.field.surfaces')}</legend>
          <div className="flex flex-wrap gap-3">
            {PLUGIN_SURFACES.map((surface) => (
              <label key={surface} className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
                <Checkbox
                  checked={draft.surfaces.includes(surface)}
                  onCheckedChange={(checked) => toggleSurface(surface, checked === true)}
                />
                {t(pluginSurfaceKey(surface))}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <FeaturedSwitch checked={draft.featured} onChange={(featured) => patch({ featured })} />
    </FormDialog>
  );
}

function FilePick({
  accept,
  label,
  onFile,
}: {
  accept: string;
  label: string;
  onFile: (file: File | null) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer">
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          onFile(event.target.files?.[0] ?? null);
          event.target.value = '';
        }}
      />
      <span className="inline-flex h-[30px] max-w-full items-center truncate rounded-lg border border-[color:var(--color-quiet-border)] bg-bg-elevated px-3 text-[13px] text-ink hover:bg-[color:var(--color-quiet-hover)]">
        {label}
      </span>
    </label>
  );
}
