import { useEffect, useState, type FormEvent } from 'react';
import { FormDialog, ConsoleFormField, Input, SearchSelect, useToast } from '@a3s-lab/ui';
import {
  CHANNEL_LEVELS,
  createChannelPartner,
  emptyPartnerInput,
  isChannelLevel,
  type ChannelTerritory,
  type PartnerIssue,
} from '@/data/channelPartners';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { listCustomers, type Customer } from '@/lib/identityApi';
import { RegionCoverageField } from '@/components/RegionCascader';
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

export function ChannelCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [enterprises, setEnterprises] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [level, setLevel] = useState('');
  const [nationwide, setNationwide] = useState(false);
  const [territories, setTerritories] = useState<ChannelTerritory[]>([]);

  useEffect(() => {
    if (!open) {
      setCustomerId('');
      setLevel('');
      setNationwide(false);
      setTerritories([]);
      return;
    }
    let cancelled = false;
    void listCustomers()
      .then((items) => {
        if (cancelled) return;
        setEnterprises(items.filter((item) => item.kind === 'organization' && item.name.trim()));
      })
      .catch(() => {
        if (!cancelled) setEnterprises([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const customer = enterprises.find((item) => item.id === customerId);
    const covered = nationwide || territories.length > 0;
    if (!customer || !isChannelLevel(level) || !covered) return;
    const result = createChannelPartner({
      ...emptyPartnerInput(),
      ...fieldsFromOrganization(customer),
      level,
      nationwide,
      territories,
    }, { requireCoverage: true });
    if (!result.partner) {
      toast.push({ tone: 'danger', title: t(ISSUE_KEY[result.issue ?? 'name']) });
      return;
    }
    toast.push({ tone: 'success', title: t('channels.toast.created') });
    onCreated();
    onOpenChange(false);
  }

  const selected = enterprises.find((item) => item.id === customerId);
  const creatorName = selected
    ? selected.owner_name.trim() || selected.owner_phone || selected.phone || ''
    : '';

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t('channels.create.title')}
      description={t('channels.create.description')}
      closeLabel={t('dialog.close')}
      cancelLabel={t('channels.form.cancel')}
      submitLabel={t('channels.create.submit')}
      submitDisabled={!customerId || !isChannelLevel(level) || (!nationwide && territories.length === 0)}
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
            keywords: item.phone ?? '',
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
      {selected ? (
        <ConsoleFormField label={t('channels.field.contactName')} hint={t('channels.field.contactHint')}>
          <Input value={creatorName} disabled aria-label={t('channels.field.contactName')} />
        </ConsoleFormField>
      ) : null}
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
    </FormDialog>
  );
}
