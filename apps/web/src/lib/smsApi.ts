import { apiRequest } from "./apiClient";
export type SmsSettings = {
  allowRealSend: boolean;
  profileId: string;
  provider: string;
  providerSettings?: Record<string, string | number | boolean>;
  enabled: boolean;
  digestSecretRef: string;
  maximumPerMinute: number;
  signature: string | null;
  usernameSecretRef: string | null;
  credentialSecretRef: string | null;
  authMethod: string | null;
  responseFormat: string | null;
  timeoutMs: number | null;
  maxMessageChars: number | null;
  scenario: string | null;
};
export type SmsProfile = {
  profileId: string;
  revision: number;
  enabled: boolean;
  provider: string;
  definitionAcl: string;
  requiresRealSend?: boolean;
  settings: SmsSettings;
};
export type SmsReceipt = {
  id: string;
  profileId: string;
  profileRevision: number;
  provider: string;
  recipientMask: string;
  state: "accepted" | "rejected" | "indeterminate";
  reason: string | null;
  providerMessageId: string | null;
  createdAt: string;
  settled: boolean;
};
type View<T> = { kind: string; data: T };
const base = "/cloud/sms";
export async function smsProfiles() {
  return (await apiRequest<View<SmsProfile[]>>(`${base}/profiles`)).data;
}
export async function smsMessages() {
  return (await apiRequest<View<SmsReceipt[]>>(`${base}/messages`)).data;
}
export async function saveSmsSettings(
  settings: SmsSettings,
  expectedRevision: number,
) {
  return (
    await apiRequest<View<SmsProfile>>(`${base}/settings`, {
      method: "POST",
      body: JSON.stringify({ settings, expectedRevision }),
    })
  ).data;
}
export async function smsBalance(profileId: string) {
  return (
    await apiRequest<View<{ remaining: number }>>(
      `${base}/profiles/${encodeURIComponent(profileId)}/balance`,
    )
  ).data;
}
export async function sendSms(
  profileId: string,
  recipient: string,
  content: string,
  key: string,
) {
  return (
    await apiRequest<View<SmsReceipt>>(`${base}/messages`, {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify({ profileId, recipient, content }),
    })
  ).data;
}
export async function createSmsSecret(
  name: string,
  value: string,
  key: string,
) {
  const secret = await apiRequest<{ id: string; currentVersion: number }>(
    "/cloud/service-secrets",
    {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify({ name, value }),
    },
  );
  return `${secret.id}@${secret.currentVersion}`;
}

export type SmsScenario =
  "general" | "login" | "register" | "reset_password" | "notification";
export type SmsAssetRef = {
  kind: "signature" | "template" | "scenario";
  assetId: string;
  revision: number;
};
export type SmsAssetContent =
  | { kind: "signature"; text: string }
  | {
      kind: "template";
      engine: "minijinja";
      source: string;
      variables: string[];
    }
  | {
      kind: "scenario";
      scenario: SmsScenario;
      profileId: string;
      signature: SmsAssetRef;
      template: SmsAssetRef;
    };
export type SmsAssetSettings = {
  assetId: string;
  name: string;
  enabled: boolean;
  content: SmsAssetContent;
};
export type SmsAsset = {
  revision: number;
  settings: SmsAssetSettings;
  definitionAcl: string;
};
export type SmsComposition = {
  scenario: SmsAssetRef;
  signature: SmsAssetRef;
  template: SmsAssetRef;
};
export type SmsPreview = {
  profileId: string;
  composition: SmsComposition;
  body: string;
  content: string;
  characterCount: number;
  variables: string[];
};
export const smsAssetRef = (asset: SmsAsset): SmsAssetRef => ({
  kind: asset.settings.content.kind,
  assetId: asset.settings.assetId,
  revision: asset.revision,
});
export async function smsAssets() {
  return (await apiRequest<View<SmsAsset[]>>(`${base}/assets`)).data;
}
export async function saveSmsAsset(
  settings: SmsAssetSettings,
  expectedRevision: number,
) {
  return (
    await apiRequest<View<SmsAsset>>(`${base}/assets`, {
      method: "POST",
      body: JSON.stringify({ settings, expectedRevision }),
    })
  ).data;
}
export async function previewSmsScenario(
  scenario: SmsScenario,
  scenarioRevision: number,
  variables: Record<string, string>,
) {
  return (
    await apiRequest<View<SmsPreview>>(`${base}/preview`, {
      method: "POST",
      body: JSON.stringify({ scenario, scenarioRevision, variables }),
    })
  ).data;
}
export async function sendSmsScenario(
  scenario: SmsScenario,
  scenarioRevision: number,
  recipient: string,
  variables: Record<string, string>,
  key: string,
) {
  return (
    await apiRequest<View<SmsReceipt>>(`${base}/scenario-messages`, {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify({
        scenario,
        scenarioRevision,
        recipient,
        variables,
      }),
    })
  ).data;
}

export type SmsProviderField = {
  key: string;
  label: string;
  description: string;
  required: boolean;
  default: string | number | boolean | null;
  visibleWhen: { field: string; equals: string | number | boolean } | null;
  schema:
    | { type: "text"; max_len: number }
    | { type: "integer"; min: number; max: number }
    | { type: "boolean" }
    | { type: "choice"; options: { value: string; label: string }[] }
    | { type: "secret_ref" };
};
export type SmsProviderMetadata = {
  id: string;
  name: string;
  description: string;
  available: boolean;
  requiresRealSend: boolean;
  sandboxOnly: boolean;
  supportsBalance: boolean;
  supportsScenarios: boolean;
  fields: SmsProviderField[];
};
export async function smsProviders() {
  return (await apiRequest<View<SmsProviderMetadata[]>>(`${base}/providers`))
    .data;
}
