import { ConsoleFormField, SearchSelect } from '@a3s-lab/ui';
import { RegionCoverageField } from '@/components/RegionCascader';
import {
  CHANNEL_LEVELS,
  isChannelLevel,
  type ChannelPartnerInput,
} from '@/data/channelPartners';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';

const LEVEL_KEY: Record<(typeof CHANNEL_LEVELS)[number], MessageKey> = {
  registered: 'channels.level.registered',
  authorized: 'channels.level.authorized',
  silver: 'channels.level.silver',
  gold: 'channels.level.gold',
  strategic: 'channels.level.strategic',
};

export function levelLabel(
  level: string,
  t: (key: MessageKey) => string,
): string {
  if (!level) return '';
  return isChannelLevel(level) ? t(LEVEL_KEY[level]) : level;
}

export function ChannelTerritoryFields({
  draft,
  onChange,
  levelRequired = false,
}: {
  draft: Pick<ChannelPartnerInput, 'level' | 'nationwide' | 'territories' | 'province' | 'city' | 'county'>;
  onChange: (next: Partial<ChannelPartnerInput>) => void;
  levelRequired?: boolean;
}) {
  const { t } = useI18n();

  const levelOptions: { value: string; label: string }[] = CHANNEL_LEVELS.map((value) => ({
    value,
    label: t(LEVEL_KEY[value]),
  }));
  if (draft.level && !isChannelLevel(draft.level)) {
    levelOptions.unshift({ value: draft.level, label: draft.level });
  }

  return (
    <>
      <ConsoleFormField label={t('channels.field.level')} required={levelRequired}>
        <SearchSelect
          searchable={false}
          allowClear={!levelRequired}
          value={draft.level}
          onChange={(value) => onChange({ level: value })}
          options={levelOptions}
          placeholder={t('channels.field.levelEmpty')}
          aria-label={t('channels.field.level')}
        />
      </ConsoleFormField>
      <ConsoleFormField label={t('channels.field.region')} className="sm:col-span-2">
        <RegionCoverageField
          nationwide={draft.nationwide}
          territories={draft.territories}
          onChange={onChange}
        />
      </ConsoleFormField>
    </>
  );
}
