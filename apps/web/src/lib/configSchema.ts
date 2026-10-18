import type { FieldSchema, ValueSchema } from './configApi';

/**
 * Editable form state for a schema value. Integers stay as typed text until saved,
 * secrets keep the stored value apart from the replacement being typed.
 */
export type Draft =
  | boolean
  | string
  | null
  | SecretDraft
  | { [field: string]: Draft };

export type SecretDraft = {
  kind: 'secret';
  current: string;
  next: string;
  clear: boolean;
};

export type SchemaIssue =
  | { code: 'integer' }
  | { code: 'range'; min: number; max: number }
  | { code: 'required' }
  | { code: 'tooLong'; max: number }
  | { code: 'url' }
  | { code: 'option' }
  | { code: 'image' }
  | { code: 'imageTooLarge'; maxBytes: number }
  | { code: 'whitespace' }
  | { code: 'pattern'; message: string };

/** Issues keyed by field path: `''` for the root, `name` for an object field. */
export type SchemaIssues = Record<string, SchemaIssue>;

export function isSecretDraft(draft: Draft): draft is SecretDraft {
  return (
    typeof draft === 'object' &&
    draft !== null &&
    (draft as SecretDraft).kind === 'secret'
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function draftFrom(schema: ValueSchema, value: unknown): Draft {
  switch (schema.type) {
    case 'boolean':
      return value === true;
    case 'integer':
      return typeof value === 'number' ? String(value) : '';
    case 'text':
    case 'url':
    case 'enum':
      return typeof value === 'string' ? value : '';
    case 'secret':
      return {
        kind: 'secret',
        current: typeof value === 'string' ? value : '',
        next: '',
        clear: false,
      };
    case 'image_data_url':
      return typeof value === 'string' ? value : null;
    case 'object': {
      const record = asRecord(value);
      const draft: Record<string, Draft> = {};
      for (const field of schema.fields) {
        draft[field.name] = draftFrom(field.schema, record[field.name]);
      }
      return draft;
    }
  }
}

function patternIssue(
  pattern: { regex: string; message: string } | undefined,
  text: string,
): SchemaIssue | null {
  if (!pattern || !text) return null;
  try {
    return new RegExp(pattern.regex).test(text) ? null : { code: 'pattern', message: pattern.message };
  } catch {
    return null;
  }
}

/** The text a field would store, used for emptiness checks. */
function effectiveText(schema: ValueSchema, draft: Draft): string | null {
  if (schema.type === 'secret') {
    if (!isSecretDraft(draft) || draft.clear) return '';
    return draft.next.trim() || draft.current;
  }
  if (schema.type === 'text' || schema.type === 'url' || schema.type === 'enum') {
    return typeof draft === 'string' ? draft.trim() : '';
  }
  return null;
}

function issueFor(schema: ValueSchema, draft: Draft): SchemaIssue | null {
  switch (schema.type) {
    case 'boolean':
      return null;
    case 'integer': {
      const text = typeof draft === 'string' ? draft.trim() : '';
      if (!/^-?\d+$/.test(text)) return { code: 'integer' };
      const n = Number(text);
      return n < schema.min || n > schema.max
        ? { code: 'range', min: schema.min, max: schema.max }
        : null;
    }
    case 'text': {
      const text = typeof draft === 'string' ? draft : '';
      if ([...text].length > schema.max_len) return { code: 'tooLong', max: schema.max_len };
      return patternIssue(schema.pattern, text);
    }
    case 'url': {
      const text = typeof draft === 'string' ? draft.trim() : '';
      if (!text) return { code: 'required' };
      if (/\s/.test(text)) return { code: 'url' };
      try {
        const url = new URL(text);
        return (url.protocol === 'https:' || url.protocol === 'http:') &&
          url.hostname
          ? null
          : { code: 'url' };
      } catch {
        return { code: 'url' };
      }
    }
    case 'secret': {
      if (!isSecretDraft(draft) || draft.clear) return null;
      const next = draft.next.trim();
      if ([...next].length > schema.max_len) return { code: 'tooLong', max: schema.max_len };
      if (/\s/.test(next)) return { code: 'whitespace' };
      return patternIssue(schema.pattern, next);
    }
    case 'enum':
      return schema.options.some((option) => option.value === draft)
        ? null
        : { code: 'option' };
    case 'image_data_url':
      if (draft === null) return null;
      if (
        typeof draft !== 'string' ||
        !draft.startsWith('data:image/') ||
        !draft.includes(';base64,')
      ) {
        return { code: 'image' };
      }
      return draft.length > schema.max_bytes
        ? { code: 'imageTooLarge', maxBytes: schema.max_bytes }
        : null;
    case 'object':
      return null;
  }
}

function valueOf(schema: ValueSchema, draft: Draft): unknown {
  switch (schema.type) {
    case 'integer':
      return Number(String(draft).trim());
    case 'url':
      return String(draft).trim();
    case 'secret':
      if (!isSecretDraft(draft)) return '';
      if (draft.clear) return '';
      return draft.next.trim() ? draft.next.trim() : draft.current;
    default:
      return draft;
  }
}

export function fieldVisible(field: FieldSchema, draft: Record<string, Draft>) {
  return !field.visible_when || draft[field.visible_when] === true;
}

/**
 * Turns a draft into the value to store. A hidden field that does not parse keeps
 * its stored value, so toggling a feature off never blocks the save.
 */
export function parseDraft(
  schema: ValueSchema,
  draft: Draft,
  stored: unknown,
): { value: unknown; issues: SchemaIssues } {
  const issues: SchemaIssues = {};
  if (schema.type !== 'object') {
    const issue = issueFor(schema, draft);
    if (issue) issues[''] = issue;
    return { value: valueOf(schema, draft), issues };
  }
  const record = (draft && typeof draft === 'object' ? draft : {}) as Record<
    string,
    Draft
  >;
  const storedRecord = asRecord(stored);
  const value: Record<string, unknown> = {};
  for (const field of schema.fields) {
    const child = record[field.name] ?? draftFrom(field.schema, undefined);
    const required = !!field.required_when && record[field.required_when] === true;
    const issue =
      issueFor(field.schema, child) ??
      (required && effectiveText(field.schema, child) === '' ? ({ code: 'required' } as const) : null);
    if (!issue) {
      value[field.name] = valueOf(field.schema, child);
    } else if (fieldVisible(field, record)) {
      issues[field.name] = issue;
      value[field.name] = valueOf(field.schema, child);
    } else {
      value[field.name] = storedRecord[field.name];
    }
  }
  return { value, issues };
}

export type DurationHint = {
  amount: number;
  unit: 'minutes' | 'hours' | 'days';
  approx: boolean;
};

/** A coarser reading of a duration (`720` hours → `30` days), or null when none helps. */
export function humanizeDuration(
  value: number,
  unit: 'seconds' | 'hours',
): DurationHint | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const seconds = unit === 'hours' ? value * 3600 : value;
  const steps = [
    { unit: 'days' as const, size: 86_400 },
    { unit: 'hours' as const, size: 3600 },
    { unit: 'minutes' as const, size: 60 },
  ];
  for (const step of steps) {
    if (seconds < step.size) continue;
    if (unit === 'hours' && step.unit !== 'days') return null;
    const amount = seconds / step.size;
    const rounded = Math.round(amount * 10) / 10;
    return { amount: rounded, unit: step.unit, approx: rounded !== amount };
  }
  return null;
}

/** Last four characters behind a fixed mask; never reveals short secrets. */
export function maskSecret(value: string) {
  if (!value) return '';
  return value.length <= 8 ? '••••••••' : `••••••••${value.slice(-4)}`;
}
