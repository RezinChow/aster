import "../secondaryBack.dom";
import { afterEach, beforeEach, beforeAll, expect, test } from "bun:test";
import { useState } from "react";
import { SmsContentManagement, SmsScenarioTest } from "./SmsContentManagement";
import {
  setUserSession,
  setCloudPersonCredential,
  clearUserSession,
} from "@/lib/userSession";
import type { SmsAsset, SmsProfile } from "@/lib/smsApi";
let ui: typeof import("../../../../../packages/ui/node_modules/@testing-library/react/pure");
beforeAll(async () => {
  ui =
    await import("../../../../../packages/ui/node_modules/@testing-library/react/pure");
});
const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const profile: SmsProfile = {
  profileId: "ToWork",
  revision: 1,
  enabled: true,
  requiresRealSend: false,
  provider: "virtual",
  definitionAcl: 'sms "ToWork" {}',
  settings: {
    allowRealSend: false,
    profileId: "ToWork",
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
  },
};
let originalFetch: typeof fetch;
let writes: { url: string; body: Record<string, any>; key: string | null }[];
let database: SmsAsset[];
beforeEach(() => {
  originalFetch = globalThis.fetch;
  writes = [];
  database = [];
  setUserSession("a3s_us_fixture", ORG);
  setCloudPersonCredential({
    accessToken: `a3s_${"ab".repeat(32)}`,
    organizationId: ORG,
    principalId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    subject: "fixture",
  });
  globalThis.fetch = async (input, init) => {
    const url = String(input),
      body = JSON.parse(String(init?.body));
    writes.push({
      url,
      body,
      key: new Headers(init?.headers).get("Idempotency-Key"),
    });
    let data: unknown;
    if (url.endsWith("/sms/assets")) {
      const saved: SmsAsset = {
        revision: body.expectedRevision + 1,
        settings: body.settings,
        definitionAcl: 'sms_asset "fixture" {}',
      };
      database = [
        saved,
        ...database.filter(
          (a) =>
            a.settings.assetId !== saved.settings.assetId ||
            a.settings.content.kind !== saved.settings.content.kind,
        ),
      ];
      data = { kind: "asset", data: saved };
    } else if (url.endsWith("/sms/preview"))
      data = {
        kind: "preview",
        data: {
          profileId: "ToWork",
          composition: {},
          body: "验证码 ABC123",
          content: "【ToWork】验证码 ABC123",
          characterCount: 19,
          variables: ["code"],
        },
      };
    else if (url.endsWith("/sms/scenario-messages"))
      data = {
        kind: "message",
        data: {
          id: "receipt",
          profileId: "ToWork",
          profileRevision: 1,
          provider: "virtual",
          recipientMask: "***8000",
          state: "accepted",
          reason: null,
          providerMessageId: null,
          createdAt: "2026-10-08T00:00:00Z",
          settled: true,
        },
      };
    else throw new Error("unexpected route");
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
function Harness() {
  const [assets, setAssets] = useState<SmsAsset[]>([]),
    [sent, setSent] = useState(false);
  const [section, setSection] = useState<"signature" | "template" | "scenario">(
    "signature",
  );
  const action = async (fn: () => Promise<void>) => {
    await fn();
  };
  return (
    <>
      <button onClick={() => setSection("signature")}>
        fixture signatures
      </button>
      <button onClick={() => setSection("template")}>fixture templates</button>
      <button onClick={() => setSection("scenario")}>fixture scenarios</button>
      <SmsContentManagement
        key={section}
        section={section}
        assets={assets}
        profiles={[profile]}
        busy={false}
        action={action}
        onSaved={(asset) =>
          setAssets((v) => [
            asset,
            ...v.filter(
              (a) =>
                a.settings.assetId !== asset.settings.assetId ||
                a.settings.content.kind !== asset.settings.content.kind,
            ),
          ])
        }
      />
      <SmsScenarioTest
        assets={assets}
        profiles={[profile]}
        busy={false}
        action={action}
        onSent={() => setSent(true)}
      />
      {sent ? <p>fixture receipt</p> : null}
    </>
  );
}
const card = (id: string) => ui.within(document.getElementById(id)!);
const change = (id: string, label: string, value: string) =>
  ui.fireEvent.change(card(id).getByLabelText(label), { target: { value } });
test("manage signatures and engine templates, bind login, preview without dispatch, then explicitly send", async () => {
  ui.render(<Harness />);
  expect(writes).toHaveLength(0);

  ui.fireEvent.click(ui.screen.getByRole("button", { name: "新建" }));
  ui.fireEvent.change(
    ui
      .within(ui.screen.getByRole("dialog"))
      .getByLabelText("配置标识", { exact: false }),
    {
      target: { value: "towork" },
    },
  );
  ui.fireEvent.change(
    ui
      .within(ui.screen.getByRole("dialog"))
      .getByLabelText("显示名称", { exact: false }),
    {
      target: { value: "ToWork" },
    },
  );
  ui.fireEvent.change(
    ui
      .within(ui.screen.getByRole("dialog"))
      .getByLabelText("签名文字", { exact: false }),
    {
      target: { value: "ToWork" },
    },
  );
  ui.fireEvent.click(ui.screen.getByRole("switch", { name: "启用" }));
  ui.fireEvent.submit(ui.screen.getByRole("dialog").querySelector("form")!);
  await ui.waitFor(() =>
    expect(ui.screen.queryByRole("dialog") === null).toBe(true),
  );
  ui.fireEvent.click(
    ui.screen.getByRole("button", { name: "fixture templates" }),
  );
  ui.fireEvent.click(ui.screen.getByRole("button", { name: "新建" }));
  ui.fireEvent.change(
    ui
      .within(ui.screen.getByRole("dialog"))
      .getByLabelText("配置标识", { exact: false }),
    {
      target: { value: "login-code" },
    },
  );
  ui.fireEvent.change(
    ui
      .within(ui.screen.getByRole("dialog"))
      .getByLabelText("显示名称", { exact: false }),
    {
      target: { value: "登录验证码" },
    },
  );
  ui.fireEvent.change(
    ui
      .within(ui.screen.getByRole("dialog"))
      .getByLabelText("正文模板", { exact: false }),
    {
      target: { value: "验证码 {{ code }}" },
    },
  );
  await ui.screen.findByText("code");
  ui.fireEvent.click(ui.screen.getByRole("switch", { name: "启用" }));
  ui.fireEvent.submit(ui.screen.getByRole("dialog").querySelector("form")!);
  await ui.waitFor(() =>
    expect(ui.screen.queryByRole("dialog") === null).toBe(true),
  );
  expect(writes[1].body.settings.content).toEqual({
    kind: "template",
    engine: "minijinja",
    source: "验证码 {{ code }}",
    variables: ["code"],
  });
  ui.fireEvent.click(
    ui.screen.getByRole("button", { name: "fixture scenarios" }),
  );
  const login = ui.screen.getByText("登录").closest("tr")!;
  ui.fireEvent.click(ui.within(login).getByRole("button", { name: "编辑" }));
  async function choose(label: string, option: string) {
    ui.fireEvent.click(
      (ui.screen.queryByRole("dialog")
        ? ui.within(ui.screen.getByRole("dialog"))
        : card("sms-scenario-test")
      ).getByLabelText(label, { exact: false }),
    );
    const item = await ui.screen.findByRole("option", { name: option });
    ui.fireEvent.click(item.querySelector("button") ?? item);
  }
  await choose("场景签名", "ToWork · v1");
  await choose("场景正文模板", "登录验证码 · v1");
  ui.fireEvent.click(ui.screen.getByRole("switch", { name: "启用" }));
  ui.fireEvent.submit(ui.screen.getByRole("dialog").querySelector("form")!);
  await ui.waitFor(() =>
    expect(ui.screen.queryByRole("dialog") === null).toBe(true),
  );
  expect(writes[2].body.settings.content.scenario).toBe("login");
  expect(writes.every((w) => w.url.endsWith("/sms/assets"))).toBe(true);
  await choose("测试场景", "登录 · v1");
  change("sms-scenario-test", "接收号码", "13800138000");
  change("sms-scenario-test", "code", "ABC123");
  const send = card("sms-scenario-test").getByRole("button", {
    name: "发送短信",
  }) as HTMLButtonElement;
  expect(send.disabled).toBe(true);
  ui.fireEvent.click(
    card("sms-scenario-test").getByRole("button", { name: "预览短信" }),
  );
  await ui.screen.findByText("【ToWork】验证码 ABC123");
  expect(writes).toHaveLength(4);
  expect(writes[3].url).toContain("/sms/preview");
  expect(writes[3].key).toBeNull();
  expect(send.disabled).toBe(true);
  ui.fireEvent.click(card("sms-scenario-test").getByRole("checkbox"));
  expect(send.disabled).toBe(false);
  change("sms-scenario-test", "code", "changed");
  expect(send.disabled).toBe(true);
  expect(ui.screen.queryByText("【ToWork】验证码 ABC123")).toBeNull();
  change("sms-scenario-test", "code", "ABC123");
  ui.fireEvent.click(
    card("sms-scenario-test").getByRole("button", { name: "预览短信" }),
  );
  await ui.screen.findByText("【ToWork】验证码 ABC123");
  ui.fireEvent.click(card("sms-scenario-test").getByRole("checkbox"));
  ui.fireEvent.click(send);
  await ui.screen.findByText("fixture receipt");
  expect(writes[5].url).toContain("/sms/scenario-messages");
  expect(writes[5].key).toMatch(/^[0-9a-f-]{36}$/);
  expect(writes[5].body).toEqual({
    scenario: "login",
    scenarioRevision: 1,
    recipient: "13800138000",
    variables: { code: "ABC123" },
  });
  expect(ui.screen.queryByText("【ToWork】验证码 ABC123")).toBeNull();

  ui.fireEvent.click(
    ui.screen.getByRole("button", { name: "fixture signatures" }),
  );
  ui.fireEvent.click(ui.screen.getByRole("button", { name: "编辑" }));
  ui.fireEvent.click(ui.screen.getByRole("switch", { name: "启用" }));
  ui.fireEvent.submit(ui.screen.getByRole("dialog").querySelector("form")!);
  await ui.waitFor(() => expect(writes).toHaveLength(7));
  expect(writes[6].body.expectedRevision).toBe(1);
  expect(writes[6].body.settings.enabled).toBe(false);
  await ui.waitFor(() =>
    expect(ui.screen.queryByRole("dialog") === null).toBe(true),
  );
  expect(
    (
      card("sms-scenario-test").getByRole("button", {
        name: "预览短信",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
