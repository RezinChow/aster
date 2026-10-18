/** Customer rate in USD per million tokens. Empty fields stay unpublished. */

export type ModelRateField = 'input' | 'cacheRead' | 'cacheWrite' | 'output';

export type ModelRateDraft = Record<ModelRateField, string>;

export type ModelRate = Record<ModelRateField, number | null>;

export type ModelRateError = 'invalid' | 'cacheReadAboveInput';

export type ModelRateErrors = Partial<Record<ModelRateField, ModelRateError>>;

const EMPTY_RATE: ModelRate = { input: null, cacheRead: null, cacheWrite: null, output: null };

function readPrice(value: string): number | 'invalid' | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return 'invalid';
  return parsed;
}

/** Parse the rate form. A cache hit above the input price is rejected; a cache write may be higher. */
export function parseModelRate(draft: ModelRateDraft): { rate: ModelRate; errors: ModelRateErrors } {
  const errors: ModelRateErrors = {};
  const rate: ModelRate = { ...EMPTY_RATE };
  (Object.keys(draft) as ModelRateField[]).forEach((field) => {
    const parsed = readPrice(draft[field]);
    if (parsed === 'invalid') errors[field] = 'invalid';
    else rate[field] = parsed;
  });
  if (
    !errors.input &&
    !errors.cacheRead &&
    rate.input != null &&
    rate.cacheRead != null &&
    rate.cacheRead - rate.input > 1e-9
  ) {
    errors.cacheRead = 'cacheReadAboveInput';
  }
  return { rate, errors };
}

/** Billing coefficient. 1 charges the published rate. Empty or out of range is invalid. */
export function parsePriceMultiplier(value: string): number | 'invalid' {
  const trimmed = value.trim();
  if (!trimmed) return 'invalid';
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0.01 || parsed > 1000) return 'invalid';
  return Math.round(parsed * 10000) / 10000;
}

/** Coefficient without trailing zeros. */
export function formatMultiplier(value: number): string {
  const text = value.toFixed(4).replace(/\.?0+$/, '');
  return text === '' || text === '-0' ? '0' : text;
}

/** USD amount without trailing zeros, for the model list. */
export function formatUsd(value: number): string {
  const text = value.toFixed(4).replace(/\.?0+$/, '');
  return text === '' || text === '-0' ? '0' : text;
}
