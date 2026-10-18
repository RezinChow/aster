import { useI18n } from '@/i18n/useI18n';
import type { HubRuntime } from '@/lib/modelsApi';
import type { MessageKey } from '@/i18n/messages';

function formatBytes(value?: number | null) {
  if (value == null || value < 0) return null;
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatCount(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function factRows(rows: Array<[string, string | null | undefined]>) {
  return rows.filter((row): row is [string, string] => Boolean(row[1]));
}

/** Hub-published model family / arch — closest to “硬件型号” operators use when sizing GPUs. */
export function hardwareModelLabel(runtime?: HubRuntime | null): string | null {
  if (!runtime) return null;
  const arch = runtime.architectures?.filter(Boolean).join(', ');
  if (arch) return arch;
  if (runtime.model_type?.trim()) return runtime.model_type.trim();
  return null;
}

export function weightFormatLabel(runtime?: HubRuntime | null): string | null {
  const formats = runtime?.weight_formats?.filter(Boolean);
  return formats?.length ? formats.join(', ') : null;
}

export function engineLabel(runtime?: HubRuntime | null): string | null {
  const engines = runtime?.backends?.filter(Boolean);
  if (engines?.length) return engines.join(', ');
  if (runtime?.library?.trim()) return runtime.library.trim();
  return null;
}

function shortenEngines(value: string, max = 2): string {
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length <= max) return parts.join(', ');
  return `${parts.slice(0, max).join(', ')} +${parts.length - max}`;
}

/** Shared System / Hardware facts for import preview and admitted model detail. */
export function ModelRuntimeFacts({ runtime }: { runtime?: HubRuntime | null }) {
  const { t } = useI18n();
  const hardwareModel = hardwareModelLabel(runtime);
  const formats = weightFormatLabel(runtime);
  const engines = engineLabel(runtime);

  const primary = factRows([
    [t('models.hardwareModel'), hardwareModel],
    [t('models.weightFormats'), formats],
    [t('models.backends'), engines],
  ]);
  const hardware = factRows([
    [t('models.parameters'), runtime?.parameters ? formatCount(runtime.parameters) : null],
    [t('models.dtypes'), runtime?.dtypes?.length ? runtime.dtypes.join(', ') : null],
    [t('models.weightSize'), formatBytes(runtime?.weight_bytes ?? null)],
  ]);
  const system = factRows([
    [t('models.pipeline'), runtime?.pipeline],
    [t('models.library'), runtime?.library],
    [t('models.modelType'), runtime?.model_type],
    [t('models.autoModel'), runtime?.auto_model],
    [t('models.processor'), runtime?.processor],
  ]);

  if (primary.length === 0 && hardware.length === 0 && system.length === 0) {
    return <p className="os-settings__field-hint">{t('models.runtimeEmpty')}</p>;
  }

  return (
    <div className="os-models-runtime-stack">
      {primary.length > 0 ? (
        <ul className="os-models-runtime-highlights">
          {primary.map(([label, value]) => (
            <li key={label}>
              <span className="os-models-runtime-highlights__label">{label}</span>
              <strong className="os-models-runtime-highlights__value">{value}</strong>
            </li>
          ))}
        </ul>
      ) : null}

      {hardware.length > 0 ? (
        <section className="os-models-runtime">
          <h3>{t('models.hardware')}</h3>
          <dl>
            {hardware.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {system.length > 0 ? (
        <section className="os-models-runtime">
          <h3>{t('models.system')}</h3>
          <dl>
            {system.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

type ChipTone = 'format' | 'engine' | 'hardware' | 'meta';

type RuntimeChip = {
  tone: ChipTone;
  labelKey: MessageKey;
  value: string;
};

/** Labeled chips for list rows — weight format / engines / hardware model first. */
export function ModelRuntimeChips({ runtime }: { runtime?: HubRuntime | null }) {
  const { t } = useI18n();
  if (!runtime) return null;

  const chips: RuntimeChip[] = [];
  const formats = weightFormatLabel(runtime);
  if (formats) {
    chips.push({
      tone: 'format',
      labelKey: 'models.chip.format',
      value: formats,
    });
  }
  const engines = engineLabel(runtime);
  if (engines) {
    chips.push({
      tone: 'engine',
      labelKey: 'models.chip.engine',
      value: shortenEngines(engines),
    });
  }
  const hardware = hardwareModelLabel(runtime);
  if (hardware) {
    chips.push({
      tone: 'hardware',
      labelKey: 'models.chip.hardware',
      value: hardware,
    });
  }
  if (runtime.dtypes?.length) {
    chips.push({
      tone: 'meta',
      labelKey: 'models.chip.dtype',
      value: runtime.dtypes.slice(0, 2).join('/'),
    });
  }
  const size = formatBytes(runtime.weight_bytes ?? null);
  if (size) {
    chips.push({
      tone: 'meta',
      labelKey: 'models.chip.size',
      value: size,
    });
  }
  if (chips.length === 0) return null;

  return (
    <ul className="os-models-runtime-chips" aria-label={t('models.runtime')}>
      {chips.map((chip, index) => (
        <li
          key={`${chip.labelKey}-${index}`}
          className={`os-models-runtime-chips__item is-${chip.tone}`}
          title={`${t(chip.labelKey)}: ${chip.value}`}
        >
          <span className="os-models-runtime-chips__k">{t(chip.labelKey)}</span>
          <span className="os-models-runtime-chips__v">{chip.value}</span>
        </li>
      ))}
    </ul>
  );
}
