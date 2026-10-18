import { useEffect, useState, type FormEvent } from 'react';
import { FormDialog, ConsoleFormField, Input, SearchSelect, ConsoleTextarea, useToast } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import {
  createModel,
  importModel,
  updateModel,
  type HubModel,
  type ModelCardInput,
  type ModelHubKind,
  type ModelVisibility,
  type TaskDomainGroup,
} from '@/lib/modelHubApi';
import { splitList } from '@/pages/assets/shared/format';
import { hubLabel, taskDomainLabel, taskLabel } from '@/pages/assets/shared/taxonomy';
import { errorMessage } from '@/pages/assets/shared/useAssetQuery';

type CardDraft = {
  summary: string;
  task: string;
  frameworks: string;
  license: string;
  languages: string;
  tags: string;
  parameters: string;
  readme: string;
  visibility: ModelVisibility;
};

const EMPTY_DRAFT: CardDraft = {
  summary: '',
  task: 'text-generation',
  frameworks: '',
  license: 'apache-2.0',
  languages: '',
  tags: '',
  parameters: '',
  readme: '',
  visibility: 'public',
};

function draftOf(model: HubModel): CardDraft {
  return {
    summary: model.summary,
    task: model.task,
    frameworks: model.frameworks.join(', '),
    license: model.license,
    languages: model.languages.join(', '),
    tags: model.tags.join(', '),
    parameters: model.parameters,
    readme: model.readme,
    visibility: model.visibility,
  };
}

function inputOf(draft: CardDraft): ModelCardInput {
  return {
    summary: draft.summary.trim(),
    task: draft.task,
    frameworks: splitList(draft.frameworks),
    license: draft.license.trim(),
    languages: splitList(draft.languages),
    tags: splitList(draft.tags),
    parameters: draft.parameters.trim(),
    readme: draft.readme,
    visibility: draft.visibility,
  };
}

function VisibilitySelect({
  value,
  onChange,
}: {
  value: ModelVisibility;
  onChange: (value: ModelVisibility) => void;
}) {
  const { t } = useI18n();
  return (
    <SearchSelect
      value={value}
      searchable={false}
      allowClear={false}
      options={[
        { value: 'public', label: t('assets.models.visibility.public') },
        { value: 'private', label: t('assets.models.visibility.private') },
      ]}
      onChange={(next) => onChange((next || 'public') as ModelVisibility)}
    />
  );
}

function CardFields({
  draft,
  onChange,
  taskGroups,
}: {
  draft: CardDraft;
  onChange: (patch: Partial<CardDraft>) => void;
  taskGroups: TaskDomainGroup[];
}) {
  const { t, locale } = useI18n();
  const taskOptions = taskGroups.flatMap((group) =>
    group.tasks.map((task) => ({
      value: task,
      label: `${taskLabel(task, locale)} · ${taskDomainLabel(group.domain, locale)}`,
      keywords: task,
    })),
  );
  return (
    <>
      <ConsoleFormField label={t('assets.models.field.summary')}>
        <Input value={draft.summary} onChange={(event) => onChange({ summary: event.target.value })} />
      </ConsoleFormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <ConsoleFormField label={t('assets.models.field.task')} required>
          <SearchSelect
            value={draft.task}
            options={taskOptions}
            allowClear={false}
            onChange={(task) => onChange({ task: task || 'other' })}
          />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.models.field.visibility')}>
          <VisibilitySelect value={draft.visibility} onChange={(visibility) => onChange({ visibility })} />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.models.field.license')}>
          <Input value={draft.license} onChange={(event) => onChange({ license: event.target.value })} />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.models.field.parameters')} hint="7B / 0.5B">
          <Input
            value={draft.parameters}
            onChange={(event) => onChange({ parameters: event.target.value })}
          />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.models.field.frameworks')} hint={t('assets.field.listHint')}>
          <Input
            value={draft.frameworks}
            placeholder="transformers, safetensors"
            onChange={(event) => onChange({ frameworks: event.target.value })}
          />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.models.field.languages')} hint={t('assets.field.listHint')}>
          <Input
            value={draft.languages}
            placeholder="zh, en"
            onChange={(event) => onChange({ languages: event.target.value })}
          />
        </ConsoleFormField>
      </div>
      <ConsoleFormField label={t('assets.field.tags')} hint={t('assets.field.listHint')}>
        <Input value={draft.tags} onChange={(event) => onChange({ tags: event.target.value })} />
      </ConsoleFormField>
      <ConsoleFormField label="README.md">
        <ConsoleTextarea
          rows={8}
          className="font-mono text-xs"
          value={draft.readme}
          onChange={(event) => onChange({ readme: event.target.value })}
        />
      </ConsoleFormField>
    </>
  );
}

