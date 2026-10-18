/**
 * Cloud Message Queue API — /api/v1/queues/*
 */

import { CLOUD_API_BASE } from '@/lib/openapi';
import { unwrapApiEnvelope } from '@/lib/apiEnvelope';

export type QueueSummary = {
  id: string;
  name: string;
  organizationId: string;
  projectId: string;
  subject: string;
  stream: string;
  depth: number;
  inFlight: number;
  createdAt: string;
};

export type QueueMessage = {
  id: string;
  body: unknown;
  enqueuedAt: string;
};

async function cloudRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${CLOUD_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(5000),
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

export async function listQueues() {
  const page = await cloudRequest<{ queues: QueueSummary[]; stream: string }>(
    '/queues',
  );
  return page;
}

export function createQueue(input: {
  name: string;
  organizationId: string;
  projectId: string;
}) {
  return cloudRequest<QueueSummary>('/queues', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function enqueueMessage(queueId: string, body: unknown) {
  return cloudRequest<{ messageId: string; depth: number }>(
    `/queues/${encodeURIComponent(queueId)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ body }),
    },
  );
}

export function dequeueMessage(queueId: string) {
  return cloudRequest<{ message: QueueMessage | null; depth: number }>(
    `/queues/${encodeURIComponent(queueId)}/dequeue`,
    { method: 'POST', body: '{}' },
  );
}

export function ackMessage(queueId: string, messageId: string) {
  return cloudRequest<{ acked: boolean }>(
    `/queues/${encodeURIComponent(queueId)}/ack`,
    {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    },
  );
}

export function nakMessage(queueId: string, messageId: string) {
  return cloudRequest<{ acked: boolean }>(
    `/queues/${encodeURIComponent(queueId)}/nak`,
    {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    },
  );
}
