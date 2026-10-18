import { useEffect, useState, type ReactNode } from 'react';
import {
  Button,
  ConsoleEmptyState,
  ConsoleFormField,
  FormDialog,
  Input,
  PopConfirm,
  SearchSelect,
} from '@a3s-lab/ui';
import { IconEdit, IconPlus, IconTrash } from '@/components/UiIcons';
import {
  RELAY_METHODS,
  RELAY_PROTOCOL_PRESETS,
  RELAY_SERVICE_CLASSES,
  collapseRelayInterfaceSlots,
  isRelayInterfacePath,
  isRelayProtocolId,
  relayInterfaceSlot,
  suggestedRelayPath,
  type RelayInterface,
  type RelayMethod,
  type RelayOperation,
  type RelayService,
  type RelayServiceClass,
} from '@/data/relayServices';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { RelayModelsPanel } from '@/pages/modelService/RelayModelsPanel';

const CLASS_KEYS: Record<RelayServiceClass, MessageKey> = {
  model: 'suppliers.relay.class.model',
  api: 'suppliers.relay.class.api',
  mcp: 'suppliers.relay.class.mcp',
};

const CLASS_HINTS: Record<RelayServiceClass, MessageKey> = {
  model: 'suppliers.relay.class.modelHint',
  api: 'suppliers.relay.class.apiHint',
  mcp: 'suppliers.relay.class.mcpHint',
};

const LABEL_KEYS: Record<string, MessageKey> = {
  chat: 'suppliers.relay.iface.chat',
  messages: 'suppliers.relay.iface.messages',
  generate: 'suppliers.relay.iface.generate',
  embeddings: 'suppliers.relay.iface.embeddings',
  rerank: 'suppliers.relay.iface.rerank',
  search: 'suppliers.relay.group.search',
  finance: 'suppliers.relay.group.finance',
  scholar: 'suppliers.relay.group.scholar',
  social: 'suppliers.relay.group.social',
  prediction: 'suppliers.relay.group.prediction',
};

function labelOf(name: string, t: (key: MessageKey) => string): string {
  const key = LABEL_KEYS[name];
  return key ? t(key) : name;
}

function commitLabel(previous: string, typed: string, t: (key: MessageKey) => string): string {
  if (typed === labelOf(previous, t)) return previous;
  for (const [key, message] of Object.entries(LABEL_KEYS)) {
    if (t(message) === typed) return key;
  }
  return typed;
}

function nextId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function defaultInterfaceName(protocol: string): string {
  if (protocol === 'anthropic') return 'messages';
  if (protocol === 'gemini') return 'generate';
  return 'chat';
}

function blankService(serviceClass: RelayServiceClass): RelayService {
  if (serviceClass === 'model') {
    return { id: nextId('svc'), class: 'model', name: 'model', interfaces: [] };
  }
  if (serviceClass === 'api') {
    return { id: nextId('svc'), class: 'api', name: 'api', groups: [] };
  }
  return { id: nextId('svc'), class: 'mcp', name: 'mcp', path: '/mcp' };
}

const dialogField = 'h-9 rounded-[8px] bg-[var(--spec-field)] px-3 text-[13px] text-ink';

type InterfaceDraft = {
  id?: string;
  name: string;
  protocol: string;
  method: RelayMethod;
  path: string;
};

type OperationDraft = {
  groupId: string;
  id?: string;
  name: string;
  method: RelayMethod;
  path: string;
};

