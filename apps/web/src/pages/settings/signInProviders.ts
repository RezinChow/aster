import type { MessageKey } from '@/i18n/messages';
import type { FieldSchema, ValueSchema } from '@/lib/configApi';
import { isSecretDraft, type Draft } from '@/lib/configSchema';

/**
 * OAuth sign-in providers the console can configure. The config center owns each
 * provider's value and schema at `auth.<id>`; this registry only adds what a schema
 * cannot carry: the brand mark, the developer console, and how to open a test login.
 * Adding a provider = one builtin in apps/config plus one entry here.
 */
export type SignInProviderId = 'wechat' | 'feishu' | 'dingtalk' | 'wecom';

export type ProviderRecord = Record<string, Draft>;

export type SignInProvider = {
  id: SignInProviderId;
  key: `auth.${SignInProviderId}`;
  name: MessageKey;
  description: MessageKey;
  console: MessageKey;
  consoleUrl: string;
  /** Fields shown under 登录展示; other optional fields go to 账号关联. */
  experience: string[];
  /** Saved fields the test login reads; the test is offered once all are saved and unchanged. */
  testFields: string[];
  testUrl: (record: ProviderRecord, redirectUri: string) => string;
  /** Hides a field the current draft makes irrelevant. */
  hidden?: (name: string, record: ProviderRecord) => boolean;
};

const TEST_STATE = 'a3s-console-test';

export const SIGN_IN_PROVIDERS: SignInProvider[] = [
  {
    id: 'wechat',
    key: 'auth.wechat',
    name: 'settings.login.provider.wechat',
    description: 'settings.login.provider.wechat.desc',
    console: 'settings.login.provider.wechat.console',
    consoleUrl: 'https://open.weixin.qq.com/cgi-bin/index',
    experience: ['display_mode', 'qr_style'],
    testFields: ['app_id'],
    testUrl: (record, redirectUri) =>
      `https://open.weixin.qq.com/connect/qrconnect?${new URLSearchParams({
        appid: text(record, 'app_id'),
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'snsapi_login',
        state: TEST_STATE,
      }).toString()}#wechat_redirect`,
    hidden: (name, record) => name === 'qr_style' && record.display_mode !== 'embedded',
  },
  {
    id: 'feishu',
    key: 'auth.feishu',
    name: 'settings.login.provider.feishu',
    description: 'settings.login.provider.feishu.desc',
    console: 'settings.login.provider.feishu.console',
    consoleUrl: 'https://open.feishu.cn/app',
    experience: [],
    testFields: ['app_id'],
    testUrl: (record, redirectUri) =>
      `https://accounts.feishu.cn/open-apis/authen/v1/authorize?${new URLSearchParams({
        client_id: text(record, 'app_id'),
        redirect_uri: redirectUri,
        response_type: 'code',
        state: TEST_STATE,
      }).toString()}`,
  },
  {
    id: 'dingtalk',
    key: 'auth.dingtalk',
    name: 'settings.login.provider.dingtalk',
    description: 'settings.login.provider.dingtalk.desc',
    console: 'settings.login.provider.dingtalk.console',
    consoleUrl: 'https://open-dev.dingtalk.com/',
    experience: [],
    testFields: ['client_id'],
    testUrl: (record, redirectUri) =>
      `https://login.dingtalk.com/oauth2/auth?${new URLSearchParams({
        client_id: text(record, 'client_id'),
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid',
        prompt: 'consent',
        state: TEST_STATE,
      }).toString()}`,
  },
  {
    id: 'wecom',
    key: 'auth.wecom',
    name: 'settings.login.provider.wecom',
    description: 'settings.login.provider.wecom.desc',
    console: 'settings.login.provider.wecom.console',
    consoleUrl: 'https://work.weixin.qq.com/wework_admin/frame#apps',
    experience: [],
    testFields: ['corp_id', 'agent_id'],
    testUrl: (record, redirectUri) =>
      `https://login.work.weixin.qq.com/wwlogin/sso/login?${new URLSearchParams({
        login_type: 'CorpApp',
        appid: text(record, 'corp_id'),
        agentid: text(record, 'agent_id'),
        redirect_uri: redirectUri,
        state: TEST_STATE,
      }).toString()}`,
  },
];

export function providerById(id: string | null | undefined): SignInProvider | undefined {
  return SIGN_IN_PROVIDERS.find((provider) => provider.id === id);
}

/** Path on the callback domain that receives `code` / `state` from the provider. */
export function callbackPath(id: SignInProviderId): string {
  return `/api/auth/${id}/callback`;
}

export function callbackUrl(id: SignInProviderId, domain: string): string {
  return domain ? `https://${domain}${callbackPath(id)}` : '';
}

export function text(record: ProviderRecord, name: string): string {
  const value = record[name];
  return typeof value === 'string' ? value.trim() : '';
}

/** A required field counts as filled once it holds text or a kept / newly typed secret. */
export function filled(record: ProviderRecord, name: string): boolean {
  const value = record[name];
  if (isSecretDraft(value)) return !value.clear && (value.next.trim() !== '' || value.current !== '');
  return typeof value === 'string' ? value.trim() !== '' : value !== null && value !== undefined;
}

export function objectFields(schema: ValueSchema | undefined): FieldSchema[] {
  return schema?.type === 'object' ? schema.fields : [];
}

/** Fields the provider needs before it can be enabled. */
export function requiredFields(fields: FieldSchema[]): FieldSchema[] {
  return fields.filter((field) => field.required_when === 'enabled');
}

export type ProviderStatus = 'live' | 'off' | 'incomplete';

export function providerStatus(fields: FieldSchema[], record: ProviderRecord): ProviderStatus {
  if (record.enabled === true) return 'live';
  return requiredFields(fields).every((field) => filled(record, field.name)) ? 'off' : 'incomplete';
}

export type ProviderSections = {
  credentials: FieldSchema[];
  callback: FieldSchema[];
  experience: FieldSchema[];
  accounts: FieldSchema[];
};

/** Splits a provider's schema into the detail page's cards. */
export function providerSections(provider: SignInProvider, fields: FieldSchema[]): ProviderSections {
  const required = new Set(requiredFields(fields).map((field) => field.name));
  const sections: ProviderSections = { credentials: [], callback: [], experience: [], accounts: [] };
  for (const field of fields) {
    if (field.name === 'enabled') continue;
    if (field.name === 'callback_domain') sections.callback.push(field);
    else if (required.has(field.name)) sections.credentials.push(field);
    else if (provider.experience.includes(field.name)) sections.experience.push(field);
    else sections.accounts.push(field);
  }
  return sections;
}
