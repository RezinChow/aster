import { useState } from 'react';
import { ConsoleDropdownMenu, useToast } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import { API_BASE } from '@/lib/apiBase';
import { publishAcpCloudAgent } from '@/lib/agentHubApi';
import { getUserToken } from '@/lib/userSession';
import { errorMessage } from '@/pages/assets/shared/useAssetQuery';

export function AcpCloudAgentCase({ onRegistered }: { onRegistered: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [digest, setDigest] = useState<string | null>(null);

  const download = async () => {
    const token = getUserToken();
    const response = await fetch(`${API_BASE}/assets/agents/acp-cloud/archive`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      toast.push({ tone: 'danger', title: t('assets.agents.case.downloadFailed') });
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'acp-cloud.aix';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const register = async () => {
    setSubmitting(true);
    try {
      const published = await publishAcpCloudAgent();
      setDigest(published.archiveDigest ?? null);
      toast.push({ tone: 'success', title: t('assets.agents.case.registered') });
      onRegistered();
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ConsoleDropdownMenu
      align="end"
      aria-label={t('assets.agents.case.title')}
      items={[
        {
          id: 'register',
          label: t('assets.agents.case.register'),
          disabled: submitting,
          onSelect: () => void register(),
        },
        {
          id: 'download',
          label: t('assets.agents.case.download'),
          onSelect: () => void download(),
        },
      ]}
      trigger={
        <span
          title={digest ?? t('assets.agents.case.body')}
          className="inline-flex min-h-7.5 items-center rounded-md border border-[#e5e5e5] bg-white px-2.5 text-[13px] text-[#171717]"
        >
          {t('assets.agents.case.title')}
        </span>
      }
    />
  );
}