/** Every class is a section on one page. A call method belongs to models. */
export function RelayServicesPanel({
  services,
  onChange,
  partnerNames,
}: {
  services: RelayService[];
  onChange: (services: RelayService[]) => void;
  partnerNames: readonly string[];
}) {
  const { t } = useI18n();
  const present = RELAY_SERVICE_CLASSES.flatMap((serviceClass) => {
    const service = services.find((item) => item.class === serviceClass);
    return service ? [service] : [];
  });
  const missing = RELAY_SERVICE_CLASSES.filter(
    (serviceClass) => !services.some((service) => service.class === serviceClass),
  );
  const canRemove = services.length > 1;
  const replace = (next: RelayService) => {
    onChange(services.map((service) => (service.class === next.class ? next : service)));
  };
  const removeClass = (serviceClass: RelayServiceClass) => {
    onChange(services.filter((service) => service.class !== serviceClass));
  };
  const addClass = (serviceClass: RelayServiceClass) => {
    onChange([...services, blankService(serviceClass)]);
  };

  return (
    <div>
      {present.length === 0 ? (
        <ConsoleEmptyState title={t('suppliers.relay.empty')} description={t('suppliers.relay.emptyBody')} />
      ) : null}
      {present.map((service) => {
        if (service.class === 'model') {
          return (
            <ModelServiceEditor
              key={service.id}
              service={service}
              onChange={replace}
              onRemove={() => removeClass('model')}
              canRemove={canRemove}
              partnerNames={partnerNames}
            />
          );
        }
        if (service.class === 'api') {
          return (
            <ApiServiceEditor
              key={service.id}
              service={service}
              onChange={replace}
              onRemove={() => removeClass('api')}
              canRemove={canRemove}
            />
          );
        }
        return (
          <McpServiceEditor
            key={service.id}
            service={service}
            onChange={replace}
            onRemove={() => removeClass('mcp')}
            canRemove={canRemove}
          />
        );
      })}
      {missing.length > 0 ? (
        <div className={present.length > 0 ? 'mt-8 flex flex-wrap gap-2 border-t border-[var(--spec-hairline)] pt-6' : 'mt-6 flex flex-wrap gap-2'}>
          {missing.map((serviceClass) => (
            <Button key={serviceClass} type="button" size="sm" variant="outline" onClick={() => addClass(serviceClass)}>
              <IconPlus />
              {t('suppliers.relay.addClass').replace('{name}', t(CLASS_KEYS[serviceClass]))}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CapabilitySection({
  title,
  hint,
  actions,
  children,
}: {
  title: string;
  hint: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-[var(--spec-hairline)] pt-8 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-[15px] font-medium text-ink">{title}</h2>
          <p className="max-w-2xl text-[13px] leading-5 text-[var(--spec-segment-rest)]">{hint}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function ModelServiceEditor({
  service,
  onChange,
  onRemove,
  canRemove,
  partnerNames,
}: {
  service: RelayService;
  onChange: (service: RelayService) => void;
  onRemove: () => void;
  canRemove: boolean;
  partnerNames: readonly string[];
}) {
  const { t } = useI18n();
  const interfaces = service.interfaces ?? [];
  const [draft, setDraft] = useState<InterfaceDraft | null>(null);
  useEffect(() => {
    const next = collapseRelayInterfaceSlots(interfaces);
    if (next === interfaces) return;
    onChange({ ...service, interfaces: next });
  }, [interfaces, onChange, service]);

  const protocol = draft?.protocol.trim().toLowerCase() ?? '';
  const path = draft?.path.trim() ?? '';
  const slotTaken = Boolean(
    draft &&
      isRelayProtocolId(protocol) &&
      interfaces.some(
        (row) =>
          row.id !== draft.id &&
          relayInterfaceSlot(row.protocol, row.method, row.path) === relayInterfaceSlot(protocol, draft.method, path),
      ),
  );
  const pathInvalid = Boolean(path && !isRelayInterfacePath(path));
  const protocolInvalid = Boolean(draft && protocol && !isRelayProtocolId(protocol));

  const applyPreset = (preset: string) => {
    if (!draft) return;
    const previousPath = suggestedRelayPath(draft.protocol);
    const pathUntouched = !draft.path.trim() || draft.path.trim() === previousPath;
    const nameUntouched = !draft.name.trim() || draft.name === defaultInterfaceName(draft.protocol);
    setDraft({
      ...draft,
      protocol: preset,
      method: 'POST',
      path: pathUntouched ? suggestedRelayPath(preset) : draft.path,
      name: nameUntouched ? defaultInterfaceName(preset) : draft.name,
    });
  };

  const commit = () => {
    if (!draft || !isRelayProtocolId(protocol) || pathInvalid || slotTaken) return;
    const next: RelayInterface = {
      id: draft.id || nextId('if'),
      protocol,
      name: (draft.name.trim() || defaultInterfaceName(protocol)).slice(0, 64),
      method: draft.method,
      path,
    };
    const exists = interfaces.some((row) => row.id === next.id);
    onChange({
      ...service,
      interfaces: exists ? interfaces.map((row) => (row.id === next.id ? next : row)) : [...interfaces, next],
    });
    setDraft(null);
  };

  return (
    <CapabilitySection
      title={t('suppliers.relay.class.model')}
      hint={t('suppliers.relay.class.modelHint')}
      actions={
        <>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setDraft({ name: '', protocol: '', method: 'POST', path: '' })}
          >
            <IconPlus />
            {t('suppliers.relay.interface.add')}
          </Button>
          {canRemove ? <RemoveClass onRemove={onRemove} /> : null}
        </>
      }
    >
      <div className="space-y-1">
        <p className="text-[12px] text-[var(--spec-muted)]">{t('suppliers.relay.interfaces')}</p>
        {interfaces.length === 0 ? (
          <p className="text-[13px] text-ink-muted">{t('suppliers.relay.endpointEmpty')}</p>
        ) : (
          <ul>
            {interfaces.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1">
                <span className="text-[13px] text-ink">{labelOf(row.name, t)}</span>
                <span className="font-mono text-[12px] text-[var(--spec-segment-rest)]">{row.protocol}</span>
                <span className="text-[12px] text-[var(--spec-muted)]">{row.method}</span>
                <span className="min-w-0 font-mono text-[12px] text-[var(--spec-muted)]">{row.path || '—'}</span>
                <span className="ml-auto flex shrink-0">
                  <Button type="button" size="sm" variant="ghost" aria-label={t('suppliers.relay.interface.edit')} onClick={() => setDraft(row)}>
                    <IconEdit />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={t('suppliers.relay.remove')}
                    onClick={() =>
                      onChange({ ...service, interfaces: interfaces.filter((item) => item.id !== row.id) })
                    }
                  >
                    <IconTrash />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-ink">{t('suppliers.relay.members')}</h3>
        <RelayModelsPanel partnerNames={partnerNames} />
      </div>
      <FormDialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
        title={draft?.id ? t('suppliers.relay.interface.edit') : t('suppliers.relay.interface.add')}
        description={t('suppliers.relay.class.modelHint')}
        cancelLabel={t('suppliers.config.confirmCancel')}
        submitLabel={draft?.id ? t('suppliers.cta.save') : t('suppliers.detail.wiresSubmit')}
        submitDisabled={!draft || !isRelayProtocolId(protocol) || pathInvalid || slotTaken}
        onSubmit={(event) => {
          event.preventDefault();
          commit();
        }}
      >
        {draft ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs text-ink-muted">{t('suppliers.relay.suggest')}</p>
              <div className="flex flex-wrap gap-1.5">
                {RELAY_PROTOCOL_PRESETS.map((preset) => (
                  <Button key={preset} type="button" size="sm" variant="outline" onClick={() => applyPreset(preset)}>
                    {t(`suppliers.relay.preset.${preset}` as MessageKey)}
                  </Button>
                ))}
              </div>
            </div>
            <ConsoleFormField label={t('suppliers.relay.name')}>
              <Input
                value={labelOf(draft.name, t)}
                onChange={(event) =>
                  setDraft({ ...draft, name: commitLabel(draft.name, event.target.value, t) })
                }
                aria-label={t('suppliers.relay.name')}
                className={dialogField}
              />
            </ConsoleFormField>
            <ConsoleFormField
              label={t('suppliers.relay.protocol')}
              required
              hint={
                protocolInvalid
                  ? t('suppliers.relay.protocolInvalid')
                  : slotTaken
                    ? t('suppliers.relay.duplicate')
                    : undefined
              }
            >
              <Input
                value={draft.protocol}
                onChange={(event) => setDraft({ ...draft, protocol: event.target.value })}
                placeholder={t('suppliers.relay.protocolPlaceholder')}
                aria-label={t('suppliers.relay.protocol')}
                className={`${dialogField} font-mono`}
              />
            </ConsoleFormField>
            <ConsoleFormField label={t('suppliers.relay.method')}>
              <MethodSelect value={draft.method} onChange={(method) => setDraft({ ...draft, method })} />
            </ConsoleFormField>
            <ConsoleFormField
              label={t('suppliers.relay.path')}
              hint={pathInvalid ? t('suppliers.relay.pathInvalid') : t('suppliers.relay.mcpHint')}
            >
              <Input
                value={draft.path}
                onChange={(event) => setDraft({ ...draft, path: event.target.value })}
                aria-label={t('suppliers.relay.path')}
                className={`${dialogField} font-mono`}
              />
            </ConsoleFormField>
          </div>
        ) : null}
      </FormDialog>
    </CapabilitySection>
  );
}

function ApiServiceEditor({
  service,
  onChange,
  onRemove,
  canRemove,
}: {
  service: RelayService;
  onChange: (service: RelayService) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { t } = useI18n();
  const groups = service.groups ?? [];
  const [groupDraft, setGroupDraft] = useState<{ id?: string; name: string } | null>(null);
  const [operationDraft, setOperationDraft] = useState<OperationDraft | null>(null);

  const groupNameTaken = Boolean(
    groupDraft &&
      groupDraft.name.trim() &&
      groups.some(
        (group) =>
          group.id !== groupDraft.id && group.name.trim().toLowerCase() === groupDraft.name.trim().toLowerCase(),
      ),
  );
  const operationPath = operationDraft?.path.trim() ?? '';
  const operationPathInvalid = Boolean(operationPath && !isRelayInterfacePath(operationPath));

  const commitGroup = () => {
    if (!groupDraft) return;
    const name = groupDraft.name.trim().slice(0, 64);
    if (!name || groupNameTaken) return;
    if (groupDraft.id) {
      onChange({
        ...service,
        groups: groups.map((group) => (group.id === groupDraft.id ? { ...group, name } : group)),
      });
    } else {
      onChange({
        ...service,
        groups: [...groups, { id: nextId('grp'), name, operations: [] }],
      });
    }
    setGroupDraft(null);
  };

  const commitOperation = () => {
    if (!operationDraft) return;
    const name = operationDraft.name.trim().slice(0, 64);
    if (!name || !isRelayInterfacePath(operationPath)) return;
    const next: RelayOperation = {
      id: operationDraft.id || nextId('op'),
      name,
      method: operationDraft.method,
      path: operationPath,
    };
    onChange({
      ...service,
      groups: groups.map((group) => {
        if (group.id !== operationDraft.groupId) return group;
        const exists = group.operations.some((row) => row.id === next.id);
        return {
          ...group,
          operations: exists
            ? group.operations.map((row) => (row.id === next.id ? next : row))
            : [...group.operations, next],
        };
      }),
    });
    setOperationDraft(null);
  };

  return (
    <CapabilitySection
      title={t('suppliers.relay.class.api')}
      hint={t('suppliers.relay.class.apiHint')}
      actions={
        <>
          <Button type="button" size="sm" variant="outline" onClick={() => setGroupDraft({ name: '' })}>
            <IconPlus />
            {t('suppliers.relay.group.add')}
          </Button>
          {canRemove ? <RemoveClass onRemove={onRemove} /> : null}
        </>
      }
    >
      {groups.length === 0 ? <ConsoleEmptyState title={t('suppliers.relay.group.empty')} /> : null}
      {groups.map((group) => (
        <section key={group.id} className="rounded-[8px] border border-[var(--spec-hairline)]">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <h3 className="text-sm font-medium text-ink">{labelOf(group.name, t) || t('suppliers.relay.group.empty')}</h3>
            <div className="ml-auto flex items-center">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setOperationDraft({ groupId: group.id, name: '', method: 'GET', path: '' })}
              >
                <IconPlus />
                {t('suppliers.relay.operation.add')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={t('suppliers.relay.group.edit')}
                onClick={() => setGroupDraft({ id: group.id, name: group.name })}
              >
                <IconEdit />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={t('suppliers.relay.remove')}
                onClick={() => onChange({ ...service, groups: groups.filter((item) => item.id !== group.id) })}
              >
                <IconTrash />
              </Button>
            </div>
          </div>
          {group.operations.length === 0 ? (
            <p className="px-3 pb-3 text-xs text-ink-muted">{t('suppliers.relay.operation.empty')}</p>
          ) : (
            <ul className="border-t border-[var(--spec-hairline)]">
              {group.operations.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <span className="text-sm text-ink">{row.name}</span>
                  <span className="text-xs text-ink-muted">{row.method}</span>
                  <span className="min-w-0 font-mono text-[13px] text-ink-muted">{row.path}</span>
                  <span className="ml-auto flex shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={t('suppliers.relay.operation.edit')}
                      onClick={() =>
                        setOperationDraft({
                          groupId: group.id,
                          id: row.id,
                          name: row.name,
                          method: row.method,
                          path: row.path,
                        })
                      }
                    >
                      <IconEdit />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={t('suppliers.relay.remove')}
                      onClick={() =>
                        onChange({
                          ...service,
                          groups: groups.map((item) =>
                            item.id === group.id
                              ? { ...item, operations: item.operations.filter((op) => op.id !== row.id) }
                              : item,
                          ),
                        })
                      }
                    >
                      <IconTrash />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <FormDialog
        open={groupDraft !== null}
        onOpenChange={(open) => {
          if (!open) setGroupDraft(null);
        }}
        title={groupDraft?.id ? t('suppliers.relay.group.edit') : t('suppliers.relay.group.create')}
        cancelLabel={t('suppliers.config.confirmCancel')}
        submitLabel={groupDraft?.id ? t('suppliers.cta.save') : t('suppliers.detail.wiresSubmit')}
        submitDisabled={!groupDraft?.name.trim() || groupNameTaken}
        onSubmit={(event) => {
          event.preventDefault();
          commitGroup();
        }}
      >
        {groupDraft ? (
          <ConsoleFormField label={t('suppliers.relay.name')} required hint={groupNameTaken ? t('suppliers.relay.groupTaken') : undefined}>
            <Input
              value={labelOf(groupDraft.name, t)}
              onChange={(event) =>
                setGroupDraft({ ...groupDraft, name: commitLabel(groupDraft.name, event.target.value, t) })
              }
              aria-label={t('suppliers.relay.name')}
              className={dialogField}
            />
          </ConsoleFormField>
        ) : null}
      </FormDialog>
      <FormDialog
        open={operationDraft !== null}
        onOpenChange={(open) => {
          if (!open) setOperationDraft(null);
        }}
        title={operationDraft?.id ? t('suppliers.relay.operation.edit') : t('suppliers.relay.operation.create')}
        description={t('suppliers.relay.class.apiHint')}
        cancelLabel={t('suppliers.config.confirmCancel')}
        submitLabel={operationDraft?.id ? t('suppliers.cta.save') : t('suppliers.detail.wiresSubmit')}
        submitDisabled={!operationDraft?.name.trim() || !isRelayInterfacePath(operationPath)}
        onSubmit={(event) => {
          event.preventDefault();
          commitOperation();
        }}
      >
        {operationDraft ? (
          <div className="space-y-3">
            <ConsoleFormField label={t('suppliers.relay.name')} required>
              <Input
                value={operationDraft.name}
                onChange={(event) => setOperationDraft({ ...operationDraft, name: event.target.value })}
                aria-label={t('suppliers.relay.name')}
                className={dialogField}
              />
            </ConsoleFormField>
            <ConsoleFormField label={t('suppliers.relay.method')}>
              <MethodSelect
                value={operationDraft.method}
                onChange={(method) => setOperationDraft({ ...operationDraft, method })}
              />
            </ConsoleFormField>
            <ConsoleFormField
              label={t('suppliers.relay.path')}
              required
              hint={operationPathInvalid ? t('suppliers.relay.pathInvalid') : t('suppliers.relay.mcpHint')}
            >
              <Input
                value={operationDraft.path}
                onChange={(event) => setOperationDraft({ ...operationDraft, path: event.target.value })}
                aria-label={t('suppliers.relay.path')}
                className={`${dialogField} font-mono`}
              />
            </ConsoleFormField>
          </div>
        ) : null}
      </FormDialog>
    </CapabilitySection>
  );
}

function McpServiceEditor({
  service,
  onChange,
  onRemove,
  canRemove,
}: {
  service: RelayService;
  onChange: (service: RelayService) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { t } = useI18n();
  const path = service.path ?? '';
  const invalid = Boolean(path.trim() && !isRelayInterfacePath(path));
  return (
    <CapabilitySection
      title={t('suppliers.relay.class.mcp')}
      hint={t(CLASS_HINTS.mcp)}
      actions={canRemove ? <RemoveClass onRemove={onRemove} /> : undefined}
    >
      <ConsoleFormField label={t('suppliers.relay.path')} hint={invalid ? t('suppliers.relay.pathInvalid') : t('suppliers.relay.mcpHint')} className="max-w-xl">
        <Input
          value={path}
          onChange={(event) => onChange({ ...service, path: event.target.value })}
          aria-label={t('suppliers.relay.path')}
          className="font-mono"
        />
      </ConsoleFormField>
    </CapabilitySection>
  );
}

function RemoveClass({ onRemove }: { onRemove: () => void }) {
  const { t } = useI18n();
  return (
    <PopConfirm
      title={t('suppliers.relay.removeClass')}
      description={t('suppliers.relay.removeClassBody')}
      confirmLabel={t('suppliers.detail.confirmRemove')}
      cancelLabel={t('suppliers.config.confirmCancel')}
      onConfirm={onRemove}
    >
      <Button type="button" size="sm" variant="ghost">
        {t('suppliers.relay.removeClass')}
      </Button>
    </PopConfirm>
  );
}

const RELAY_METHOD_OPTIONS = RELAY_METHODS.map((method) => ({ value: method, label: method }));

function MethodSelect({
  value,
  onChange,
}: {
  value: RelayMethod;
  onChange: (method: RelayMethod) => void;
}) {
  const { t } = useI18n();
  return (
    <SearchSelect
      searchable={false}
      allowClear={false}
      value={value}
      aria-label={t('suppliers.relay.method')}
      options={RELAY_METHOD_OPTIONS}
      onChange={(next) => {
        if ((RELAY_METHODS as readonly string[]).includes(next)) onChange(next as RelayMethod);
      }}
    />
  );
}
