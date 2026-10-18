import { useRef, useState } from "react";
import {
  Button,
  ConsoleFormField,
  ConsoleTextarea,
  Input,
  SearchSelect,
} from "@a3s-lab/ui";
import { useI18n } from "@/i18n/useI18n";
import {
  sendSms,
  type SmsProfile,
  type SmsProviderMetadata,
  type SmsReceipt,
} from "@/lib/smsApi";
import { GroupCard } from "./configKit";
export function SmsRawTest({
  profiles,
  providers,
  busy,
  action,
  onSent,
}: {
  profiles: SmsProfile[];
  providers: SmsProviderMetadata[];
  busy: boolean;
  action: (fn: () => Promise<void>) => Promise<void>;
  onSent: (r: SmsReceipt) => void;
}) {
  const { t } = useI18n();
  const [profileId, setProfileId] = useState("ToWork"),
    [recipient, setRecipient] = useState(""),
    [content, setContent] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const key = useRef<string | null>(null);
  const profile = profiles.find((p) => p.profileId === profileId),
    provider = providers.find((p) => p.id === profile?.provider);
  const reset = () => {
    setConfirmed(false);
    key.current = null;
  };
  return (
    <GroupCard anchor="sms-test" title={t("sms.rawTest")}>
      <li className="space-y-4 px-4 py-4">
        <p className="text-xs leading-5 text-ink-faint">{t("sms.sendHint")}</p>
        <ConsoleFormField label={t("sms.profile")}>
          <SearchSelect
            value={profileId}
            options={profiles.map((p) => ({
              value: p.profileId,
              label: p.profileId,
            }))}
            onChange={(v) => {
              setProfileId(v ?? "");
              reset();
            }}
          />
        </ConsoleFormField>
        <ConsoleFormField label={t("sms.recipient")}>
          <Input
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value);
              reset();
            }}
          />
        </ConsoleFormField>
        <ConsoleFormField label={t("sms.content")}>
          <ConsoleTextarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              reset();
            }}
          />
        </ConsoleFormField>
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={busy}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          {t("sms.confirm")}
        </label>
        <Button
          size="sm"
          disabled={
            busy ||
            !profile?.enabled ||
            !provider?.available ||
            (provider.requiresRealSend && !profile.settings.allowRealSend) ||
            !recipient ||
            !content ||
            !confirmed
          }
          onClick={() =>
            void action(async () => {
              if (!key.current) key.current = crypto.randomUUID();
              const receipt = await sendSms(
                profileId,
                recipient,
                content,
                key.current,
              );
              onSent(receipt);
              setContent("");
              setConfirmed(false);
            })
          }
        >
          {t("sms.send")}
        </Button>
      </li>
    </GroupCard>
  );
}
