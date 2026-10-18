import { useEffect, useState, type FormEvent } from 'react';
import {
  Button,
  Checkbox,
  FormDialog,
  ConsoleFormField,
  Input,
  SearchSelect,
  ConsoleTextarea,
  useToast,
} from '@a3s-lab/ui';
import { IconPlus, IconTrash } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import {
  createConnector,
  updateConnector,
  type Connector,
  type ConnectorConfigField,
  type ConnectorTool,
  type ConnectorWrite,
  type McpTransport,
} from '@/lib/connectorHubApi';
import {
  CategorySelect,
  ColorInput,
  DEFAULT_COLOR,
  FeaturedSwitch,
  IconInput,
} from '@/pages/assets/shared/AssetFields';
import { splitList } from '@/pages/assets/shared/format';
import { transportLabel } from '@/pages/assets/shared/taxonomy';
import { errorMessage } from '@/pages/assets/shared/useAssetQuery';

type Draft = Omit<ConnectorWrite, 'tags' | 'args' | 'homepage' | 'url' | 'command'> & {
  tags: string;
  args: string;
  homepage: string;
  url: string;
  command: string;
};

const EMPTY: Draft = {
  slug: '',
  name: '',
  description: '',
  category: 'productivity',
  tags: '',
  provider: '',
  homepage: '',
  license: '',
  color: DEFAULT_COLOR,
  featured: false,
  position: 0,
  transport: 'streamable_http',
  url: '',
  command: '',
  args: '',
  config: [],
  tools: [],
  readme: '',
};

function draftOf(connector: Connector): Draft {
  return {
    slug: connector.slug,
    name: connector.name,
    description: connector.description,
    category: connector.category,
    tags: connector.tags.join(', '),
    provider: connector.provider,
    homepage: connector.homepage ?? '',
    license: connector.license,
    color: connector.color,
    featured: connector.featured,
    position: connector.position,
    transport: connector.transport,
    url: connector.url ?? '',
    command: connector.command ?? '',
    args: connector.args.join('\n'),
    config: connector.config,
    tools: connector.tools,
    readme: connector.readme,
  };
}

function writeOf(draft: Draft, removeIcon: boolean): ConnectorWrite {
  const stdio = draft.transport === 'stdio';
  return {
    slug: draft.slug?.trim() || undefined,
    name: draft.name.trim(),
    description: draft.description.trim(),
    category: draft.category,
    tags: splitList(draft.tags),
    provider: draft.provider.trim(),
    homepage: draft.homepage.trim() || undefined,
    license: draft.license.trim(),
    color: draft.color.trim(),
    featured: draft.featured,
    position: Number.isFinite(draft.position) ? draft.position : 0,
    transport: draft.transport,
    url: stdio ? undefined : draft.url.trim() || undefined,
    command: stdio ? draft.command.trim() || undefined : undefined,
    args: stdio
      ? draft.args
          .split('\n')
          .map((arg) => arg.trim())
          .filter(Boolean)
      : [],
    config: draft.config.filter((field) => field.key.trim()),
    tools: draft.tools.filter((tool) => tool.name.trim()),
    readme: draft.readme,
    removeIcon,
  };
}

