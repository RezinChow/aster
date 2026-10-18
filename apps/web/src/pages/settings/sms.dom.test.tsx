import "../secondaryBack.dom";
import { afterEach, beforeEach, beforeAll, expect, test } from "bun:test";
let ui: typeof import("../../../../../packages/ui/node_modules/@testing-library/react/pure");
beforeAll(async () => {
  ui =
    await import("../../../../../packages/ui/node_modules/@testing-library/react/pure");
});
import { SmsSection } from "./SmsSection";
import {
  setUserSession,
  setCloudPersonCredential,
  clearUserSession,
} from "@/lib/userSession";
import type { SmsSettings, SmsProviderMetadata } from "@/lib/smsApi";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  PROJECT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  ENV = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const base = `/organizations/${ORG}`;
const settings: SmsSettings = {
  providerSettings: { scenario: "accept" },
  profileId: "ToWork",
  allowRealSend: false,
  provider: "virtual",
  enabled: true,
  digestSecretRef: "dddddddd-dddd-4ddd-8ddd-dddddddddddd@1",
  maximumPerMinute: 10,
  signature: null,
  usernameSecretRef: null,
  credentialSecretRef: null,
  authMethod: null,
  responseFormat: null,
  timeoutMs: null,
  maxMessageChars: null,
  scenario: "accept",
};
const providers: SmsProviderMetadata[] = [
  {
    id: "virtual",
    name: "Virtual",
    description: "fixture",
    available: true,
    requiresRealSend: false,
    sandboxOnly: true,
    supportsBalance: false,
    supportsScenarios: true,
    fields: [
      {
        key: "scenario",
        label: "模拟结果",
        description: "",
        required: true,
        default: "accept",
        visibleWhen: null,
        schema: {
          type: "choice",
          options: [
            { value: "accept", label: "Accept" },
            { value: "reject", label: "Reject" },
          ],
        },
      },
    ],
  },
  {
    id: "different_test",
    name: "Different supplier",
    description: "different credentials",
    available: true,
    requiresRealSend: true,
    sandboxOnly: false,
    supportsBalance: true,
    supportsScenarios: true,
    fields: [
      {
        key: "endpoint",
        label: "API endpoint",
        description: "",
        required: true,
        default: null,
        visibleWhen: null,
        schema: { type: "text", max_len: 256 },
      },
      {
        key: "region",
        label: "Region",
        description: "",
        required: true,
        default: "cn",
        visibleWhen: null,
        schema: { type: "text", max_len: 32 },
      },
      {
        key: "auth",
        label: "Auth",
        description: "",
        required: true,
        default: "token",
        visibleWhen: null,
        schema: {
          type: "choice",
          options: [
            { value: "token", label: "Token" },
            { value: "key", label: "Access key" },
          ],
        },
      },
      {
        key: "token_ref",
        label: "Access token",
        description: "",
        required: true,
        default: null,
        visibleWhen: { field: "auth", equals: "token" },
        schema: { type: "secret_ref" },
      },
      {
        key: "access_key_ref",
        label: "Access key credential",
        description: "",
        required: true,
        default: null,
        visibleWhen: { field: "auth", equals: "key" },
        schema: { type: "secret_ref" },
      },
    ],
  },
];
let originalFetch: typeof fetch;
let writes: {
  url: string;
  body: Record<string, unknown>;
  key: string | null;
}[];
let revision = 1;
let loadedSettings: SmsSettings;
beforeEach(() => {
  originalFetch = globalThis.fetch;
  writes = [];
  revision = 1;
  loadedSettings = { ...settings };
  setUserSession("a3s_us_fixture", ORG);
  setCloudPersonCredential({
    accessToken: `a3s_${"ab".repeat(32)}`,
    organizationId: ORG,
    principalId: PROJECT,
    subject: ENV,
  });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    let data: unknown;
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));

      writes.push({
        url,
        body,
        key: new Headers(init.headers).get("Idempotency-Key"),
      });
      if (url.endsWith("/sms/settings")) {
        loadedSettings = body.settings as SmsSettings;
        revision += 1;
        data = {
          kind: "profile",
          data: {
            profileId: "ToWork",
            provider: loadedSettings.provider,
            enabled: true,
            requiresRealSend: providers.find(
              (p) => p.id === loadedSettings.provider,
            )?.requiresRealSend,
            revision,
            settings: body.settings,
            definitionAcl: 'sms "ToWork" {}',
          },
        };
      } else if (url.endsWith("/sms/messages")) {
        data = {
          kind: "message",
          data: {
            id: "receipt",
            profileId: "ToWork",
            profileRevision: revision,
            recipientMask: "***8000",
            state: "accepted",
            createdAt: "2026-10-08T00:00:00Z",
            settled: true,
          },
        };
      } else if (url.endsWith("/service-secrets"))
        data = {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          currentVersion: 1,
        };
      else throw new Error("unexpected mutation");
    } else if (url.endsWith(`${base}/sms/profiles`))
      data = {
        kind: "profiles",
        data: [
          {
            profileId: "ToWork",
            provider: loadedSettings.provider,
            enabled: true,
            requiresRealSend: providers.find(
              (p) => p.id === loadedSettings.provider,
            )?.requiresRealSend,
            revision,
            settings: loadedSettings,
            definitionAcl: 'sms "ToWork" {}',
          },
        ],
      };
    else if (url.endsWith(`${base}/sms/providers`))
      data = { kind: "providers", data: providers };
    else if (url.endsWith(`${base}/sms/assets`))
      data = { kind: "assets", data: [] };
    else if (url.endsWith(`${base}/sms/messages`))
      data = { kind: "messages", data: [] };
    else throw new Error(`unexpected route ${url}`);
    return new Response(JSON.stringify({ code: 200, message: "OK", data }), {
      headers: { "content-type": "application/json" },
    });
  };
});
afterEach(() => {
  ui.cleanup();
  globalThis.fetch = originalFetch;
  clearUserSession();
});

