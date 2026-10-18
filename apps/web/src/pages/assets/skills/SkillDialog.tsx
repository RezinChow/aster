import { useEffect, useState, type FormEvent } from 'react';
import { FileDropzone, FormDialog, ConsoleFormField, ConsoleTextarea, Input, useToast } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import { createSkill, updateSkill, type Skill, type SkillWrite } from '@/lib/skillHubApi';
import {
  CategorySelect,
  ColorInput,
  DEFAULT_COLOR,
  FeaturedSwitch,
  IconInput,
} from '@/pages/assets/shared/AssetFields';
import { formatBytes, splitList } from '@/pages/assets/shared/format';
import { errorMessage } from '@/pages/assets/shared/useAssetQuery';

type Draft = Omit<SkillWrite, 'tags' | 'homepage' | 'prompts'> & {
  tags: string;
  homepage: string;
  prompts: string;
};

const EMPTY: Draft = {
  slug: '',
  name: '',
  description: '',
  category: 'productivity',
  tags: '',
  author: '',
  version: '',
  prompts: '',
  license: '',
  homepage: '',
  color: DEFAULT_COLOR,
  featured: false,
  position: 0,
};

function draftOf(skill: Skill): Draft {
  return {
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    category: skill.category,
    tags: skill.tags.join(', '),
    author: skill.author,
    version: skill.version,
    prompts: (skill.prompts ?? []).join('\n'),
    license: skill.license,
    homepage: skill.homepage ?? '',
    color: skill.color,
    featured: skill.featured,
    position: skill.position,
  };
}

function writeOf(draft: Draft, removeIcon: boolean): SkillWrite {
  return {
    slug: draft.slug?.trim() || undefined,
    name: draft.name.trim(),
    description: draft.description.trim(),
    category: draft.category,
    tags: splitList(draft.tags),
    author: draft.author.trim(),
    version: draft.version.trim(),
    prompts: draft.prompts
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    license: draft.license.trim(),
    homepage: draft.homepage.trim() || undefined,
    color: draft.color.trim(),
    featured: draft.featured,
    position: Number.isFinite(draft.position) ? draft.position : 0,
    removeIcon,
  };
}

export function SkillDialog({
  open,
  onOpenChange,
  skill,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent → create (package required). */
  skill?: Skill;
  onSaved: (skill: Skill) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [pkg, setPkg] = useState<File | null>(null);
  const [icon, setIcon] = useState<File | null>(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));

  useEffect(() => {
    if (!open) return;
    setDraft(skill ? draftOf(skill) : EMPTY);
    setPkg(null);
    setIcon(null);
    setRemoveIcon(false);
  }, [open, skill]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const write = writeOf(draft, removeIcon);
      let saved: Skill;
      if (skill) {
        saved = await updateSkill(skill.slug, write, { pkg, icon });
      } else if (pkg) {
        saved = await createSkill(write, { pkg, icon });
      } else {
        return;
      }
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
      title={skill ? t('assets.skills.edit') : t('assets.skills.create')}
      description={t('assets.skills.createDesc')}
      cancelLabel={t('assets.action.cancel')}
      submitLabel={skill ? t('assets.action.save') : t('assets.action.create')}
      submitting={submitting}
      submitDisabled={!skill && !pkg}
      onSubmit={submit}
    >
      <ConsoleFormField
        label={t('assets.skills.field.package')}
        required={!skill}
        hint={skill ? t('assets.skills.field.packageReplaceHint') : t('assets.skills.field.packageHint')}
      >
        <FileDropzone
          accept=".zip,application/zip"
          label={pkg ? `${pkg.name} · ${formatBytes(pkg.size)}` : t('assets.skills.field.packageDrop')}
          onFiles={(files) => setPkg(files[0] ?? null)}
        />
      </ConsoleFormField>
      <IconInput
        name={draft.name || skill?.name || ''}
        color={draft.color}
        current={skill?.iconUrl}
        file={icon}
        removed={removeIcon}
        onFile={setIcon}
        onRemove={setRemoveIcon}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <ConsoleFormField label={t('assets.field.name')} hint={t('assets.skills.field.fromManifest')}>
          <Input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
        </ConsoleFormField>
        <ConsoleFormField label="Slug" hint={skill ? undefined : t('assets.field.slugHint')}>
          <Input
            value={draft.slug ?? ''}
            disabled={Boolean(skill)}
            placeholder="pdf-tools"
            onChange={(event) => patch({ slug: event.target.value })}
          />
        </ConsoleFormField>
      </div>
      <ConsoleFormField label={t('assets.field.description')} hint={t('assets.skills.field.fromManifest')}>
        <Input value={draft.description} onChange={(event) => patch({ description: event.target.value })} />
      </ConsoleFormField>
      <div className="grid gap-3 sm:grid-cols-3">
        <ConsoleFormField label={t('assets.field.category')}>
          <CategorySelect value={draft.category} onChange={(category) => patch({ category })} />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.skills.field.author')}>
          <Input value={draft.author} onChange={(event) => patch({ author: event.target.value })} />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.skills.field.version')}>
          <Input value={draft.version} placeholder="1.0.0" onChange={(event) => patch({ version: event.target.value })} />
        </ConsoleFormField>
      </div>
      <ConsoleFormField label={t('assets.skills.field.prompts')} hint={t('assets.skills.field.promptsHint')}>
        <ConsoleTextarea
          value={draft.prompts}
          rows={4}
          placeholder={t('assets.skills.field.promptsPlaceholder')}
          onChange={(event) => patch({ prompts: event.target.value })}
        />
      </ConsoleFormField>
      <div className="grid gap-3 sm:grid-cols-3">
        <ConsoleFormField label={t('assets.field.license')}>
          <Input value={draft.license} onChange={(event) => patch({ license: event.target.value })} />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.field.homepage')}>
          <Input value={draft.homepage} placeholder="https://" onChange={(event) => patch({ homepage: event.target.value })} />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.field.color')}>
          <ColorInput value={draft.color} onChange={(color) => patch({ color })} />
        </ConsoleFormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ConsoleFormField label={t('assets.field.tags')} hint={t('assets.field.listHint')}>
          <Input value={draft.tags} onChange={(event) => patch({ tags: event.target.value })} />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.field.position')} hint={t('assets.field.positionHint')}>
          <Input
            type="number"
            value={String(draft.position)}
            onChange={(event) => patch({ position: Number(event.target.value) || 0 })}
          />
        </ConsoleFormField>
      </div>
      <FeaturedSwitch checked={draft.featured} onChange={(featured) => patch({ featured })} />
    </FormDialog>
  );
}
