import { describe, expect, test } from 'bun:test';
import type { FieldSchema } from '@/lib/configApi';
import { translate } from '@/i18n/messages';
import {
  SIGN_IN_PROVIDERS,
  callbackUrl,
  providerById,
  providerSections,
  providerStatus,
  type ProviderRecord,
} from './signInProviders';

const text = { type: 'text', max_len: 128 } as const;
const field = (name: string, extra: Partial<FieldSchema> = {}): FieldSchema => ({
  name,
  label: name,
  schema: text,
  ...extra,
});

const wechatFields: FieldSchema[] = [
  field('enabled', { schema: { type: 'boolean' } }),
  field('app_id', { required_when: 'enabled' }),
  field('app_secret', { required_when: 'enabled', schema: { type: 'secret', max_len: 128 } }),
  field('callback_domain', { required_when: 'enabled' }),
  field('display_mode'),
  field('qr_style'),
  field('account_policy'),
];

describe('sign-in provider registry', () => {
  test('lists every config-center provider once with labels in both locales', () => {
    const ids = SIGN_IN_PROVIDERS.map((provider) => provider.id);
    expect(ids).toEqual(['wechat', 'feishu', 'dingtalk', 'wecom']);
    for (const provider of SIGN_IN_PROVIDERS) {
      expect(provider.key).toBe(`auth.${provider.id}`);
      for (const locale of ['zh', 'en'] as const) {
        for (const key of [provider.name, provider.description, provider.console]) {
          expect(translate(locale, key)).not.toBe(key);
        }
      }
      expect(provider.consoleUrl.startsWith('https://')).toBe(true);
    }
    expect(providerById('feishu')?.id).toBe('feishu');
    expect(providerById('github')).toBeUndefined();
  });

  test('splits the schema into credential, callback, experience and account cards', () => {
    const sections = providerSections(providerById('wechat')!, wechatFields);
    const names = (list: FieldSchema[]) => list.map((item) => item.name);
    expect(names(sections.credentials)).toEqual(['app_id', 'app_secret']);
    expect(names(sections.callback)).toEqual(['callback_domain']);
    expect(names(sections.experience)).toEqual(['display_mode', 'qr_style']);
    expect(names(sections.accounts)).toEqual(['account_policy']);
  });

  test('status follows enabled and required fields, counting kept secrets', () => {
    const kept = { kind: 'secret', current: '••••abcd', next: '', clear: false } as const;
    const base: ProviderRecord = { enabled: false, app_id: 'wx0123', callback_domain: 'a3s.example.com' };
    expect(providerStatus(wechatFields, { ...base, app_secret: kept })).toBe('off');
    expect(providerStatus(wechatFields, { ...base, app_secret: { ...kept, clear: true } })).toBe('incomplete');
    expect(providerStatus(wechatFields, { ...base, app_id: '' })).toBe('incomplete');
    expect(providerStatus(wechatFields, { ...base, enabled: true })).toBe('live');
  });

  test('builds the callback URL and each provider test-login URL', () => {
    expect(callbackUrl('feishu', '')).toBe('');
    const redirect = callbackUrl('feishu', 'a3s.example.com');
    expect(redirect).toBe('https://a3s.example.com/api/auth/feishu/callback');

    const record: ProviderRecord = {
      app_id: 'wx0123',
      client_id: 'ding123',
      corp_id: 'ww0123456789abcdef',
      agent_id: '1000002',
    };
    const urls = Object.fromEntries(
      SIGN_IN_PROVIDERS.map((provider) => [provider.id, new URL(provider.testUrl(record, redirect))]),
    );
    expect(urls.wechat.host).toBe('open.weixin.qq.com');
    expect(urls.wechat.searchParams.get('appid')).toBe('wx0123');
    expect(urls.wechat.hash).toBe('#wechat_redirect');
    expect(urls.feishu.host).toBe('accounts.feishu.cn');
    expect(urls.feishu.searchParams.get('client_id')).toBe('wx0123');
    expect(urls.dingtalk.host).toBe('login.dingtalk.com');
    expect(urls.dingtalk.searchParams.get('client_id')).toBe('ding123');
    expect(urls.wecom.searchParams.get('appid')).toBe('ww0123456789abcdef');
    expect(urls.wecom.searchParams.get('agentid')).toBe('1000002');
    for (const url of Object.values(urls)) {
      expect(url.searchParams.get('redirect_uri')).toBe(redirect);
    }
  });

  test('WeChat hides the QR style unless the QR code is embedded', () => {
    const wechat = providerById('wechat')!;
    expect(wechat.hidden?.('qr_style', { display_mode: 'redirect' })).toBe(true);
    expect(wechat.hidden?.('qr_style', { display_mode: 'embedded' })).toBe(false);
  });
});
