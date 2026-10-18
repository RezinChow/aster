import { describe, expect, test } from 'bun:test';
import { mapBusEnvelope } from './usageLedger';

describe('usageLedger bus projection', () => {
  test('maps usage.recorded envelope without inventing authority fields', () => {
    const row = mapBusEnvelope({
      id: 'evt_1',
      event_key: 'usage.recorded',
      occurred_at: '2026-09-20T10:00:00.000Z',
      payload: {
        usage_id: 'usage_a',
        request_id: 'req_a',
        sku: 'boyue.openai.chat',
        listing_kind: 'model',
        status: 'ok',
        units: 3,
        amount_usd: 0.01,
        route: '/v1/api/services/model/invoke/boyue.openai.chat',
        org_id: 'org_local',
        project_id: 'proj_local',
        env_id: 'env_local',
        duration_ms: 42,
      },
    });
    expect(row).toMatchObject({
      id: 'usage_a',
      requestId: 'req_a',
      sku: 'boyue.openai.chat',
      listingKind: 'model',
      fromBus: true,
      status: 'ok',
      durationMs: 42,
    });
  });

  test('ignores non-usage bus keys', () => {
    expect(
      mapBusEnvelope({
        id: 'evt_2',
        event_key: 'access.log',
        occurred_at: '2026-09-20T10:00:00.000Z',
        payload: {},
      }),
    ).toBeNull();
  });
});