export function ModelCreateDialog({
  open,
  onOpenChange,
  taskGroups,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskGroups: TaskDomainGroup[];
  onCreated: (model: HubModel) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [owner, setOwner] = useState('');
  const [name, setName] = useState('');
  const [draft, setDraft] = useState<CardDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOwner('');
    setName('');
    setDraft(EMPTY_DRAFT);
  }, [open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const model = await createModel({ owner: owner.trim(), name: name.trim(), ...inputOf(draft) });
      onOpenChange(false);
      onCreated(model);
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
      size="lg"
      title={t('assets.models.create')}
      description={t('assets.models.createDesc')}
      cancelLabel={t('assets.action.cancel')}
      submitLabel={t('assets.action.create')}
      submitting={submitting}
      submitDisabled={!owner.trim() || !name.trim()}
      onSubmit={submit}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <ConsoleFormField label={t('assets.models.field.owner')} required>
          <Input value={owner} placeholder="kense" onChange={(event) => setOwner(event.target.value)} />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.models.field.name')} required>
          <Input value={name} placeholder="Qwen3-8B" onChange={(event) => setName(event.target.value)} />
        </ConsoleFormField>
      </div>
      <CardFields
        draft={draft}
        taskGroups={taskGroups}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
      />
    </FormDialog>
  );
}

export function ModelEditDialog({
  open,
  onOpenChange,
  model,
  taskGroups,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: HubModel;
  taskGroups: TaskDomainGroup[];
  onSaved: (model: HubModel) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<CardDraft>(() => draftOf(model));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setDraft(draftOf(model));
  }, [open, model]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const saved = await updateModel(model.owner, model.name, inputOf(draft));
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
      size="lg"
      title={t('assets.models.edit')}
      cancelLabel={t('assets.action.cancel')}
      submitLabel={t('assets.action.save')}
      submitting={submitting}
      onSubmit={submit}
    >
      <CardFields
        draft={draft}
        taskGroups={taskGroups}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
      />
    </FormDialog>
  );
}

export function ModelImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (model: HubModel) => void;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [hub, setHub] = useState<ModelHubKind>('modelscope');
  const [repo, setRepo] = useState('');
  const [revision, setRevision] = useState('');
  const [owner, setOwner] = useState('');
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<ModelVisibility>('public');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRepo('');
    setRevision('');
    setOwner('');
    setName('');
    setVisibility('public');
  }, [open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const model = await importModel({
        hub,
        repo: repo.trim(),
        revision: revision.trim() || undefined,
        owner: owner.trim() || undefined,
        name: name.trim() || undefined,
        visibility,
      });
      onOpenChange(false);
      onImported(model);
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
      title={t('assets.models.import')}
      description={t('assets.models.importDesc')}
      cancelLabel={t('assets.action.cancel')}
      submitLabel={t('assets.models.import')}
      submitting={submitting}
      submitDisabled={!/^[^/\s]+\/[^/\s]+$/.test(repo.trim())}
      onSubmit={submit}
    >
      <ConsoleFormField label={t('assets.models.field.hub')} required>
        <SearchSelect
          value={hub}
          searchable={false}
          allowClear={false}
          options={[
            { value: 'modelscope', label: hubLabel('modelscope', locale) },
            { value: 'huggingface', label: hubLabel('huggingface', locale) },
          ]}
          onChange={(next) => setHub((next || 'modelscope') as ModelHubKind)}
        />
      </ConsoleFormField>
      <ConsoleFormField label={t('assets.models.field.repo')} required hint={t('assets.models.field.repoHint')}>
        <Input value={repo} placeholder="Qwen/Qwen3-8B" onChange={(event) => setRepo(event.target.value)} />
      </ConsoleFormField>
      <ConsoleFormField label={t('assets.models.field.revision')}>
        <Input value={revision} placeholder="master / main" onChange={(event) => setRevision(event.target.value)} />
      </ConsoleFormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <ConsoleFormField label={t('assets.models.field.owner')} hint={t('assets.models.field.ownerHint')}>
          <Input value={owner} onChange={(event) => setOwner(event.target.value)} />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.models.field.name')}>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </ConsoleFormField>
      </div>
      <ConsoleFormField label={t('assets.models.field.visibility')}>
        <VisibilitySelect value={visibility} onChange={setVisibility} />
      </ConsoleFormField>
    </FormDialog>
  );
}
