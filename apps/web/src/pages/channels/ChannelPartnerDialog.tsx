import { useEffect, useState, type FormEvent } from 'react';
import { FormDialog, ConsoleFormField, Input, SearchSelect, useToast } from '@a3s-lab/ui';
import { RegionCoverageField } from '@/components/RegionCascader';
import {
  isChannelLevel,
  partnerToInput,
  updateChannelPartner,
  CHANNEL_LEVELS,
  type ChannelPartner,
  type ChannelPartnerStatus,
  type ChannelTerritory,
  type PartnerIssue,
} from '@/data/channelPartners';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { listCustomers, type Customer } from '@/lib/identityApi';
import { fieldsFromOrganization } from '@/pages/channels/channelCustomer';
import { levelLabel } from '@/pages/channels/ChannelTerritoryFields';

const ISSUE_KEY: Record<PartnerIssue, MessageKey> = {
  name: 'channels.toast.invalid',
  email: 'channels.toast.email',
  website: 'channels.toast.website',
  logo: 'channels.toast.logo',
  status: 'channels.toast.status',
  level: 'channels.toast.level',
  province: 'channels.toast.province',
  city: 'channels.toast.city',
  region: 'channels.toast.region',
  duplicate: 'channels.toast.duplicate',
};

function isStatus(value: string): value is ChannelPartnerStatus {
  return value === 'active' || value === 'inactive';
}

export function ChannelPartnerDialog({
  open,
  partner,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  partner: ChannelPartner | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (partner: ChannelPartner) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [enterprises, setEnterprises] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [level, setLevel] = useState('');
  const [nationwide, setNationwide] = useState(false);
  const [territories, setTerritories] = useState<ChannelTerritory[]>([]);
  const [status, setStatus] = useState<ChannelPartnerStatus>('active');

  useEffect(() => {
    if (!open) return;
    setCustomerId(partner?.customerId ?? '');
    setLevel(partner?.level ?? '');
    setNationwide(partner?.nationwide ?? false);
    setTerritories(partner?.territories ?? []);
    setStatus(partner?.status === 'inactive' ? 'inactive' : 'active');
    let cancelled = false;
    void listCustomers()
      .then((items) => {
        if (cancelled) return;
        const organizations = items.filter((item) => item.kind === 'organization' && item.name.trim());
        setEnterprises(organizations);
        if (!partner?.customerId && partner?.name) {
          const match = organizations.find((item) => item.name === partner.name);
          if (match) setCustomerId(match.id);
        }
      })
      .catch(() => {
        if (!cancelled) setEnterprises([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, partner]);

  const selected = enterprises.find((item) => item.id === customerId);
  const creatorName = selected
    ? selected.owner_name.trim() || selected.owner_phone || selected.phone || ''
    : partner?.contactName ?? '';
  const covered = nationwide || territories.length > 0;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!partner || !selected || !isChannelLevel(level) || !covered) return;
    const result = updateChannelPartner(
      partner.id,
      {
        ...partnerToInput(partner),
        ...fieldsFromOrganization(selected),
        level,
        nationwide,
        territories,
        status,
      },
      partner.createdAt,
      { requireCoverage: true },
    );
    if (!result.partner) {
      toast.push({ tone: 'danger', title: t(ISSUE_KEY[result.issue ?? 'name']) });
      return;
    }
    toast.push({ tone: 'success', title: t('channels.toast.saved') });
    onSaved(result.partner);
    onOpenChange(false);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t('channels.form.editTitle')}
      description={t('channels.form.body')}
      closeLabel={t('dialog.close')}
      cancelLabel={t('channels.form.cancel')}
      submitLabel={t('channels.form.save')}
      submitDisabled={!customerId || !isChannelLevel(level) || !covered}
      onSubmit={onSubmit}
    >
      <ConsoleFormField label={t('channels.create.customer')} required>
        <SearchSelect
          searchable={enterprises.length > 8}
          allowClear={false}
          value={customerId}
          onChange={setCustomerId}
          placeholder={t('channels.create.customerPlaceholder')}
          searchPlaceholder={t('channels.create.customerSearch')}
          emptyText={t('channels.create.customerEmpty')}
          aria-label={t('channels.create.customer')}
          options={enterprises.map((item) => ({
            value: item.id,
            label: item.name,
            keywords: item.owner_name,
          }))}
        />
      </ConsoleFormField>
      <ConsoleFormField label={t('channels.field.level')} required>
        <SearchSelect
          searchable={false}
          allowClear={false}
          value={level}
          onChange={setLevel}
          options={CHANNEL_LEVELS.map((value) => ({
            value,
            label: levelLabel(value, t),
          }))}
          placeholder={t('channels.field.levelEmpty')}
          aria-label={t('channels.field.level')}
        />
      </ConsoleFormField>
      <ConsoleFormField label={t('channels.field.contactName')} hint={t('channels.field.contactHint')}>
        <Input value={creatorName} disabled aria-label={t('channels.field.contactName')} />
      </ConsoleFormField>
      <ConsoleFormField label={t('channels.field.region')} required>
        <RegionCoverageField
          nationwide={nationwide}
          territories={territories}
          onChange={(next) => {
            setNationwide(next.nationwide);
            setTerritories(next.territories);
          }}
        />
      </ConsoleFormField>
      <ConsoleFormField label={t('channels.field.status')} required>
        <SearchSelect
          searchable={false}
          allowClear={false}
          value={status}
          onChange={(value) => {
            if (isStatus(value)) setStatus(value);
          }}
          options={[
            { value: 'active', label: t('channels.partnerStatus.active') },
            { value: 'inactive', label: t('channels.partnerStatus.inactive') },
          ]}
          aria-label={t('channels.field.status')}
        />
      </ConsoleFormField>
    </FormDialog>
  );
}
