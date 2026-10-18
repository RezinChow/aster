import { useEffect, useState, type FormEvent } from 'react';
import { FormDialog, ConsoleFormField, Input, ConsoleTextarea, useToast } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import { createAgent, updateAgent, type Agent, type AgentWrite } from '@/lib/agentHubApi';
import {
  CategorySelect,
  ColorInput,
  DEFAULT_COLOR,
  FeaturedSwitch,
} from '@/pages/assets/shared/AssetFields';
import { splitList } from '@/pages/assets/shared/format';
import { errorMessage } from '@/pages/assets/shared/useAssetQuery';

type Draft = Omit<AgentWrite, 'tags'> & { tags: string };

const EMPTY: Draft = {
  slug: '',
  name: '',
  description: '',
  prompt: '',
  emoji: '',
  category: 'productivity',
  tags: '',
  color: DEFAULT_COLOR,
  featured: false,
  position: 0,
};

function draftOf(agent: Agent): Draft {
  return {
    slug: agent.slug,
    name: agent.name,
    description: agent.description,
    prompt: agent.prompt,
    emoji: agent.emoji,
    category: agent.category,
    tags: agent.tags.join(', '),
    color: agent.color,
    featured: agent.featured,
    position: agent.position,
  };
}

function writeOf(draft: Draft): AgentWrite {
  return {
    slug: draft.slug?.trim() || undefined,
    name: draft.name.trim(),
    description: draft.description.trim(),
    prompt: draft.prompt,
    emoji: draft.emoji.trim(),
    category: draft.category,
    tags: splitList(draft.tags),
    color: draft.color.trim(),
    featured: draft.featured,
    position: Number.isFinite(draft.position) ? draft.position : 0,
  };
}

export function AgentDialog({
  open,
  onOpenChange,
  agent,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: Agent;
  onSaved: (agent: Agent) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));

  useEffect(() => {
    if (!open) return;
    setDraft(agent ? draftOf(agent) : EMPTY);
  }, [open, agent]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const write = writeOf(draft);
      const saved = agent ? await updateAgent(agent.slug, write) : await createAgent(write);
      onOpenChange(false);
      onSaved(saved);
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={agent ? t('assets.agents.edit') : t('assets.agents.create')}
      description={t('assets.agents.createDesc')}
      cancelLabel={t('assets.action.cancel')}
      submitLabel={agent ? t('assets.action.save') : t('assets.action.create')}
      submitting={submitting}
      submitDisabled={!draft.name.trim() || !draft.slug?.trim()}
      onSubmit={submit}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <ConsoleFormField label={t('assets.field.name')} required>
          <Input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
        </ConsoleFormField>
        <ConsoleFormField label="Slug" hint={agent ? undefined : t('assets.field.slugHint')}>
          <Input
            value={draft.slug ?? ''}
            disabled={Boolean(agent)}
            placeholder="writer"
            onChange={(event) => patch({ slug: event.target.value })}
          />
        </ConsoleFormField>
      </div>
      <ConsoleFormField label={t('assets.field.description')}>
        <Input value={draft.description} onChange={(event) => patch({ description: event.target.value })} />
      </ConsoleFormField>
      <div className="grid gap-3 sm:grid-cols-3">
        <ConsoleFormField label={t('assets.field.category')}>
          <CategorySelect value={draft.category} onChange={(category) => patch({ category })} />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.agents.field.emoji')}>
          <Input value={draft.emoji} placeholder="文" onChange={(event) => patch({ emoji: event.target.value })} />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.field.color')}>
          <ColorInput value={draft.color} onChange={(color) => patch({ color })} />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.field.position')} hint={t('assets.field.positionHint')}>
          <Input
            type="number"
            value={String(draft.position)}
            onChange={(event) => patch({ position: Number(event.target.value) || 0 })}
          />
        </ConsoleFormField>
      </div>
      <ConsoleFormField label={t('assets.field.tags')} hint={t('assets.field.listHint')}>
        <Input value={draft.tags} onChange={(event) => patch({ tags: event.target.value })} />
      </ConsoleFormField>
      <FeaturedSwitch checked={draft.featured} onChange={(featured) => patch({ featured })} />
      <ConsoleFormField label={t('assets.agents.field.prompt')}>
        <ConsoleTextarea
          rows={8}
          value={draft.prompt}
          onChange={(event) => patch({ prompt: event.target.value })}
        />
      </ConsoleFormField>
    </FormDialog>
  );
}
