import { useEffect, useState, type FormEvent } from 'react';
import { ConsoleFormField, FormDialog, Input, SearchSelect, useToast } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import { createInferenceDeployment, type InferenceDeployment } from '@/lib/inferenceApi';
import { listModels, type ModelSummary } from '@/lib/modelsApi';
import { errorMessage } from '@/pages/assets/shared/useAssetQuery';
import { warehouseModelForRepo } from './deploymentScope';

function engineOf(model: ModelSummary): string {
  return model.engine || model.runtime?.backends?.[0] || '';
}

function quantOf(model: ModelSummary): string {
  return model.quantization || model.runtime?.weight_formats?.[0] || '';
}

function choices(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

export function DeploymentDialog({
  open,
  onOpenChange,
  projectId,
  environmentId,
  deployments,
  repoId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  environmentId: string;
  deployments: InferenceDeployment[];
  /** Hub model `owner/name`. The dialog deploys only this repo. */
  repoId: string;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [modelId, setModelId] = useState('');
  const [name, setName] = useState('');
  const [engine, setEngine] = useState('');
  const [quantization, setQuantization] = useState('');
  const [replicas, setReplicas] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const applyModel = (model: ModelSummary | undefined) => {
    if (!model) {
      setName('');
      setEngine('');
      setQuantization('');
      return;
    }
    const existing = deployments.find((row) => row.modelId === model.id);
    const engines = choices(model.runtime?.backends);
    const quants = choices(model.runtime?.weight_formats);
    const preferredEngine = engineOf(model) || existing?.engine || '';
    const preferredQuant = quantOf(model) || existing?.quantization || '';
    const listed = (options: string[], preferred: string) =>
      options.find((value) => value.toLowerCase() === preferred.toLowerCase()) || options[0] || '';
    setName(model.display_name || model.repo_id);
    setEngine(engines.length ? listed(engines, preferredEngine) : preferredEngine);
    setQuantization(quants.length ? listed(quants, preferredQuant) : preferredQuant);
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setModelId('');
    setName('');
    setEngine('');
    setQuantization('');
    setReplicas('1');
    listModels()
      .then((rows) => {
        if (cancelled) return;
        const match = warehouseModelForRepo(rows, repoId);
        setModels(match ? [match] : []);
        if (match) {
          setModelId(match.id);
          applyModel(match);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.push({ tone: 'danger', title: errorMessage(err) });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, repoId]);

  const selected = models.find((model) => model.id === modelId) ?? null;
  const replicaCount = Number(replicas);
  const digest = selected?.content_digest?.trim() ?? '';
  const engineChoices = choices(selected?.runtime?.backends);
  const quantChoices = choices(selected?.runtime?.weight_formats);
  const engineLocked = engineChoices.length > 0;
  const quantLocked = quantChoices.length > 0;
  const modelLabel = selected ? selected.display_name || selected.repo_id : repoId;

  const hint = !selected
    ? models.length === 0 && !loading
      ? t('modelService.deployment.noWarehouse')
      : undefined
    : !digest
      ? t('modelService.deployment.noDigest')
      : undefined;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !digest || !name.trim() || !engine.trim() || !quantization.trim()) return;
    if (!Number.isInteger(replicaCount) || replicaCount < 1 || replicaCount > 100) return;
    setSubmitting(true);
    try {
      await createInferenceDeployment({
        projectId,
        environmentId,
        modelId: selected.id,
        artifactDigest: digest,
        name: name.trim(),
        replicas: replicaCount,
        engine: engine.trim(),
        quantization: quantization.trim(),
      });
      toast.push({ tone: 'success', title: t('modelService.deployment.created') });
      onOpenChange(false);
      onSaved();
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
      title={t('modelService.deployment.create')}
      description={t('modelService.deployment.createDesc')}
      closeLabel={t('dialog.close')}
      cancelLabel={t('assets.action.cancel')}
      submitLabel={t('modelService.deployment.create')}
      submitting={submitting}
      submitDisabled={
        loading ||
        !selected ||
        !digest ||
        !name.trim() ||
        !engine.trim() ||
        !quantization.trim() ||
        !Number.isInteger(replicaCount) ||
        replicaCount < 1 ||
        replicaCount > 100
      }
      onSubmit={(event) => void submit(event)}
    >
      <div className="grid gap-3">
        <ConsoleFormField label={t('modelService.deployment.model')} required hint={hint}>
          <Input
            value={modelLabel}
            readOnly
            aria-label={t('modelService.deployment.model')}
          />
        </ConsoleFormField>
        <ConsoleFormField label={t('modelService.deployment.deployName')} required>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </ConsoleFormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <ConsoleFormField label={t('modelService.deployment.engineField')} required>
            {engineLocked ? (
              <SearchSelect
                size="sm"
                value={engine}
                allowClear={false}
                searchable={engineChoices.length > 8}
                aria-label={t('modelService.deployment.engineField')}
                options={engineChoices.map((value) => ({ value, label: value }))}
                onChange={setEngine}
              />
            ) : (
              <Input value={engine} onChange={(event) => setEngine(event.target.value)} />
            )}
          </ConsoleFormField>
          <ConsoleFormField label={t('modelService.deployment.quantField')} required>
            {quantLocked ? (
              <SearchSelect
                size="sm"
                value={quantization}
                allowClear={false}
                searchable={quantChoices.length > 8}
                aria-label={t('modelService.deployment.quantField')}
                options={quantChoices.map((value) => ({ value, label: value }))}
                onChange={setQuantization}
              />
            ) : (
              <Input value={quantization} onChange={(event) => setQuantization(event.target.value)} />
            )}
          </ConsoleFormField>
        </div>
        <ConsoleFormField label={t('modelService.deployment.replicasField')} required>
          <Input
            type="number"
            min={1}
            max={100}
            value={replicas}
            onChange={(event) => setReplicas(event.target.value)}
          />
        </ConsoleFormField>
      </div>
    </FormDialog>
  );
}
