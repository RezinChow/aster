import { useId, useState, type ReactNode } from 'react';
import { Badge, Button, FileDropzone, Input, SearchSelect, Switch, ConsoleTextarea, cn } from '@a3s-lab/ui';
import type { MessageKey } from '@/i18n/messages';
import type { IntegerUnit, ValueSchema } from '@/lib/configApi';
import {
  humanizeDuration,
  isSecretDraft,
  maskSecret,
  type Draft,
  type SchemaIssue,
} from '@/lib/configSchema';
import { ConfigIcon } from '@/pages/settings/configIcons';
import { fill } from '@/pages/settings/configKit';

export type Translate = (key: MessageKey) => string;

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';
const DURATION_PRESETS: Partial<Record<IntegerUnit, number[]>> = {
  hours: [24, 168, 720],
  seconds: [3600, 21_600, 86_400],
};
const UNIT_KEYS: Record<IntegerUnit, MessageKey> = {
  megabytes: 'settings.runtime.unit.megabytes',
  seconds: 'settings.runtime.unit.seconds',
  hours: 'settings.runtime.unit.hours',
  items: 'settings.runtime.unit.items',
};
/** Up to this many options read better as a segmented control than a picker. */
const SEGMENTED_MAX = 3;

export const ERROR_TEXT = 'text-[12px] leading-5 text-[color:var(--color-danger-text)]';

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

export function issueText(t: Translate, issue: SchemaIssue | undefined) {
  if (!issue) return undefined;
  switch (issue.code) {
    case 'range':
      return fill(t('settings.runtime.issue.range'), issue);
    case 'tooLong':
      return fill(t('settings.runtime.issue.tooLong'), issue);
    case 'imageTooLarge':
      return fill(t('settings.runtime.issue.imageTooLarge'), { size: formatBytes(issue.maxBytes) });
    case 'pattern':
      return issue.message;
    default:
      return t(`settings.runtime.issue.${issue.code}`);
  }
}

