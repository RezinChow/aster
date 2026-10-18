/**
 * Queryable copy of a3s-api process logs.
 * `GET /logs` reads the ClickHouse store. stderr is still the operator tail.
 */

import { apiRequest } from '@/lib/apiClient';

export type LogLevelName = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export type LogCounts = {
  all: number;
  trace: number;
  debug: number;
  info: number;
  warn: number;
  error: number;
};

export type LogRow = {
  id: string;
  ts: string;
  level: string;
  target: string;
  message: string;
  service: string;
  fields: unknown;
};

export type LogPage = {
  rows: LogRow[];
  counts: LogCounts;
  nextCursor: string | null;
};

export type LogSearch = {
  level?: LogLevelName | 'all';
  q?: string;
  from: string;
  to: string;
  cursor?: string;
  limit?: number;
};

export function searchLogs(query: LogSearch) {
  const params = new URLSearchParams();
  if (query.level && query.level !== 'all') params.set('level', query.level);
  if (query.q?.trim()) params.set('q', query.q.trim());
  params.set('from', query.from);
  params.set('to', query.to);
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.limit) params.set('limit', String(query.limit));
  const suffix = params.toString();
  return apiRequest<LogPage>(`/logs${suffix ? `?${suffix}` : ''}`);
}