async function load() {
  ui.render(<SmsSection />);
  await ui.screen.findByText("ToWork");
  expect(writes).toHaveLength(0);
  expect(ui.screen.queryByLabelText("项目")).toBeNull();
  expect(ui.screen.queryByLabelText("环境")).toBeNull();
}
async function tab(name: string) {
  const control = ui.screen.getByRole("tab", { name });
  ui.fireEvent.mouseDown(control, { button: 0, ctrlKey: false });
  ui.fireEvent.click(control);
  await ui.waitFor(() =>
    expect(control.getAttribute("aria-selected")).toBe("true"),
  );
}
async function choose(label: string, option: string) {
  ui.fireEvent.click(
    ui
      .within(ui.screen.getByRole("dialog"))
      .getByLabelText(label, { exact: false }),
  );
  const item = await ui.screen.findByRole("option", { name: option });
  ui.fireEvent.click(item.querySelector("button") ?? item);
}
test("lists isolate management, cancel discards, loading and save never dispatch", async () => {
  await load();
  expect(ui.screen.queryByLabelText("API endpoint")).toBeNull();
  ui.fireEvent.click(ui.screen.getByRole("button", { name: "新建配置" }));
  expect(
    (
      ui
        .within(ui.screen.getByRole("dialog"))
        .getByLabelText("配置名称", { exact: false }) as HTMLInputElement
    ).value,
  ).toBe("ToWork");
  ui.fireEvent.change(
    ui
      .within(ui.screen.getByRole("dialog"))
      .getByLabelText("配置名称", { exact: false }),
    {
      target: { value: "draft" },
    },
  );
  ui.fireEvent.click(ui.screen.getByRole("button", { name: "取消" }));
  expect(ui.screen.queryByRole("dialog") === null).toBe(true);
  expect(writes).toHaveLength(0);
  await tab("短信签名管理");
  expect(ui.screen.queryByRole("table", { name: "供应商配置" })).toBeNull();
  expect(ui.screen.queryByLabelText("签名文字")).toBeNull();
});
test("third supplier descriptor renders unrelated fields, switches authentication and stores credentials only in vault", async () => {
  await load();
  ui.fireEvent.click(ui.screen.getByRole("button", { name: "编辑" }));
  await choose("供应商", "Different supplier");
  expect(ui.screen.queryByLabelText("模拟结果")).toBeNull();
  expect(ui.screen.queryByLabelText("默认短信签名")).toBeNull();
  expect(
    ui.screen.getByLabelText("API endpoint", { exact: false }),
  ).toBeTruthy();
  expect(
    (ui.screen.getByLabelText("Region", { exact: false }) as HTMLInputElement)
      .value,
  ).toBe("cn");
  await choose("Auth", "Access key");
  expect(ui.screen.queryByLabelText("Access token")).toBeNull();
  const secret = ui.screen.getByLabelText("Access key credential", {
    exact: false,
  }) as HTMLInputElement;
  expect(secret.type).toBe("password");
  ui.fireEvent.change(secret, { target: { value: "fixture-secret" } });
  ui.fireEvent.change(
    ui.screen.getByLabelText("API endpoint", { exact: false }),
    {
      target: { value: "https://fixture.invalid/sms" },
    },
  );

  ui.fireEvent.submit(ui.screen.getByRole("dialog").querySelector("form")!);

  await ui.waitFor(() =>
    expect(ui.screen.queryByRole("dialog") === null).toBe(true),
  );
  expect(writes).toHaveLength(2);
  expect(writes[0].url).toContain("/service-secrets");
  expect(writes[0].body.value).toBe("fixture-secret");
  expect(writes[1].url).toContain("/sms/settings");
  const saved = writes[1].body.settings as SmsSettings;
  expect(saved.providerSettings).toEqual({
    endpoint: "https://fixture.invalid/sms",
    region: "cn",
    auth: "key",
    access_key_ref: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee@1",
  });
  expect(JSON.stringify(saved)).not.toContain("fixture-secret");
  expect(saved.allowRealSend).toBe(false);
  expect(writes.every((w) => !w.url.endsWith("/sms/messages"))).toBe(true);
});
test("real permission is read from saved configuration; explicit confirmed send uses idempotency and clears body", async () => {
  loadedSettings = {
    ...settings,
    provider: "different_test",
    providerSettings: {
      endpoint: "https://fixture.invalid/sms",
      region: "cn",
      auth: "token",
      token_ref: settings.digestSecretRef,
    },
  };
  await load();
  await tab("测试发送");
  const raw = ui.within(document.getElementById("sms-test")!);
  ui.fireEvent.change(raw.getByLabelText("接收号码"), {
    target: { value: "13800138000" },
  });
  ui.fireEvent.change(raw.getByLabelText("已审核短信内容"), {
    target: { value: "fixture body" },
  });
  ui.fireEvent.click(raw.getByRole("checkbox"));
  expect(
    (raw.getByRole("button", { name: "发送短信" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await tab("供应商配置");
  ui.fireEvent.click(ui.screen.getByRole("button", { name: "编辑" }));
  const toggle = ui.screen.getByRole("switch", { name: "允许真实发送" });
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  ui.fireEvent.click(toggle);
  expect(writes).toHaveLength(0);
  ui.fireEvent.submit(ui.screen.getByRole("dialog").querySelector("form")!);
  await ui.waitFor(() =>
    expect(ui.screen.queryByRole("dialog") === null).toBe(true),
  );
  expect((writes[0].body.settings as SmsSettings).allowRealSend).toBe(true);
  await tab("测试发送");
  const send = ui.within(document.getElementById("sms-test")!);
  ui.fireEvent.change(send.getByLabelText("接收号码"), {
    target: { value: "13800138000" },
  });
  ui.fireEvent.change(send.getByLabelText("已审核短信内容"), {
    target: { value: "fixture body" },
  });
  ui.fireEvent.click(send.getByRole("checkbox"));
  ui.fireEvent.click(send.getByRole("button", { name: "发送短信" }));
  await ui.waitFor(() => expect(writes).toHaveLength(2));
  expect(writes[1].key).toMatch(/^[0-9a-f-]{36}$/);
  await ui.waitFor(() =>
    expect(
      (send.getByLabelText("已审核短信内容") as HTMLTextAreaElement).value,
    ).toBe(""),
  );
  await tab("最近 100 条发送记录");
  await ui.screen.findByText("***8000");
});