function durationText(t: Translate, value: number, unit: IntegerUnit) {
  if (unit !== 'hours' && unit !== 'seconds') return null;
  const hint = humanizeDuration(value, unit);
  if (!hint) return null;
  const text = fill(t(`settings.runtime.duration.${hint.unit}`), { n: hint.amount });
  return hint.approx ? `≈ ${text}` : text;
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

/** Segmented control: white pill on the `#f5f5f5` track, role `radiogroup`. */
export function Segmented({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id?: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      className="inline-flex h-[30px] items-stretch gap-0.5 self-start rounded-lg bg-[color:var(--color-control-fill)] p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cn(
              'inline-flex items-center rounded-[6px] px-3 text-[13px] outline-none transition-colors focus-visible:shadow-[inset_0_0_0_2px_rgba(0,0,0,0.1)]',
              selected
                ? 'bg-bg-elevated font-medium text-ink shadow-[var(--shadow-segment)]'
                : 'text-[color:var(--color-segment-rest)] hover:text-ink',
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function IntegerControl({
  t,
  id,
  schema,
  draft,
  invalid,
  onChange,
}: {
  t: Translate;
  id: string;
  schema: Extract<ValueSchema, { type: 'integer' }>;
  draft: string;
  invalid: boolean;
  onChange: (next: string) => void;
}) {
  const n = Number(draft);
  const duration =
    schema.unit && draft.trim() && Number.isInteger(n) ? durationText(t, n, schema.unit) : null;
  const presets = (schema.unit ? DURATION_PRESETS[schema.unit] : undefined)?.filter(
    (preset) => preset >= schema.min && preset <= schema.max,
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="w-28">
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={schema.min}
            max={schema.max}
            step={1}
            value={draft}
            aria-invalid={invalid}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
        {schema.unit ? (
          <span className="text-[13px] text-ink-muted">{t(UNIT_KEYS[schema.unit])}</span>
        ) : null}
        {duration ? <span className="text-[12px] text-ink-faint">{duration}</span> : null}
      </div>
      {presets && presets.length > 0 && schema.unit ? (
        <div className="flex flex-wrap gap-1">
          {presets.map((preset) => {
            const selected = String(preset) === draft.trim();
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={selected}
                className={cn(
                  'h-6 rounded-[6px] px-2 text-[12px] outline-none transition-colors focus-visible:shadow-[inset_0_0_0_2px_rgba(0,0,0,0.1)]',
                  selected
                    ? 'bg-surface font-medium text-ink'
                    : 'text-ink-faint hover:bg-surface-2 hover:text-ink',
                )}
                onClick={() => onChange(String(preset))}
              >
                {durationText(t, preset, schema.unit!)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SecretControl({
  t,
  id,
  draft,
  invalid,
  onChange,
}: {
  t: Translate;
  id: string;
  draft: Extract<Draft, { kind: 'secret' }>;
  invalid: boolean;
  onChange: (next: Draft) => void;
}) {
  const [shown, setShown] = useState(false);
  const hasCurrent = draft.current.length > 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-6 items-center gap-1.5">
        <ConfigIcon
          name="lock"
          size={14}
          className={hasCurrent ? 'text-ink-muted' : 'text-ink-faint'}
        />
        <span className="text-[13px] text-ink">
          {hasCurrent ? t('settings.runtime.secret.set') : t('settings.runtime.secret.unset')}
        </span>
        {hasCurrent ? (
          <code className="font-mono text-[12px] text-ink-faint">{maskSecret(draft.current)}</code>
        ) : null}
        {hasCurrent ? (
          <button
            type="button"
            className="ml-auto text-[13px] text-ink-faint outline-none hover:text-ink focus-visible:underline"
            onClick={() => onChange({ ...draft, clear: !draft.clear, next: '' })}
          >
            {draft.clear ? t('settings.runtime.secret.undoClear') : t('settings.runtime.secret.clear')}
          </button>
        ) : null}
      </div>
      {draft.clear ? (
        <p className={ERROR_TEXT}>{t('settings.runtime.secret.willClear')}</p>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type={shown ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            value={draft.next}
            aria-invalid={invalid}
            placeholder={
              hasCurrent
                ? t('settings.runtime.secret.keepPlaceholder')
                : t('settings.runtime.secret.newPlaceholder')
            }
            onChange={(event) => onChange({ ...draft, next: event.target.value })}
          />
          <Button
            type="button"
            size="md"
            variant="outline"
            className="w-9 shrink-0 px-0"
            disabled={!draft.next}
            aria-label={shown ? t('settings.runtime.secret.hide') : t('settings.runtime.secret.show')}
            title={shown ? t('settings.runtime.secret.hide') : t('settings.runtime.secret.show')}
            aria-pressed={shown}
            onClick={() => setShown((value) => !value)}
          >
            <ConfigIcon name="eye" />
          </Button>
        </div>
      )}
    </div>
  );
}

function ImageControl({
  t,
  schema,
  draft,
  onChange,
  onIssue,
}: {
  t: Translate;
  schema: Extract<ValueSchema, { type: 'image_data_url' }>;
  draft: string | null;
  onChange: (next: string | null) => void;
  onIssue: (message: string | null) => void;
}) {
  const size = formatBytes(schema.max_bytes);
  async function take(files: File[]) {
    const file = files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onIssue(t('settings.runtime.issue.image'));
      return;
    }
    const dataUrl = await readImage(file);
    if (dataUrl.length > schema.max_bytes) {
      onIssue(fill(t('settings.runtime.issue.imageTooLarge'), { size }));
      return;
    }
    onIssue(null);
    onChange(dataUrl);
  }
  const hint = fill(t('settings.runtime.image.hint'), { size });
  if (!draft) {
    return (
      <FileDropzone
        accept={IMAGE_ACCEPT}
        label={t('settings.runtime.image.upload')}
        hint={hint}
        className="py-5!"
        onFiles={(files) => void take(files)}
      />
    );
  }
  return (
    <div className="flex items-center gap-3">
      <img
        src={draft}
        alt=""
        className="size-14 rounded-lg bg-[color:var(--color-control-fill)] object-contain p-1.5"
      />
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          <label className="cursor-pointer">
            <span className="inline-flex h-[30px] items-center rounded-lg px-2.5 text-[13px] text-ink hover:bg-[color:var(--color-control-fill)]">
              {t('settings.runtime.image.replace')}
            </span>
            <input
              type="file"
              accept={IMAGE_ACCEPT}
              className="sr-only"
              onChange={(event) => {
                void take(Array.from(event.target.files ?? []));
                event.target.value = '';
              }}
            />
          </label>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
            {t('settings.runtime.image.remove')}
          </Button>
        </div>
        <span className="text-[12px] text-ink-faint">{hint}</span>
      </div>
    </div>
  );
}

/** The input for one schema value; labels live in the row head. */
export function FieldInput({
  t,
  id,
  label,
  schema,
  draft,
  invalid,
  onChange,
  onIssue,
}: {
  t: Translate;
  id: string;
  label: string;
  schema: ValueSchema;
  draft: Draft;
  invalid: boolean;
  onChange: (next: Draft) => void;
  onIssue: (message: string | null) => void;
}) {
  switch (schema.type) {
    case 'boolean':
      return <Switch id={id} checked={draft === true} onCheckedChange={onChange} />;
    case 'integer':
      return (
        <IntegerControl
          t={t}
          id={id}
          schema={schema}
          draft={typeof draft === 'string' ? draft : ''}
          invalid={invalid}
          onChange={onChange}
        />
      );
    case 'text': {
      const text = typeof draft === 'string' ? draft : '';
      return schema.multiline ? (
        <ConsoleTextarea
          id={id}
          rows={3}
          value={text}
          placeholder={schema.placeholder}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={text}
          spellCheck={schema.pattern ? false : undefined}
          placeholder={schema.placeholder}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    }
    case 'url':
      return (
        <Input
          id={id}
          type="url"
          inputMode="url"
          spellCheck={false}
          value={typeof draft === 'string' ? draft : ''}
          placeholder={schema.placeholder}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case 'secret':
      return isSecretDraft(draft) ? (
        <SecretControl t={t} id={id} draft={draft} invalid={invalid} onChange={onChange} />
      ) : null;
    case 'enum':
      return schema.options.length <= SEGMENTED_MAX ? (
        <Segmented
          id={id}
          label={label}
          options={schema.options}
          value={typeof draft === 'string' ? draft : ''}
          onChange={onChange}
        />
      ) : (
        <SearchSelect
          id={id}
          options={schema.options}
          value={typeof draft === 'string' ? draft : ''}
          searchable={false}
          allowClear={false}
          aria-label={label}
          onChange={onChange}
        />
      );
    case 'image_data_url':
      return (
        <ImageControl
          t={t}
          schema={schema}
          draft={typeof draft === 'string' ? draft : null}
          onChange={onChange}
          onIssue={onIssue}
        />
      );
    case 'object':
      return null;
  }
}

function fieldMeta(t: Translate, schema: ValueSchema, draft: Draft) {
  if (schema.type === 'integer') return fill(t('settings.runtime.range'), schema);
  if (schema.type === 'text') {
    return `${[...(typeof draft === 'string' ? draft : '')].length}/${schema.max_len}`;
  }
  return undefined;
}

/**
 * Label and description on the left, the control in a fixed right column. An issue
 * shows once the control has been left, or straight away when `reveal` is set
 * (after a save attempt).
 */
export function FieldRow({
  t,
  head,
  label,
  schema,
  draft,
  issue,
  reveal = false,
  onChange,
}: {
  t: Translate;
  head: (id: string) => ReactNode;
  label: string;
  schema: ValueSchema;
  draft: Draft;
  issue?: SchemaIssue;
  reveal?: boolean;
  onChange: (next: Draft) => void;
}) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const [localIssue, setLocalIssue] = useState<string | null>(null);
  const error = localIssue ?? (touched || reveal ? issueText(t, issue) : undefined);
  const meta = fieldMeta(t, schema, draft);
  const toggle = schema.type === 'boolean';
  const errorId = `${id}-error`;
  return (
    <div
      data-field-invalid={error ? 'true' : undefined}
      className="grid gap-x-8 gap-y-2 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]"
    >
      <div className="min-w-0">{head(id)}</div>
      <div
        className={cn('flex min-w-0 flex-col gap-1.5', toggle && 'items-start md:items-end')}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTouched(true);
        }}
      >
        <FieldInput
          t={t}
          id={id}
          label={label}
          schema={schema}
          draft={draft}
          invalid={!!error}
          onChange={onChange}
          onIssue={setLocalIssue}
        />
        {error ? (
          <p id={errorId} className={cn(ERROR_TEXT, 'flex items-start gap-1')} role="alert">
            <ConfigIcon name="alert" size={13} className="mt-[3px] shrink-0" />
            {error}
          </p>
        ) : meta ? (
          <span className="text-[12px] tabular-nums text-ink-faint">{meta}</span>
        ) : null}
      </div>
    </div>
  );
}

/** Head for a nested field: label, required mark, description. */
export function SubHead({
  t,
  id,
  label,
  description,
  required = false,
}: {
  t: Translate;
  id: string;
  label: string;
  description?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex min-h-6 items-center gap-1.5">
        <label htmlFor={id} className="text-[13px] text-ink-muted">
          {label}
        </label>
        {required ? <Badge>{t('settings.runtime.required')}</Badge> : null}
      </div>
      {description ? <p className="text-[12px] leading-5 text-ink-faint">{description}</p> : null}
    </div>
  );
}
