/** Stored intensity levels, weak to strong. `default` is a client stop and is not stored. */
export const REASONING_EFFORT_LEVELS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'ultra',
  'auto',
] as const;

export type ReasoningEffortLevel = (typeof REASONING_EFFORT_LEVELS)[number];

/** Drops unknown tokens and returns the canonical order. */
export function orderedReasoningEfforts(values: readonly string[]): ReasoningEffortLevel[] {
  const selected = new Set(values);
  return REASONING_EFFORT_LEVELS.filter((level) => selected.has(level));
}
