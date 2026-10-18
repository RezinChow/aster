import { useEffect, useState, type ReactNode } from 'react';
import { Button, Card, Input, useToast } from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { CHANNEL_LEVELS } from '@/data/channelPartners';
import {
  emptyLevelShares,
  formatShare,
  loadLevelShares,
  parseShare,
  saveLevelShares,
  type LevelShares,
} from '@/data/channelShares';
import { useI18n } from '@/i18n/useI18n';
import { levelLabel } from '@/pages/channels/ChannelTerritoryFields';

function ShareInput({
  value,
  label,
  placeholder,
  onChange,
}: {
  value: string;
  label: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex w-32 shrink-0 items-center gap-2">
      <Input
        size="sm"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        className="text-end tabular-nums"
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="w-4 text-sm text-ink-muted">%</span>
    </div>
  );
}

function RateCard({
  heading,
  valueLabel,
  children,
}: {
  heading: string;
  valueLabel: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-4 border-b border-divider px-4 py-2.5">
        <span className="text-xs font-medium text-ink-faint">{heading}</span>
        <span className="w-32 text-end text-xs font-medium text-ink-faint">{valueLabel}</span>
      </div>
      {children}
    </Card>
  );
}

export function ChannelLevelsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [levels, setLevels] = useState<LevelShares>(() => loadLevelShares());

  useEffect(() => {
    setLevels(loadLevelShares());
  }, []);

  function save() {
    const nextLevels = emptyLevelShares();
    for (const level of CHANNEL_LEVELS) {
      const parsed = parseShare(levels[level]);
      if (parsed === 'invalid') {
        toast.push({ tone: 'danger', title: t('channels.levels.invalid') });
        return;
      }
      nextLevels[level] = parsed == null ? '' : formatShare(parsed);
    }
    saveLevelShares(nextLevels);
    setLevels(nextLevels);
    toast.push({ tone: 'success', title: t('channels.levels.saved') });
  }

  return (
    <AdminPageShell
      title={t('channels.levels.title')}
      description={t('channels.levels.description')}
      backTo="/admin/channels"
      crumbs={[
        { label: t('channels.title'), to: '/channels' },
        { label: t('channels.levels.title') },
      ]}
    >
      <div className="os-settings-page">
        <div className="os-settings-form">
          <section className="os-settings__group">
            <div>
              <h2 className="os-settings__group-title">{t('channels.levels.section')}</h2>
              <p className="os-settings__field-hint">{t('channels.levels.sectionHint')}</p>
            </div>
            <RateCard heading={t('channels.field.level')} valueLabel={t('channels.field.share')}>
              {CHANNEL_LEVELS.map((level) => (
                <div
                  key={level}
                  className="flex items-center justify-between gap-4 border-b border-divider px-4 py-3 last:border-b-0"
                >
                  <span className="text-sm font-medium text-ink">{levelLabel(level, t)}</span>
                  <ShareInput
                    value={levels[level]}
                    label={levelLabel(level, t)}
                    placeholder={t('channels.levels.sharePlaceholder')}
                    onChange={(value) => setLevels((current) => ({ ...current, [level]: value }))}
                  />
                </div>
              ))}
            </RateCard>
          </section>
          <footer className="os-settings__actions">
            <Button type="button" onClick={save}>
              {t('channels.levels.save')}
            </Button>
          </footer>
        </div>
      </div>
    </AdminPageShell>
  );
}
