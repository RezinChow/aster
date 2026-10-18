import { describe, expect, test } from 'bun:test';
import type { ValueSchema } from './configApi';
import {
  draftFrom,
  humanizeDuration,
  maskSecret,
  parseDraft,
  type SecretDraft,
} from './configSchema';

const maintenance: ValueSchema = {
  type: 'object',
  fields: [
    { name: 'enabled', label: '开启', schema: { type: 'boolean' } },
    {
      name: 'quota',
      label: '配额',
      visible_when: 'enabled',
      schema: { type: 'integer', min: 0, max: 10 },
    },
  ],
};

describe('parseDraft', () => {
  test('integers are typed as text and stored as numbers within bounds', () => {
    const schema: ValueSchema = { type: 'integer', min: 1, max: 1024, unit: 'megabytes' };
    expect(draftFrom(schema, 16)).toBe('16');
    expect(parseDraft(schema, ' 32 ', 16)).toEqual({ value: 32, issues: {} });
    expect(parseDraft(schema, '0', 16).issues['']).toEqual({ code: 'range', min: 1, max: 1024 });
    expect(parseDraft(schema, '1.5', 16).issues['']).toEqual({ code: 'integer' });
    expect(parseDraft(schema, '', 16).issues['']).toEqual({ code: 'integer' });
  });

  test('urls must be absolute http(s)', () => {
    const schema: ValueSchema = { type: 'url' };
    expect(parseDraft(schema, ' https://hf-mirror.com ', '').value).toBe('https://hf-mirror.com');
    expect(parseDraft(schema, '', '').issues['']).toEqual({ code: 'required' });
    expect(parseDraft(schema, 'ftp://x', '').issues['']).toEqual({ code: 'url' });
    expect(parseDraft(schema, 'hf-mirror.com', '').issues['']).toEqual({ code: 'url' });
  });

  test('secrets keep, replace, or clear the stored value', () => {
    const schema: ValueSchema = { type: 'secret', max_len: 8 };
    const draft = draftFrom(schema, 'hf_old') as SecretDraft;
    expect(parseDraft(schema, draft, 'hf_old').value).toBe('hf_old');
    expect(parseDraft(schema, { ...draft, next: ' hf_new ' }, 'hf_old').value).toBe('hf_new');
    expect(parseDraft(schema, { ...draft, clear: true }, 'hf_old').value).toBe('');
    expect(parseDraft(schema, { ...draft, next: '123456789' }, 'hf_old').issues['']).toEqual({
      code: 'tooLong',
      max: 8,
    });
  });

  test('enum and image values are checked', () => {
    const hub: ValueSchema = {
      type: 'enum',
      options: [{ value: 'huggingface', label: 'Hugging Face' }],
    };
    expect(parseDraft(hub, 'other', '').issues['']).toEqual({ code: 'option' });
    const logo: ValueSchema = { type: 'image_data_url', max_bytes: 40 };
    expect(parseDraft(logo, null, null).issues).toEqual({});
    expect(parseDraft(logo, 'data:image/png;base64,AAAA', null).issues).toEqual({});
    expect(parseDraft(logo, 'https://x/logo.png', null).issues['']).toEqual({ code: 'image' });
    expect(parseDraft(logo, `data:image/png;base64,${'A'.repeat(40)}`, null).issues['']).toEqual({
      code: 'imageTooLarge',
      maxBytes: 40,
    });
  });

  test('a hidden field that does not parse keeps its stored value', () => {
    const stored = { enabled: true, quota: 3 };
    const draft = draftFrom(maintenance, stored) as Record<string, string | boolean>;
    expect(parseDraft(maintenance, { ...draft, quota: '7' }, stored)).toEqual({
      value: { enabled: true, quota: 7 },
      issues: {},
    });
    expect(parseDraft(maintenance, { ...draft, quota: 'x' }, stored).issues).toEqual({
      quota: { code: 'integer' },
    });
    expect(parseDraft(maintenance, { enabled: false, quota: 'x' }, stored)).toEqual({
      value: { enabled: false, quota: 3 },
      issues: {},
    });
  });
});

test('durations read in a coarser unit only when it helps', () => {
  expect(humanizeDuration(720, 'hours')).toEqual({ amount: 30, unit: 'days', approx: false });
  expect(humanizeDuration(100, 'hours')).toEqual({ amount: 4.2, unit: 'days', approx: true });
  expect(humanizeDuration(12, 'hours')).toBeNull();
  expect(humanizeDuration(21600, 'seconds')).toEqual({ amount: 6, unit: 'hours', approx: false });
  expect(humanizeDuration(30, 'seconds')).toBeNull();
});

test('masked secrets reveal at most the last four characters', () => {
  expect(maskSecret('')).toBe('');
  expect(maskSecret('short')).toBe('••••••••');
  expect(maskSecret('hf_abcdefghijkl')).toBe('••••••••ijkl');
});

const wechat: ValueSchema = {
  type: 'object',
  fields: [
    { name: 'enabled', label: '', schema: { type: 'boolean' } },
    {
      name: 'app_id',
      label: '',
      required_when: 'enabled',
      schema: {
        type: 'text',
        max_len: 18,
        pattern: { regex: '^wx[0-9a-f]{16}$', message: 'AppID 格式不正确' },
      },
    },
    {
      name: 'app_secret',
      label: '',
      required_when: 'enabled',
      schema: { type: 'secret', max_len: 32, pattern: { regex: '^[0-9A-Za-z]{32}$', message: 'bad' } },
    },
  ],
};

test('required_when only bites while the provider is enabled', () => {
  const off = draftFrom(wechat, { enabled: false, app_id: '', app_secret: '' });
  expect(parseDraft(wechat, off, {}).issues).toEqual({});
  const on = { ...(off as Record<string, unknown>), enabled: true } as typeof off;
  expect(parseDraft(wechat, on, {}).issues).toEqual({
    app_id: { code: 'required' },
    app_secret: { code: 'required' },
  });
});

test('patterns check typed text and new secrets, not the stored mask', () => {
  const draft = draftFrom(wechat, { enabled: true, app_id: 'wx12', app_secret: '••••••••cdef' });
  expect(parseDraft(wechat, draft, {}).issues).toEqual({
    app_id: { code: 'pattern', message: 'AppID 格式不正确' },
  });
  const secret = (draft as Record<string, SecretDraft>).app_secret;
  const typed = { ...(draft as Record<string, unknown>), app_id: 'wx0123456789abcdef', app_secret: { ...secret, next: 'has space' } };
  expect(parseDraft(wechat, typed as never, {}).issues).toEqual({ app_secret: { code: 'whitespace' } });
  const kept = { ...(typed as Record<string, unknown>), app_secret: secret };
  const parsed = parseDraft(wechat, kept as never, {});
  expect(parsed.issues).toEqual({});
  expect((parsed.value as Record<string, unknown>).app_secret).toBe('••••••••cdef');
});
