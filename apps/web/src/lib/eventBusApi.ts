/**
 * Cloud Event Bus observe API — /api/v1/event-bus/*
 * Authority: A3S Cloud (NATS JetStream).
 * Console also projects Runtime L1 recent envelopes (no second authority).
 */

import { CLOUD_API_BASE } from '@/lib/openapi';
import { isApiEnvelope, unwrapApiEnvelope } from '@/lib/apiEnvelope';

const RUNTIME_ORIGIN = (
  import.meta.env.PUBLIC_A3S_RUNTIME_ORIGIN ?? 'http://127.0.0.1:8787'
).replace(/\/$/, '');

export type EventBusHealth = {
  status: string;
  provider: string;
  streamName: string;
  monitorUrl: string;
  detail: string;
};

export type EventBusStream = {
  name: string;
  subjects: string[];
  messages?: number | null;
  consumers?: number | null;
};

export type EventBusSubject = {
  key: string;
  subject: string;
  category: string;
};

export type EventBusEvent = {
  id: string;
  subject: string;
  eventKey: string;
  occurredAt: string;
  source: string;
};

async function cloudGet<T>(path: string): Promise<T> {
  const response = await fetch(`${CLOUD_API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(4000),
  });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(text || `HTTP ${response.status}`);
    }
  }
  return unwrapApiEnvelope<T>(payload, response.status);
}

async function cloudGetOptional<T>(path: string): Promise<T | null> {
  try {
    return await cloudGet<T>(path);
  } catch {
    return null;
  }
}

export function getEventBusHealth() {
  return cloudGetOptional<EventBusHealth>('/event-bus/health');
}

export async function listEventBusStreams() {
  const page = await cloudGetOptional<{ streams: EventBusStream[] }>(
    '/event-bus/streams',
  );
  return page?.streams ?? [];
}

export async function listEventBusSubjects() {
  const page = await cloudGetOptional<{ subjects: EventBusSubject[] }>(
    '/event-bus/subjects',
  );
  return page?.subjects ?? [];
}

async function listRuntimeProjectedEvents(): Promise<EventBusEvent[]> {
  try {
    const res = await fetch(`${RUNTIME_ORIGIN}/v1/api/events/recent`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2500),
    });
    const payload = (await res.json()) as unknown;
    if (!res.ok || !isApiEnvelope(payload) || payload.code !== 0) return [];
    const data = payload.data as {
      items?: Array<{
        id: string;
        subject: string;
        event_key: string;
        occurred_at: string;
        source: string;
      }>;
    } | null;
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.map((row) => ({
      id: row.id,
      subject: row.subject,
      eventKey: row.event_key,
      occurredAt: row.occurred_at,
      source: row.source,
    }));
  } catch {
    return [];
  }
}

export async function listEventBusEvents(): Promise<{
  events: EventBusEvent[];
  projected: boolean;
}> {
  const [page, projected] = await Promise.all([
    cloudGetOptional<{ events: EventBusEvent[]; note?: string }>(
      '/event-bus/events',
    ),
    listRuntimeProjectedEvents(),
  ]);
  const cloudEvents = page?.events ?? [];
  if (cloudEvents.length > 0) {
    return { events: cloudEvents, projected: false };
  }
  return {
    events: projected,
    projected: projected.length > 0,
  };
}
