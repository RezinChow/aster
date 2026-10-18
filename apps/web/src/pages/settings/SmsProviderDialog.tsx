import { useState } from "react";
import {
  Alert,
  ConsoleFormField,
  FormDialog,
  Input,
  SearchSelect,
  Switch,
} from "@a3s-lab/ui";
import { useI18n } from "@/i18n/useI18n";
import {
  createSmsSecret,
  saveSmsSettings,
  type SmsProfile,
  type SmsProviderMetadata,
  type SmsSettings,
  type SmsProviderField,
} from "@/lib/smsApi";

export function providerDefaults(provider?: SmsProviderMetadata) {
  return Object.fromEntries(
    (provider?.fields ?? [])
      .filter((f) => f.default !== null)
      .map((f) => [f.key, f.default!]),
  );
}
export const visibleProviderField = (
  field: SmsProviderField,
  values: Record<string, unknown>,
) =>
  !field.visibleWhen ||
  values[field.visibleWhen.field] === field.visibleWhen.equals;
function emptySettings(provider?: SmsProviderMetadata): SmsSettings {
  return {
    profileId: "ToWork",
    provider: provider?.id ?? "",
    providerSettings: providerDefaults(provider),
    enabled: false,
    allowRealSend: false,
    maximumPerMinute: 10,
    digestSecretRef: "",
    signature: null,
    usernameSecretRef: null,
    credentialSecretRef: null,
    authMethod: null,
    responseFormat: null,
    timeoutMs: null,
    maxMessageChars: null,
    scenario: null,
  };
}
export function SmsProviderDialog({
  profile,
  providers,
  onClose,
  onSaved,
}: {
  profile?: SmsProfile;
  providers: SmsProviderMetadata[];
  onClose: () => void;
  onSaved: (profile: SmsProfile) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<SmsSettings>(() =>
    profile
      ? structuredClone(profile.settings)
      : emptySettings(providers.find((p) => p.available)),
  );
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const provider = providers.find((p) => p.id === draft.provider);
  const values = draft.providerSettings ?? {};
  const patch = (value: Partial<SmsSettings>) => {
    setDraft((current) => ({ ...current, ...value }));
    setError("");
  };
  const parameter = (key: string, value: string | number | boolean) =>
    patch({ providerSettings: { ...values, [key]: value } });
  function valid() {
    if (
      !provider?.available ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(draft.profileId) ||
      !Number.isInteger(draft.maximumPerMinute) ||
      draft.maximumPerMinute < 1 ||
      draft.maximumPerMinute > 100
    )
      return false;
    return provider.fields.every((f) => {
      if (!visibleProviderField(f, values)) return true;
      const v =
        f.schema.type === "secret_ref"
          ? secrets[f.key] || values[f.key]
          : values[f.key];
      if (v === undefined || v === "") return !f.required;
      switch (f.schema.type) {
        case "integer":
          return (
            typeof v === "number" &&
            Number.isInteger(v) &&
            v >= f.schema.min &&
            v <= f.schema.max
          );
        case "text":
          return typeof v === "string" && [...v].length <= f.schema.max_len;
        case "choice":
          return f.schema.options.some((o) => o.value === v);
        case "boolean":
          return typeof v === "boolean";
        case "secret_ref":
          return typeof v === "string" && v.length <= 4096;
      }
    });
  }
  async function save() {
    if (!valid() || !provider) {
      setError(t("sms.parameterError"));
      return;
    }
    setBusy(true);
    setError("");
    // Reuse each stored reference if the profile CAS fails; never write raw credentials to settings.
    let next = structuredClone(draft);
    try {
      for (const f of provider.fields) {
        if (
          f.schema.type !== "secret_ref" ||
          !secrets[f.key] ||
          !visibleProviderField(f, values)
        )
          continue;
        const ref = await createSmsSecret(
          `sms-${next.profileId.slice(0, 20)}-${crypto.randomUUID().slice(0, 8)}`,
          secrets[f.key],
          crypto.randomUUID(),
        );
        next.providerSettings = { ...next.providerSettings, [f.key]: ref };
        setSecrets((current) => ({ ...current, [f.key]: "" }));
        setDraft(structuredClone(next));
      }
      if (!next.digestSecretRef) {
        const key = Array.from(
          crypto.getRandomValues(new Uint8Array(32)),
          (b) => b.toString(16).padStart(2, "0"),
        ).join("");
        next.digestSecretRef = await createSmsSecret(
          `sms-digest-${crypto.randomUUID().slice(0, 8)}`,
          key,
          crypto.randomUUID(),
        );
        setDraft(structuredClone(next));
      }
      const saved = await saveSmsSettings(next, profile?.revision ?? 0);
      onSaved(saved);
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
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="lg"
      title={
        profile
          ? `${t("sms.edit")} · ${profile.profileId}`
          : t("sms.newProfile")
      }
      description={t("sms.discard")}
      closeLabel={t("dialog.close")}
      cancelLabel={t("sms.cancel")}
      submitLabel={t("sms.save")}
      submitting={busy}
      submitDisabled={!provider?.available}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <ConsoleFormField label={t("sms.profile")} required>
            <Input
              value={draft.profileId}
              disabled={!!profile}
              onChange={(e) => patch({ profileId: e.target.value })}
            />
          </ConsoleFormField>
          <ConsoleFormField label={t("sms.provider")} required>
            <SearchSelect
              value={draft.provider}
              allowClear={false}
              options={providers.map((p) => ({
                value: p.id,
                label: p.name,
                disabled: !p.available,
              }))}
              onChange={(id) => {
                const p = providers.find((p) => p.id === id);
                setSecrets({});
                patch({
                  provider: id ?? "",
                  providerSettings: providerDefaults(p),
                  allowRealSend: false,
                });
              }}
            />
          </ConsoleFormField>
        </div>
        {provider ? (
          <p className="text-xs leading-5 text-ink-faint">
            {provider.description}
          </p>
        ) : null}
        {!provider?.available ? (
          <Alert tone="warn">{t("sms.unsupported")}</Alert>
        ) : null}
        <h3 className="border-t border-border pt-4 text-sm font-medium text-ink">
          {t("sms.providerParameters")}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {provider?.fields
            .filter((f) => visibleProviderField(f, values))
            .map((f) => (
              <ConsoleFormField
                key={f.key}
                label={f.label}
                required={f.required}
                hint={
                  f.schema.type === "secret_ref"
                    ? values[f.key]
                      ? t("sms.secretKeep")
                      : t("sms.secretNew")
                    : f.description || undefined
                }
              >
                {f.schema.type === "choice" ? (
                  <SearchSelect
                    value={String(values[f.key] ?? "")}
                    options={f.schema.options}
                    allowClear={!f.required}
                    onChange={(v) => parameter(f.key, v ?? "")}
                  />
                ) : f.schema.type === "boolean" ? (
                  <Switch
                    checked={values[f.key] === true}
                    label={f.label}
                    onCheckedChange={(v) => parameter(f.key, v)}
                  />
                ) : f.schema.type === "secret_ref" ? (
                  <Input
                    type="password"
                    autoComplete="off"
                    value={secrets[f.key] ?? ""}
                    onChange={(e) =>
                      setSecrets((current) => ({
                        ...current,
                        [f.key]: e.target.value,
                      }))
                    }
                  />
                ) : f.schema.type === "integer" ? (
                  <Input
                    type="number"
                    min={f.schema.min}
                    max={f.schema.max}
                    step={1}
                    value={
                      values[f.key] === undefined ? "" : String(values[f.key])
                    }
                    onChange={(e) =>
                      parameter(
                        f.key,
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                  />
                ) : (
                  <Input
                    maxLength={f.schema.max_len}
                    value={String(values[f.key] ?? "")}
                    onChange={(e) => parameter(f.key, e.target.value)}
                  />
                )}
              </ConsoleFormField>
            ))}
        </div>
        <h3 className="border-t border-border pt-4 text-sm font-medium text-ink">
          {t("sms.security")}
        </h3>
        <ConsoleFormField label={t("sms.rate")}>
          <Input
            type="number"
            min={1}
            max={100}
            value={draft.maximumPerMinute}
            onChange={(e) =>
              patch({ maximumPerMinute: Number(e.target.value) })
            }
          />
        </ConsoleFormField>
        <Switch
          checked={draft.enabled}
          label={t("sms.enabled")}
          onCheckedChange={(enabled) => patch({ enabled })}
        />
        {provider?.requiresRealSend ? (
          <ConsoleFormField hint={t("sms.allowRealSendHint")}>
            <Switch
              checked={draft.allowRealSend}
              label={t("sms.allowRealSend")}
              onCheckedChange={(allowRealSend) => patch({ allowRealSend })}
            />
          </ConsoleFormField>
        ) : null}
        <p className="text-xs text-ink-faint">{t("sms.digestAuto")}</p>
      </fieldset>
    </FormDialog>
  );
}
