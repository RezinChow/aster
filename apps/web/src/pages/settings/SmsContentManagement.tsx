import { useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  ConsoleEmptyState,
  ConsoleFormField,
  ConsoleTextarea,
  FormDialog,
  Input,
  SearchSelect,
  Switch,
} from "@a3s-lab/ui";
import { GroupCard } from "./configKit";
import { FieldRow, SubHead } from "./configFields";
import { I18nDataTable } from "@/components/I18nDataTable";
import { useI18n } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/messages";
import type { ValueSchema } from "@/lib/configApi";
import type { Draft } from "@/lib/configSchema";
import {
  previewSmsScenario,
  saveSmsAsset,
  sendSmsScenario,
  smsAssetRef,
  type SmsAsset,
  type SmsAssetSettings,
  type SmsProfile,
  type SmsReceipt,
  type SmsScenario,
  type SmsPreview,
} from "@/lib/smsApi";
const scenarios: SmsScenario[] = [
  "general",
  "login",
  "register",
  "reset_password",
  "notification",
];
function ContentField({
  label,
  value,
  schema,
  disabled,
  onChange,
}: {
  label: string;
  value: Draft;
  schema?: ValueSchema;
  disabled: boolean;
  onChange: (v: Draft) => void;
}) {
  const { t } = useI18n();
  return (
    <li className="px-4 py-3">
      <fieldset disabled={disabled}>
        {schema?.type === "enum" ? (
          <ConsoleFormField label={label}>
            <SearchSelect
              value={typeof value === "string" ? value : ""}
              options={schema.options}
              onChange={(v) => onChange(v ?? "")}
            />
          </ConsoleFormField>
        ) : (
          <FieldRow
            t={t}
            head={(id) => <SubHead t={t} id={id} label={label} />}
            label={label}
            schema={schema ?? { type: "text", max_len: 128 }}
            draft={value}
            onChange={onChange}
          />
        )}
      </fieldset>
    </li>
  );
}
const refKey = (a: SmsAsset) => `${a.settings.assetId}@${a.revision}`;
type ManagementProps = {
  assets: SmsAsset[];
  profiles: SmsProfile[];
  busy: boolean;
  action: (fn: () => Promise<void>) => Promise<void>;
  onSaved: (a: SmsAsset) => void;
};
export function SmsContentManagement({
  section,
  ...props
}: ManagementProps & { section: "signature" | "template" | "scenario" }) {
  return section === "scenario" ? (
    <ScenarioList {...props} />
  ) : (
    <AssetList key={section} kind={section} {...props} />
  );
}
function AssetList({
  kind,
  assets,
  busy,
  onSaved,
}: ManagementProps & { kind: "signature" | "template" }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<{ asset?: SmsAsset } | null>(null);
  const list = assets.filter((a) => a.settings.content.kind === kind);
  const title = t(kind === "signature" ? "sms.signatures" : "sms.templates");
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-ink">{title}</h3>
        <Button size="sm" disabled={busy} onClick={() => setEditing({})}>
          {t("sms.newAsset")}
        </Button>
      </div>
      <I18nDataTable<SmsAsset>
        aria-label={title}
        rows={list}
        loading={busy}
        rowKey={(a) => a.settings.assetId}
        showGlobalFilter
        globalFilterPlaceholder={t("sms.assetName")}
        getRowFilterText={(a) => `${a.settings.name} ${a.settings.assetId}`}
        empty={<ConsoleEmptyState variant="no-data" title={t("sms.empty")} />}
        columns={[
          {
            id: "name",
            header: t("sms.assetName"),
            cell: (a) => (
              <div>
                <span className="font-medium">{a.settings.name}</span>
                <p className="text-xs text-ink-faint">
                  {a.settings.assetId} · v{a.revision}
                </p>
              </div>
            ),
          },
          {
            id: "content",
            header: t(
              kind === "signature" ? "sms.signatureText" : "sms.templateSource",
            ),
            cell: (a) => (
              <p className="max-w-md truncate text-ink-muted">
                {a.settings.content.kind === "signature"
                  ? a.settings.content.text
                  : a.settings.content.kind === "template"
                    ? a.settings.content.source
                    : ""}
              </p>
            ),
          },
          {
            id: "state",
            header: t("sms.status"),
            cell: (a) => (
              <Badge tone={a.settings.enabled ? "success" : "neutral"}>
                {t(a.settings.enabled ? "sms.enabled" : "sms.disabled")}
              </Badge>
            ),
          },
          {
            id: "actions",
            header: t("sms.edit"),
            cell: (a) => (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setEditing({ asset: a })}
              >
                {t("sms.edit")}
              </Button>
            ),
          },
        ]}
      />
      {editing ? (
        <AssetDialog
          kind={kind}
          asset={editing.asset}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      ) : null}
    </section>
  );
}
function AssetDialog({
  kind,
  asset,
  onClose,
  onSaved,
}: {
  kind: "signature" | "template";
  asset?: SmsAsset;
  onClose: () => void;
  onSaved: (a: SmsAsset) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<SmsAssetSettings>(() =>
    asset
      ? structuredClone(asset.settings)
      : {
          assetId: "",
          name: "",
          enabled: false,
          content:
            kind === "signature"
              ? { kind, text: "" }
              : { kind, engine: "minijinja", source: "", variables: [] },
        },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const patch = (p: Partial<SmsAssetSettings>) => {
    setDraft((v) => ({ ...v, ...p }));
    setError("");
  };
  const content = draft.content;
  async function save() {
    setBusy(true);
    setError("");
    try {
      const a = await saveSmsAsset(draft, asset?.revision ?? 0);
      onSaved(a);
      onClose();
    } catch {
      setError(t("sms.actionError"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <FormDialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      size="lg"
      title={`${t(asset ? "sms.edit" : "sms.newAsset")} · ${t(kind === "signature" ? "sms.signatures" : "sms.templates")}`}
      closeLabel={t("dialog.close")}
      cancelLabel={t("sms.cancel")}
      submitLabel={t("sms.save")}
      submitting={busy}
      submitDisabled={
        !draft.assetId ||
        !draft.name ||
        (content.kind === "signature"
          ? !content.text
          : content.kind === "template"
            ? !content.source
            : true)
      }
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <ConsoleFormField label={t("sms.assetId")} required>
            <Input
              value={draft.assetId}
              disabled={!!asset}
              onChange={(e) => patch({ assetId: e.target.value })}
            />
          </ConsoleFormField>
          <ConsoleFormField label={t("sms.assetName")} required>
            <Input
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </ConsoleFormField>
        </div>
        {content.kind === "signature" ? (
          <ConsoleFormField
            label={t("sms.signatureText")}
            required
            hint={t("sms.signatureHint")}
          >
            <Input
              maxLength={64}
              value={content.text}
              onChange={(e) =>
                patch({ content: { ...content, text: e.target.value } })
              }
            />
          </ConsoleFormField>
        ) : content.kind === "template" ? (
          <>
            <ConsoleFormField
              label={t("sms.templateSource")}
              required
              hint={t("sms.templateHint")}
            >
              <ConsoleTextarea
                rows={7}
                value={content.source}
                onChange={(e) => {
                  const source = e.target.value;
                  const variables = Array.from(
                    new Set(
                      Array.from(
                        source.matchAll(
                          /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g,
                        ),
                        (m) => m[1],
                      ),
                    ),
                  );
                  patch({ content: { ...content, source, variables } });
                }}
              />
            </ConsoleFormField>
            <div className="space-y-2">
              <p className="text-xs text-ink-muted">
                {t("sms.templateVariables")}
              </p>
              <div className="flex flex-wrap gap-2">
                {content.variables.map((v) => (
                  <Badge key={v}>{v}</Badge>
                ))}
              </div>
            </div>
          </>
        ) : null}
        <Switch
          checked={draft.enabled}
          label={t("sms.enabled")}
          onCheckedChange={(enabled) => patch({ enabled })}
        />
      </fieldset>
    </FormDialog>
  );
}
function ScenarioList({ assets, profiles, busy, onSaved }: ManagementProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<SmsScenario | null>(null);
  const rows = scenarios.map((s) => ({
    scenario: s,
    asset: assets.find(
      (a) => a.settings.content.kind === "scenario" && a.settings.assetId === s,
    ),
  }));
  return (
    <section className="space-y-3">
      <p className="text-xs text-ink-faint">{t("sms.scenarioHint")}</p>
      <I18nDataTable
        aria-label={t("sms.scenarios")}
        rows={rows}
        loading={busy}
        showPagination={false}
        rowKey={(r) => r.scenario}
        columns={[
          {
            id: "scenario",
            header: t("sms.businessScenario"),
            cell: (r) => (
              <span className="font-medium">
                {t(`sms.scenario.${r.scenario}`)}
              </span>
            ),
          },
          {
            id: "binding",
            header: t("sms.configuration"),
            cell: (r) => {
              const c = r.asset?.settings.content;
              return c?.kind === "scenario" ? (
                <div className="space-y-1 text-xs">
                  <p>{c.profileId}</p>
                  <p className="text-ink-faint">
                    {c.signature.assetId} · v{c.signature.revision} /{" "}
                    {c.template.assetId} · v{c.template.revision}
                  </p>
                </div>
              ) : (
                "—"
              );
            },
          },
          {
            id: "status",
            header: t("sms.status"),
            cell: (r) => (
              <Badge tone={r.asset?.settings.enabled ? "success" : "neutral"}>
                {t(
                  !r.asset
                    ? "sms.unbound"
                    : r.asset.settings.enabled
                      ? "sms.enabled"
                      : "sms.disabled",
                )}
              </Badge>
            ),
          },
          {
            id: "actions",
            header: t("sms.edit"),
            cell: (r) => (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setEditing(r.scenario)}
              >
                {t("sms.edit")}
              </Button>
            ),
          },
        ]}
      />
      {editing ? (
        <ScenarioDialog
          scenario={editing}
          assets={assets}
          profiles={profiles}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      ) : null}
    </section>
  );
}
function ScenarioDialog({
  scenario,
  assets,
  profiles,
  onClose,
  onSaved,
}: {
  scenario: SmsScenario;
  assets: SmsAsset[];
  profiles: SmsProfile[];
  onClose: () => void;
  onSaved: (a: SmsAsset) => void;
}) {
  const { t } = useI18n();
  const asset = assets.find(
    (a) =>
      a.settings.content.kind === "scenario" && a.settings.assetId === scenario,
  );
  const binding =
    asset?.settings.content.kind === "scenario" ? asset.settings.content : null;
  const [profileId, setProfileId] = useState(binding?.profileId ?? "ToWork"),
    [signature, setSignature] = useState(
      binding
        ? `${binding.signature.assetId}@${binding.signature.revision}`
        : "",
    ),
    [template, setTemplate] = useState(
      binding ? `${binding.template.assetId}@${binding.template.revision}` : "",
    ),
    [enabled, setEnabled] = useState(asset?.settings.enabled ?? false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const list = (kind: "signature" | "template") =>
    assets
      .filter((a) => a.settings.content.kind === kind)
      .map((a) => ({
        value: refKey(a),
        label: `${a.settings.name} · v${a.revision}${a.settings.enabled ? "" : ` · ${t("sms.disabled")}`}`,
      }));
  const sign = assets.find(
      (a) => a.settings.content.kind === "signature" && refKey(a) === signature,
    ),
    body = assets.find(
      (a) => a.settings.content.kind === "template" && refKey(a) === template,
    );
  async function save() {
    if (!sign || !body) return;
    setBusy(true);
    setError("");
    try {
      const a = await saveSmsAsset(
        {
          assetId: scenario,
          name: t(`sms.scenario.${scenario}`),
          enabled,
          content: {
            kind: "scenario",
            scenario,
            profileId,
            signature: smsAssetRef(sign),
            template: smsAssetRef(body),
          },
        },
        asset?.revision ?? 0,
      );
      onSaved(a);
      onClose();
    } catch {
      setError(t("sms.actionError"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <FormDialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      size="md"
      title={`${t("sms.edit")} · ${t(`sms.scenario.${scenario}`)}`}
      closeLabel={t("dialog.close")}
      cancelLabel={t("sms.cancel")}
      submitLabel={t("sms.saveScenario")}
      submitting={busy}
      submitDisabled={
        !sign ||
        !body ||
        !profiles.some((p) => p.profileId === profileId) ||
        (enabled && (!sign.settings.enabled || !body.settings.enabled))
      }
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <fieldset disabled={busy} className="space-y-4">
        <ConsoleFormField label={t("sms.profile")} required>
          <SearchSelect
            value={profileId}
            options={profiles.map((p) => ({
              value: p.profileId,
              label: `${p.profileId} · ${p.provider}`,
            }))}
            onChange={(v) => setProfileId(v ?? "")}
          />
        </ConsoleFormField>
        <ConsoleFormField label={t("sms.sceneSignature")} required>
          <SearchSelect
            value={signature}
            options={list("signature")}
            onChange={(v) => setSignature(v ?? "")}
          />
        </ConsoleFormField>
        <ConsoleFormField label={t("sms.sceneTemplate")} required>
          <SearchSelect
            value={template}
            options={list("template")}
            onChange={(v) => setTemplate(v ?? "")}
          />
        </ConsoleFormField>
        <Switch
          checked={enabled}
          label={t("sms.enabled")}
          onCheckedChange={setEnabled}
        />
      </fieldset>
    </FormDialog>
  );
}
export function SmsScenarioTest({
  blockedProfileId,
  assets,
  profiles,
  busy,
  action,
  onSent,
}: {
  blockedProfileId?: string | null;
  assets: SmsAsset[];
  profiles: SmsProfile[];
  busy: boolean;
  action: (fn: () => Promise<void>) => Promise<void>;
  onSent: (receipt: SmsReceipt) => void;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(""),
    [recipient, setRecipient] = useState(""),
    [values, setValues] = useState<Record<string, string>>({}),
    [preview, setPreview] = useState<SmsPreview | null>(null),
    [confirmed, setConfirmed] = useState(false);
  const key = useRef<string | null>(null),
    intent = useRef("");
  const scene = assets.find(
    (a) =>
      a.settings.content.kind === "scenario" &&
      a.settings.assetId === selected &&
      a.settings.enabled,
  );
  const binding =
    scene?.settings.content.kind === "scenario" ? scene.settings.content : null;
  const body = assets.find(
    (a) =>
      binding &&
      a.settings.content.kind === "template" &&
      a.settings.assetId === binding.template.assetId &&
      a.revision === binding.template.revision,
  );
  const variables =
    body?.settings.content.kind === "template"
      ? body.settings.content.variables
      : [];
  const profile = profiles.find((p) => p.profileId === binding?.profileId);
  const signature = assets.find(
    (a) =>
      binding &&
      a.settings.content.kind === "signature" &&
      a.settings.assetId === binding.signature.assetId &&
      a.revision === binding.signature.revision,
  );
  const dependenciesActive =
    !!signature?.settings.enabled && !!body?.settings.enabled;
  const currentIntent = JSON.stringify([
    scene?.revision,
    profile?.revision,
    binding,
    recipient,
    values,
  ]);
  const validPreview =
    preview && dependenciesActive && intent.current === currentIntent;
  const reset = () => {
    setPreview(null);
    setConfirmed(false);
    key.current = null;
  };
  return (
    <GroupCard anchor="sms-scenario-test" title={t("sms.scenarioTest")}>
      <ContentField
        label={t("sms.testScenario")}
        value={selected}
        disabled={busy}
        schema={{
          type: "enum",
          options: assets
            .filter(
              (a) =>
                a.settings.content.kind === "scenario" && a.settings.enabled,
            )
            .map((a) => ({
              value: a.settings.assetId,
              label: `${t(`sms.scenario.${a.settings.assetId}` as MessageKey)} · v${a.revision}`,
            })),
        }}
        onChange={(v) => {
          setSelected(String(v));
          setValues({});
          reset();
        }}
      />
      <ContentField
        label={t("sms.recipient")}
        value={recipient}
        disabled={busy}
        onChange={(v) => {
          setRecipient(String(v));
          reset();
        }}
      />
      {variables.map((name) => (
        <ContentField
          key={name}
          label={name}
          value={values[name] ?? ""}
          disabled={busy}
          schema={{ type: "text", max_len: 1024 }}
          onChange={(v) => {
            setValues((old) => ({ ...old, [name]: String(v) }));
            reset();
          }}
        />
      ))}
      <li className="space-y-3 px-4 py-3">
        <Button
          size="sm"
          variant="outline"
          disabled={
            busy ||
            !binding ||
            !scene ||
            !dependenciesActive ||
            variables.some((v) => !values[v])
          }
          onClick={() =>
            void action(async () => {
              if (!binding || !scene) return;
              const result = await previewSmsScenario(
                binding.scenario,
                scene.revision,
                values,
              );
              setPreview(result);
              intent.current = currentIntent;
              setConfirmed(false);
            })
          }
        >
          {t("sms.preview")}
        </Button>
        {validPreview ? (
          <Alert tone="info">
            <p className="whitespace-pre-wrap break-words">{preview.content}</p>
            <p className="mt-2 text-[12px]">
              {t("sms.characterCount")}: {preview.characterCount}
            </p>
          </Alert>
        ) : null}
        <label className="flex items-center gap-2 text-[13px] text-ink-muted">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={busy || !validPreview}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          {t("sms.confirm")}
        </label>
        <Button
          size="sm"
          disabled={
            busy ||
            !validPreview ||
            !confirmed ||
            !recipient ||
            !profile?.enabled ||
            profile.profileId === blockedProfileId ||
            (profile.requiresRealSend !== false &&
              !profile.settings.allowRealSend)
          }
          onClick={() =>
            void action(async () => {
              if (!scene || !binding) return;
              if (!key.current) key.current = crypto.randomUUID();
              const receipt = await sendSmsScenario(
                binding.scenario,
                scene.revision,
                recipient,
                values,
                key.current,
              );
              onSent(receipt);
              reset();
              setValues({});
            })
          }
        >
          {t("sms.send")}
        </Button>
      </li>
    </GroupCard>
  );
}
