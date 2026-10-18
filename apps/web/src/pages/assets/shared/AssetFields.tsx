import { useEffect, useMemo } from 'react';
import { Button, Input, SearchSelect, Switch } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import { ASSET_CATEGORIES, type AssetCategory } from '@/lib/assetHubApi';
import { AssetMark } from './AssetHub';
import { categoryLabel } from './taxonomy';

export const DEFAULT_COLOR = '#2563EB';

export function CategorySelect({
  value,
  onChange,
}: {
  value: AssetCategory;
  onChange: (value: AssetCategory) => void;
}) {
  const { locale } = useI18n();
  return (
    <SearchSelect
      value={value}
      allowClear={false}
      options={ASSET_CATEGORIES.map((category) => ({
        value: category,
        label: categoryLabel(category, locale),
      }))}
      onChange={(next) => onChange((next || 'other') as AssetCategory)}
    />
  );
}

export function ColorInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label="color"
        className="h-[30px] w-10 shrink-0 cursor-pointer rounded-md border border-[color:var(--color-hairline)] bg-transparent p-0.5"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : DEFAULT_COLOR}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
      />
      <Input size="sm" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

/** Icon preview + pick / clear; `current` is the stored icon URL. */
export function IconInput({
  name,
  color,
  current,
  file,
  removed,
  onFile,
  onRemove,
}: {
  name: string;
  color: string;
  current?: string | null;
  file: File | null;
  removed: boolean;
  onFile: (file: File | null) => void;
  onRemove: (removed: boolean) => void;
}) {
  const { t } = useI18n();
  const fileUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
  }, [fileUrl]);
  const preview = fileUrl ?? (removed ? null : current);
  return (
    <div className="flex items-center gap-3">
      <AssetMark name={name || '?'} color={color} iconUrl={preview} size={44} />
      <label className="cursor-pointer">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="sr-only"
          onChange={(event) => {
            onFile(event.target.files?.[0] ?? null);
            onRemove(false);
            event.target.value = '';
          }}
        />
        <span className="inline-flex h-[30px] items-center rounded-lg border border-[color:var(--color-quiet-border)] bg-bg-elevated px-3 text-[13px] text-ink hover:bg-[color:var(--color-quiet-hover)]">
          {t('assets.field.iconPick')}
        </span>
      </label>
      {file || (current && !removed) ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            onFile(null);
            onRemove(Boolean(current));
          }}
        >
          {t('assets.field.iconClear')}
        </Button>
      ) : null}
    </div>
  );
}

export function FeaturedSwitch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const { t } = useI18n();
  return <Switch checked={checked} onCheckedChange={onChange} label={t('assets.field.featured')} />;
}
