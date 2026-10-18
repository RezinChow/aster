import { describe, expect, test } from 'bun:test';
import {
  AISA_RELAY_SERVICES,
  SILICONFLOW_RELAY_SERVICES,
  WORLD_MONITOR_RELAY_SERVICES,
  collapseRelayInterfaceSlots,
  normalizeRelayServices,
  relayServicesEqual,
} from './relayServices';
import {
  BOYUE_SUPPLIER_ID,
  SUPPLIER_MODEL_CAP,
  collapseSupplierWires,
  isSupplierModelId,
  normalizeSupplierModels,
  supplierProtocolDraft,
  supplierProtocolPath,
  supplierServicesDraft,
  type SupplierWire,
} from './suppliers';

const configured = {
  kind: 'custom' as const,
  fields: [{ key: 'baseUrl', value: 'configured' }],
};

describe('supplier catalog', () => {
  test('model ids trim, reject whitespace, dedupe, and cap', () => {
    expect(isSupplierModelId('  vendor/model  ')).toBe(true);
    expect(isSupplierModelId('has space')).toBe(false);
    const extra = Array.from({ length: SUPPLIER_MODEL_CAP + 4 }, (_, i) => `m${i}`);
    const ids = normalizeSupplierModels(['  a ', 'a', '', 'b c', ...extra]);
    expect(ids[0]).toBe('a');
    expect(ids).not.toContain('b c');
    expect(ids).toHaveLength(SUPPLIER_MODEL_CAP);
  });

  test('a base address previews one protocol and does not copy the address', () => {
    const protocol = supplierProtocolDraft({
      id: BOYUE_SUPPLIER_ID,
      config: configured,
    });
    expect(protocol).toBe('openai');
    expect(supplierProtocolPath('openai')).toBe('/chat/completions');
    expect(JSON.stringify({ protocol })).not.toContain('configured');
    expect(
      supplierProtocolDraft({
        id: 'sup_platform',
        config: { kind: 'platform' },
      }),
    ).toBeUndefined();
  });

  test('anthropic providers preview the messages path', () => {
    for (const id of ['sup_cs_anthropic', 'sup_cs_claude_code']) {
      const protocol = supplierProtocolDraft({ id, config: configured });
      expect(protocol).toBe('anthropic');
    }
    expect(supplierProtocolPath('anthropic')).toBe('/messages');
  });

  test('a saved wire list collapses to one protocol', () => {
    const wires: SupplierWire[] = [
      { id: 'a', protocol: 'openai', name: '', path: '/chat/completions', enabled: true },
      { id: 'b', protocol: 'anthropic', name: '', path: '/messages', enabled: true },
    ];
    expect(collapseSupplierWires(wires)).toBe('anthropic');
    expect(
      supplierProtocolDraft({
        id: BOYUE_SUPPLIER_ID,
        config: configured,
        wires: [],
      }),
    ).toBeUndefined();
    expect(
      supplierProtocolDraft({
        id: BOYUE_SUPPLIER_ID,
        config: configured,
        wires,
        protocol: 'openai',
      }),
    ).toBe('openai');
  });

  test('relay classes keep every protocol and stay relative', () => {
    expect(AISA_RELAY_SERVICES.map((service) => service.class)).toEqual(['model', 'api', 'mcp']);
    expect(AISA_RELAY_SERVICES[0]?.interfaces?.map((row) => row.protocol)).toEqual([
      'openai',
      'anthropic',
      'gemini',
    ]);
    expect(AISA_RELAY_SERVICES[1]?.groups?.map((group) => group.name)).toEqual([
      'search',
      'finance',
      'scholar',
      'social',
      'prediction',
    ]);
    expect(AISA_RELAY_SERVICES[2]?.path).toBe('/mcp');
    expect(JSON.stringify(AISA_RELAY_SERVICES)).not.toMatch(/https?:/);
    expect(WORLD_MONITOR_RELAY_SERVICES.map((service) => service.class)).toEqual(['api', 'mcp']);
    expect(SILICONFLOW_RELAY_SERVICES[0]?.interfaces?.map((row) => row.path)).toEqual([
      '/chat/completions',
      '/messages',
      '/embeddings',
      '/rerank',
    ]);
  });

  test('an open protocol is kept and a blank protocol is dropped', () => {
    const services = normalizeRelayServices([
      {
        id: 'svc_model',
        class: 'model',
        name: 'model',
        interfaces: [
          { id: 'if_g', protocol: 'Gemini', name: 'generate', method: 'POST', path: '' },
          { id: 'if_v', protocol: 'vertex', name: 'chat', method: 'POST', path: '/v1/chat' },
          { id: 'if_blank', protocol: '', name: 'chat', method: 'POST', path: '/chat/completions' },
          { id: 'if_url', protocol: 'openai', name: 'chat', method: 'POST', path: 'https://example.test/v1' },
        ],
      },
    ]);
    expect(services[0]?.interfaces?.map((row) => row.protocol)).toEqual(['gemini', 'vertex']);
    expect(JSON.stringify(services)).not.toContain('example.test');
    const kept = services;
    const withBlank = [
      {
        ...kept[0]!,
        interfaces: [
          ...(kept[0]?.interfaces ?? []),
          { id: 'if_blank', protocol: ' ', name: '', method: 'POST' as const, path: '' },
        ],
      },
    ];
    expect(relayServicesEqual(kept, withBlank)).toBe(true);
    const duplicated = collapseRelayInterfaceSlots([
      { id: 'if_1', protocol: 'openai', name: 'chat', method: 'POST', path: '/chat/completions' },
      { id: 'if_2', protocol: 'OpenAI', name: 'chat', method: 'POST', path: '/chat/completions' },
      { id: 'if_3', protocol: 'openai', name: 'embeddings', method: 'POST', path: '/embeddings' },
      { id: 'if_4', protocol: '', name: '', method: 'POST', path: '' },
    ]);
    expect(duplicated.map((row) => row.id)).toEqual(['if_1', 'if_3', 'if_4']);
  });

  test('legacy wires become interfaces and an empty catalog stays empty', () => {
    const both = supplierServicesDraft({
      id: BOYUE_SUPPLIER_ID,
      config: configured,
      wires: [
        { id: 'a', protocol: 'openai', name: '', path: '/chat/completions', enabled: true },
        { id: 'b', protocol: 'anthropic', name: '', path: '/messages', enabled: true },
      ],
    });
    expect(both[0]?.interfaces?.map((row) => row.protocol)).toEqual(['openai', 'anthropic']);
    expect(supplierServicesDraft({ id: BOYUE_SUPPLIER_ID, config: configured, services: [] })).toEqual([]);
    const preview = supplierServicesDraft({ id: BOYUE_SUPPLIER_ID, config: configured });
    expect(preview[0]?.interfaces?.[0]).toMatchObject({
      protocol: 'openai',
      path: '/chat/completions',
    });
    expect(JSON.stringify(preview)).not.toContain('configured');
    expect(
      supplierServicesDraft({
        id: 'sup_cs_anthropic',
        config: configured,
      })[0]?.interfaces?.[0]?.protocol,
    ).toBe('anthropic');
  });
});