export function ConnectorDialog({
  open,
  onOpenChange,
  connector,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent → create. */
  connector?: Connector;
  onSaved: (connector: Connector) => void;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [icon, setIcon] = useState<File | null>(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));

  useEffect(() => {
    if (!open) return;
    setDraft(connector ? draftOf(connector) : EMPTY);
    setIcon(null);
    setRemoveIcon(false);
  }, [open, connector]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const write = writeOf(draft, removeIcon);
      const saved = connector
        ? await updateConnector(connector.slug, write, icon)
        : await createConnector(write, icon);
      onOpenChange(false);
      onSaved(saved);
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const stdio = draft.transport === 'stdio';
  const ready = draft.name.trim() && (stdio ? draft.command.trim() : draft.url.trim());

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={connector ? t('assets.connectors.edit') : t('assets.connectors.create')}
      description={t('assets.connectors.createDesc')}
      cancelLabel={t('assets.action.cancel')}
      submitLabel={connector ? t('assets.action.save') : t('assets.action.create')}
      submitting={submitting}
      submitDisabled={!ready}
      onSubmit={submit}
    >
      <IconInput
        name={draft.name}
        color={draft.color}
        current={connector?.iconUrl}
        file={icon}
        removed={removeIcon}
        onFile={setIcon}
        onRemove={setRemoveIcon}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <ConsoleFormField label={t('assets.field.name')} required>
          <Input value={draft.name} placeholder="GitHub" onChange={(event) => patch({ name: event.target.value })} />
        </ConsoleFormField>
        <ConsoleFormField label="Slug" hint={connector ? undefined : t('assets.field.slugHint')}>
          <Input
            value={draft.slug ?? ''}
            disabled={Boolean(connector)}
            placeholder="github"
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
        <ConsoleFormField label={t('assets.connectors.field.provider')}>
          <Input value={draft.provider} onChange={(event) => patch({ provider: event.target.value })} />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.field.color')}>
          <ColorInput value={draft.color} onChange={(color) => patch({ color })} />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.field.homepage')}>
          <Input value={draft.homepage} placeholder="https://" onChange={(event) => patch({ homepage: event.target.value })} />
        </ConsoleFormField>
        <ConsoleFormField label={t('assets.field.license')}>
          <Input value={draft.license} placeholder="MIT" onChange={(event) => patch({ license: event.target.value })} />
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

      <h3 className="pt-2 text-sm font-medium text-ink">{t('assets.connectors.section.server')}</h3>
      <ConsoleFormField label={t('assets.connectors.field.transport')} required>
        <SearchSelect
          value={draft.transport}
          searchable={false}
          allowClear={false}
          options={(['streamable_http', 'sse', 'stdio'] as McpTransport[]).map((transport) => ({
            value: transport,
            label: transportLabel(transport, locale),
          }))}
          onChange={(transport) => patch({ transport: (transport || 'streamable_http') as McpTransport })}
        />
      </ConsoleFormField>
      {stdio ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ConsoleFormField label={t('assets.connectors.field.command')} required>
            <Input value={draft.command} placeholder="npx" onChange={(event) => patch({ command: event.target.value })} />
          </ConsoleFormField>
          <ConsoleFormField label={t('assets.connectors.field.args')} hint={t('assets.connectors.field.argsHint')}>
            <ConsoleTextarea
              rows={3}
              className="font-mono text-xs"
              value={draft.args}
              placeholder={'-y\n@modelcontextprotocol/server-github'}
              onChange={(event) => patch({ args: event.target.value })}
            />
          </ConsoleFormField>
        </div>
      ) : (
        <ConsoleFormField label={t('assets.connectors.field.url')} required>
          <Input value={draft.url} placeholder="https://mcp.example.com/mcp" onChange={(event) => patch({ url: event.target.value })} />
        </ConsoleFormField>
      )}
      <ConfigRows rows={draft.config} onChange={(config) => patch({ config })} />
      <ToolRows rows={draft.tools} onChange={(tools) => patch({ tools })} />
      <ConsoleFormField label="README.md">
        <ConsoleTextarea
          rows={8}
          className="font-mono text-xs"
          value={draft.readme}
          onChange={(event) => patch({ readme: event.target.value })}
        />
      </ConsoleFormField>
    </FormDialog>
  );
}

function ConfigRows({
  rows,
  onChange,
}: {
  rows: ConnectorConfigField[];
  onChange: (rows: ConnectorConfigField[]) => void;
}) {
  const { t } = useI18n();
  const set = (index: number, next: Partial<ConnectorConfigField>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...next } : row)));
  return (
    <ConsoleFormField label={t('assets.connectors.field.config')} hint={t('assets.connectors.field.configHint')}>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <Input
              size="sm"
              className="w-48 font-mono"
              value={row.key}
              placeholder="GITHUB_TOKEN"
              onChange={(event) => set(index, { key: event.target.value })}
            />
            <Input
              size="sm"
              className="min-w-[160px] flex-1"
              value={row.description}
              placeholder={t('assets.field.description')}
              onChange={(event) => set(index, { description: event.target.value })}
            />
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
              <Checkbox
                checked={row.required}
                onCheckedChange={(checked) => set(index, { required: checked === true })}
              />
              {t('assets.connectors.field.required')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
              <Checkbox
                checked={row.secret}
                onCheckedChange={(checked) => set(index, { secret: checked === true })}
              />
              {t('assets.connectors.field.secret')}
            </label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={t('assets.action.delete')}
              onClick={() => onChange(rows.filter((_, at) => at !== index))}
            >
              <IconTrash />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...rows, { key: '', description: '', required: true, secret: true }])}
        >
          <IconPlus />
          {t('assets.connectors.field.addConfig')}
        </Button>
      </div>
    </ConsoleFormField>
  );
}

function ToolRows({ rows, onChange }: { rows: ConnectorTool[]; onChange: (rows: ConnectorTool[]) => void }) {
  const { t } = useI18n();
  const set = (index: number, next: Partial<ConnectorTool>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...next } : row)));
  return (
    <ConsoleFormField label={t('assets.connectors.field.tools')}>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              size="sm"
              className="w-48 font-mono"
              value={row.name}
              placeholder="create_issue"
              onChange={(event) => set(index, { name: event.target.value })}
            />
            <Input
              size="sm"
              className="flex-1"
              value={row.description}
              placeholder={t('assets.field.description')}
              onChange={(event) => set(index, { description: event.target.value })}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={t('assets.action.delete')}
              onClick={() => onChange(rows.filter((_, at) => at !== index))}
            >
              <IconTrash />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...rows, { name: '', description: '' }])}
        >
          <IconPlus />
          {t('assets.connectors.field.addTool')}
        </Button>
      </div>
    </ConsoleFormField>
  );
}
