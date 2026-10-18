/** Market / commerce money display — products are priced in CNY (人民币). */

export function formatMoney(n: number, digits = 2): string {
  const safe = Number.isFinite(n) ? n : 0;
  return `¥${safe.toFixed(digits)}`;
}

/** @deprecated Prefer formatMoney — alias kept for gradual call-site migration. */
export const formatCny = formatMoney;
