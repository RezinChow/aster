import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  ConsoleEmptyState,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@a3s-lab/ui";
import { useI18n } from "@/i18n/useI18n";
import {
  smsAssets,
  smsBalance,
  smsMessages,
  smsProfiles,
  smsProviders,
  type SmsAsset,
  type SmsProfile,
  type SmsProviderMetadata,
  type SmsReceipt,
} from "@/lib/smsApi";
import { SmsContentManagement, SmsScenarioTest } from "./SmsContentManagement";
import { SmsProviderDialog } from "./SmsProviderDialog";
import { SmsRawTest } from "./SmsRawTest";
import { I18nDataTable } from "@/components/I18nDataTable";
import type { MessageKey } from "@/i18n/messages";
const views = [
  "providers",
  "signature",
  "template",
  "scenario",
  "testing",
  "records",
] as const;
type View = (typeof views)[number];
const labels: Record<View, MessageKey> = {
  providers: "sms.providerConfigs",
  signature: "sms.signatures",
  template: "sms.templates",
  scenario: "sms.scenarios",
  testing: "sms.testing",
  records: "sms.records",
};
export function SmsSection() {
  const { t } = useI18n();
  const [view, setView] = useState<View>("providers");
  const [assets, setAssets] = useState<SmsAsset[]>([]),
    [profiles, setProfiles] = useState<SmsProfile[]>([]),
    [providers, setProviders] = useState<SmsProviderMetadata[]>([]),
    [records, setRecords] = useState<SmsReceipt[]>([]);
  const [editor, setEditor] = useState<{ profile?: SmsProfile } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    setBusy(true);
    void Promise.all([
      smsProviders(),
      smsProfiles(),
      smsAssets(),
      smsMessages(),
    ])
      .then(([d, p, a, m]) => {
        if (active) {
          setProviders(d);
          setProfiles(p);
          setAssets(a);
          setRecords(m);
        }
      })
      .catch(() => {
        if (active) setError(t("sms.loadError"));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [t]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch {
      setError(t("sms.actionError"));
    } finally {
      setBusy(false);
    }
  }
  const savedAsset = (asset: SmsAsset) => {
    setAssets((current) => [
      asset,
      ...current.filter(
        (a) =>
          a.settings.assetId !== asset.settings.assetId ||
          a.settings.content.kind !== asset.settings.content.kind,
      ),
    ]);
    setNotice(t("sms.saved"));
  };
  const sent = (receipt: SmsReceipt) => {
    setRecords((current) => [
      receipt,
      ...current.filter((r) => r.id !== receipt.id),
    ]);
    setNotice(`${t("sms.result")}: ${t(`sms.state.${receipt.state}`)}`);
  };
  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-5 text-ink-muted">
        {t("sms.manageHint")}
      </p>
      <Tabs
        value={view}
        onValueChange={(v) => {
          setView(v as View);
          setNotice("");
        }}
        variant="underline"
      >
        <TabsList aria-label={t("sms.configuration")} className="flex-wrap">
          {views.map((v) => (
            <TabsTrigger key={v} value={v}>
              {t(labels[v])}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {error ? (
        <Alert tone="danger">
          <p>{error}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const [d, p, a, m] = await Promise.all([
                  smsProviders(),
                  smsProfiles(),
                  smsAssets(),
                  smsMessages(),
                ]);
                setProviders(d);
                setProfiles(p);
                setAssets(a);
                setRecords(m);
              })
            }
          >
            {t("sms.refresh")}
          </Button>
        </Alert>
      ) : null}
      {notice ? (
        <p role="status" className="text-xs text-ink-muted">
          {notice}
        </p>
      ) : null}
      {view === "providers" ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-ink">
              {t("sms.providerConfigs")}
            </h3>
            <Button
              size="sm"
              disabled={busy || !providers.some((p) => p.available)}
              onClick={() => setEditor({})}
            >
              {t("sms.newProfile")}
            </Button>
          </div>
          <I18nDataTable<SmsProfile>
            aria-label={t("sms.providerConfigs")}
            rows={profiles}
            loading={busy}
            rowKey={(p) => p.profileId}
            showGlobalFilter
            globalFilterPlaceholder={t("sms.profile")}
            getRowFilterText={(p) => `${p.profileId} ${p.provider}`}
            empty={
              <ConsoleEmptyState variant="no-data" title={t("sms.noProfile")} />
            }
            columns={[
              {
                id: "name",
                header: t("sms.profile"),
                cell: (p) => (
                  <div>
                    <span className="font-medium">{p.profileId}</span>
                    <p className="text-xs text-ink-faint">v{p.revision}</p>
                  </div>
                ),
              },
              {
                id: "provider",
                header: t("sms.provider"),
                cell: (p) =>
                  providers.find((d) => d.id === p.provider)?.name ??
                  p.provider,
              },
              {
                id: "enabled",
                header: t("sms.status"),
                cell: (p) => (
                  <Badge tone={p.enabled ? "success" : "neutral"}>
                    {t(p.enabled ? "sms.enabled" : "sms.disabled")}
                  </Badge>
                ),
              },
              {
                id: "send",
                header: t("sms.allowRealSend"),
                cell: (p) =>
                  p.requiresRealSend === false
                    ? "—"
                    : t(
                        p.settings.allowRealSend
                          ? "sms.enabled"
                          : "sms.disabled",
                      ),
              },
              {
                id: "actions",
                header: t("sms.edit"),
                cell: (p) => (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditor({ profile: p })}
                    >
                      {t("sms.edit")}
                    </Button>
                    {providers.find((d) => d.id === p.provider)
                      ?.supportsBalance ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || !p.enabled}
                        onClick={() =>
                          void action(async () => {
                            const b = await smsBalance(p.profileId);
                            setNotice(`${t("sms.balance")}: ${b.remaining}`);
                          })
                        }
                      >
                        {t("sms.queryBalance")}
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        </section>
      ) : null}
      {view === "signature" || view === "template" || view === "scenario" ? (
        <SmsContentManagement
          key={view}
          section={view}
          assets={assets}
          profiles={profiles.filter(
            (p) =>
              providers.find((d) => d.id === p.provider)?.supportsScenarios,
          )}
          busy={busy || !!error}
          action={action}
          onSaved={savedAsset}
        />
      ) : null}
      {view === "testing" ? (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <SmsScenarioTest
            assets={assets}
            profiles={profiles}
            busy={busy || !!error}
            action={action}
            onSent={sent}
          />
          <SmsRawTest
            profiles={profiles}
            providers={providers}
            busy={busy || !!error}
            action={action}
            onSent={sent}
          />
        </div>
      ) : null}
      {view === "records" ? (
        <I18nDataTable<SmsReceipt>
          aria-label={t("sms.records")}
          rows={records}
          loading={busy}
          rowKey={(r) => r.id}
          onRefresh={() => action(async () => setRecords(await smsMessages()))}
          empty={<ConsoleEmptyState variant="no-data" title={t("sms.empty")} />}
          columns={[
            {
              id: "profile",
              header: t("sms.profile"),
              cell: (r) => `${r.profileId} · v${r.profileRevision}`,
            },
            {
              id: "recipient",
              header: t("sms.recipient"),
              cell: (r) => r.recipientMask,
            },
            {
              id: "state",
              header: t("sms.status"),
              cell: (r) => (
                <Badge
                  tone={
                    r.state === "accepted"
                      ? "success"
                      : r.state === "rejected"
                        ? "danger"
                        : "warn"
                  }
                >
                  {t(`sms.state.${r.state}`)}
                </Badge>
              ),
            },
            {
              id: "time",
              header: t("sms.time"),
              cell: (r) => new Date(r.createdAt).toLocaleString(),
            },
          ]}
        />
      ) : null}
      {editor ? (
        <SmsProviderDialog
          profile={editor.profile}
          providers={providers}
          onClose={() => setEditor(null)}
          onSaved={(p) => {
            setProfiles((current) => [
              p,
              ...current.filter((v) => v.profileId !== p.profileId),
            ]);
            setNotice(t("sms.saved"));
          }}
        />
      ) : null}
    </div>
  );
}
