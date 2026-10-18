import { useEffect, useState } from 'react';
import { Cascader, MultiCascader, type CascaderOption, type SearchSelectSize } from '@a3s-lab/ui';
import type { ChannelTerritory } from '@/data/channelPartners';
import type { DivisionCatalog } from '@/data/divisions';
import { useI18n } from '@/i18n/useI18n';

function toOptions(catalog: DivisionCatalog, parentId: string): CascaderOption[] {
  const nodes = catalog.childrenOf.get(parentId) ?? [];
  return nodes.map((node) => {
    const children = toOptions(catalog, node.id);
    return {
      value: node.id,
      label: node.name,
      keywords: node.code,
      ...(children.length > 0 ? { children } : {}),
    };
  });
}

export function RegionCascader({
  province,
  city,
  county,
  onChange,
  disabled = false,
  placeholder,
  className,
  size = 'md',
  expandSingleChild = true,
  nationwideOption,
  'aria-label': ariaLabel,
}: {
  province: string;
  city: string;
  county: string;
  onChange: (next: { province: string; city: string; county: string }) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  size?: SearchSelectSize;
  expandSingleChild?: boolean;
  nationwideOption?: { value: string; label: string };
  'aria-label'?: string;
}) {
  const { t } = useI18n();
  const [options, setOptions] = useState<CascaderOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    void import('@/data/divisions').then((mod) => {
      if (!cancelled) setOptions(toOptions(mod.loadDivisionCatalog(), ''));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value =
    nationwideOption && province === nationwideOption.value
      ? [nationwideOption.value]
      : [province, city, county].filter((part) => part.length > 0);
  const regionOptions = nationwideOption ? [nationwideOption, ...options] : options;

  return (
    <Cascader
      options={regionOptions}
      value={value}
      expandSingleChild={expandSingleChild}
      allowClear
      searchable
      size={size}
      className={className}
      disabled={disabled || options.length === 0}
      placeholder={placeholder ?? t('channels.field.regionEmpty')}
      searchPlaceholder={t('channels.field.regionSearch')}
      emptyText={t('channels.field.regionNone')}
      aria-label={ariaLabel ?? t('channels.field.region')}
      onChange={(path) => {
        if (nationwideOption && path[0] === nationwideOption.value) {
          onChange({ province: nationwideOption.value, city: '', county: '' });
          return;
        }
        onChange({
          province: path[0] ?? '',
          city: path[1] ?? '',
          county: path[2] ?? '',
        });
      }}
    />
  );
}

function territoryPath(item: ChannelTerritory): string[] {
  return [item.province, item.city, item.county].filter((part) => part.length > 0);
}

export function RegionCoverageField({
  nationwide,
  territories,
  onChange,
  allowClear = true,
  disabled = false,
}: {
  nationwide: boolean;
  territories: ChannelTerritory[];
  onChange: (next: { nationwide: boolean; territories: ChannelTerritory[] }) => void;
  allowClear?: boolean;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [options, setOptions] = useState<CascaderOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    void import('@/data/divisions').then((mod) => {
      if (!cancelled) setOptions(toOptions(mod.loadDivisionCatalog(), ''));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MultiCascader
      options={options}
      value={territories.map(territoryPath)}
      rootLabel={t('channels.field.nationwide')}
      rootSelected={nationwide}
      allowClear={allowClear}
      searchable
      disabled={disabled || options.length === 0}
      placeholder={t('channels.field.coverageEmpty')}
      searchPlaceholder={t('channels.field.regionSearch')}
      emptyText={t('channels.field.regionNone')}
      aria-label={t('channels.field.region')}
      onRootChange={(selected) => onChange({ nationwide: selected, territories: selected ? [] : territories })}
      onChange={(paths) =>
        onChange({
          nationwide: false,
          territories: paths.map((path) => ({
            province: path[0] ?? '',
            city: path[1] ?? '',
            county: path[2] ?? '',
          })),
        })
      }
    />
  );
}
