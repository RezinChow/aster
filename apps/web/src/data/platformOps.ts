/** Platform dashboard — system logs + API traffic (mock). */

export type SystemLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type SystemLogEntry = {
  id: string;
  at: string;
  level: SystemLogLevel;
  source: string;
  message: string;
};

export type ApiTrafficPoint = {
  /** Axis label, e.g. 08:00 */
  label: string;
  /** Requests per minute */
  rpm: number;
};

export const systemLogs: SystemLogEntry[] = [];

/** No sampled traffic until a live meter is wired. */
export const apiTrafficSeries: ApiTrafficPoint[] = [];

export type OpsTimeRangeId = '1h' | '6h' | '24h' | '7d';

/** Take the trailing points for the selected window. An empty series stays empty. */
export function apiTrafficForRange(
  rangeId: OpsTimeRangeId,
  series: ApiTrafficPoint[] = apiTrafficSeries,
): ApiTrafficPoint[] {
  const count =
    rangeId === '1h' ? 2 : rangeId === '6h' ? 4 : rangeId === '24h' ? 12 : 12;
  return series.slice(-count);
}

export function apiTrafficSummary(series: ApiTrafficPoint[] = apiTrafficSeries) {
  const latest = series[series.length - 1]?.rpm ?? 0;
  const prev = series[series.length - 2]?.rpm ?? latest;
  const peak = series.reduce((m, p) => Math.max(m, p.rpm), 0);
  const deltaPct = prev === 0 ? 0 : Math.round(((latest - prev) / prev) * 1000) / 10;
  return { latest, peak, deltaPct };
}
