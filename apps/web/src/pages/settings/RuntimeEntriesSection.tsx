import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Badge, Button, ConsoleTextarea, cn, useToast } from '@a3s-lab/ui';
import { IconRotateCcw } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import {
  getRuntimeBuiltins,
  putConfig,
  type CatalogGroup,
  type CatalogItem,
  type ValueSchema,
} from '@/lib/configApi';
import {
  draftFrom,
  fieldVisible,
  parseDraft,
  type Draft,
  type SchemaIssues,
} from '@/lib/configSchema';
import {
  ERROR_TEXT,
  FieldRow,
  SubHead,
  type Translate,
} from '@/pages/settings/configFields';
import { ConfigIcon, groupIcon } from '@/pages/settings/configIcons';
import {
  ConfigToolbar,
  EmptyNote,
  GroupCard,
  ListSkeleton,
  RowAction,
  SectionChips,
  fill,
  sectionAnchor,
} from '@/pages/settings/configKit';


const UPDATED_BY = 'console';

function itemId(item: CatalogItem) {
  return `${item.namespace ?? ''}:${item.key}`;
}

function ItemHead({
  t,
  item,
  labelFor,
  dirty,
  onReset,
}: {
  t: Translate;
  item: CatalogItem;
  labelFor?: string;
  dirty: boolean;
  onReset: () => void;
}) {
  const Title = labelFor ? 'label' : 'span';
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex min-h-6 flex-wrap items-center gap-1.5">
        <Title htmlFor={labelFor} className="text-[13px] font-medium text-ink">
          {item.label}
        </Title>
        {dirty ? (
          <>
            <Badge tone="warn">{t('settings.runtime.unsaved')}</Badge>
            <RowAction label={t('settings.runtime.undo')} onClick={onReset}>
              <IconRotateCcw strokeWidth={1.7} />
            </RowAction>
          </>
        ) : null}
      </div>
      {item.description ? (
        <p className="text-[12px] leading-5 text-ink-faint">{item.description}</p>
      ) : null}
      <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] leading-5 text-ink-faint">
        <code className="font-mono text-ink-muted">{item.key}</code>
        {item.configured === false ? (
          <span>· {t('settings.catalog.default')}</span>
        ) : item.updated_by ? (
          <span>
            · {fill(t('settings.runtime.lastUpdated'), { who: item.updated_by })}
            {item.revision != null ? ` · ${t('settings.catalog.revision')} ${item.revision}` : ''}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function SettingRow({
  t,
  item,
  schema,
  draft,
  issues,
  error,
  dirty,
  reveal,
  onChange,
  onReset,
}: {
  t: Translate;
  item: CatalogItem;
  schema: ValueSchema;
  draft: Draft;
  issues: SchemaIssues;
  error?: string;
  dirty: boolean;
  reveal: boolean;
  onChange: (next: Draft) => void;
  onReset: () => void;
}) {
  const head = (labelFor?: string) => (
    <ItemHead t={t} item={item} labelFor={labelFor} dirty={dirty} onReset={onReset} />
  );

  let body: ReactNode;
  if (schema.type !== 'object') {
    body = (
      <FieldRow
        t={t}
        head={head}
        label={item.label}
        schema={schema}
        draft={draft}
        issue={issues['']}
        reveal={reveal}
        onChange={onChange}
      />
    );
  } else {
    const record = (draft ?? {}) as Record<string, Draft>;
    const [first, ...rest] = schema.fields;
    const leads = first?.schema.type === 'boolean';
    const nested = (leads ? rest : schema.fields).filter((field) => fieldVisible(field, record));
    const set = (name: string) => (next: Draft) => onChange({ ...record, [name]: next });
    body = (
      <>
        {leads ? (
          <FieldRow
            t={t}
            head={head}
            label={first.label}
            schema={first.schema}
            draft={record[first.name] ?? null}
            issue={issues[first.name]}
            reveal={reveal}
            onChange={set(first.name)}
          />
        ) : (
          head()
        )}
        {nested.length > 0 ? (
          <div className="mt-4 flex flex-col gap-4">
            {nested.map((field) => (
              <FieldRow
                key={field.name}
                t={t}
                head={(id) => (
                  <SubHead
                    t={t}
                    id={id}
                    label={field.label}
                    description={field.description}
                    required={!!field.required_when && record[field.required_when] === true}
                  />
                )}
                label={field.label}
                schema={field.schema}
                draft={record[field.name] ?? null}
                issue={issues[field.name]}
                reveal={reveal}
                onChange={set(field.name)}
              />
            ))}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <li id={`setting-${itemId(item)}`} className="scroll-mt-16 px-4 py-4">
      {body}
      {error ? (
        <p className={cn(ERROR_TEXT, 'mt-3 flex items-start gap-1')} role="alert">
          <ConfigIcon name="alert" size={13} className="mt-[3px] shrink-0" />
          {error}
        </p>
      ) : null}
    </li>
  );
}

/** Items without a declared schema keep a raw JSON editor that saves on its own. */
function JsonRow({
  t,
  item,
  onSave,
}: {
  t: Translate;
  item: CatalogItem;
  onSave: (value: unknown) => Promise<void>;
}) {
  const initial = JSON.stringify(item.value, null, 2) ?? '';
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = text !== initial;
  async function save() {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      setError(t('settings.entries.invalidJson'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }
  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <ItemHead t={t} item={item} dirty={false} onReset={() => setText(initial)} />
      <ConsoleTextarea
        className="font-mono text-[12px]"
        rows={6}
        value={text}
        aria-label={t('settings.entries.value')}
        placeholder={t('settings.entries.valuePlaceholder')}
        onChange={(event) => setText(event.target.value)}
      />
      {error ? (
        <p className={ERROR_TEXT} role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!dirty || saving}
          onClick={() => {
            setText(initial);
            setError(null);
          }}
        >
          {t('settings.actions.reset')}
        </Button>
        <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? t('settings.actions.saving') : t('settings.actions.save')}
        </Button>
      </div>
    </li>
  );
}

function matchesQuery(item: CatalogItem, query: string) {
  if (!query) return true;
  const fields =
    item.schema?.type === 'object' ? item.schema.fields.map((field) => field.label) : [];
  return [item.key, item.label, item.description, ...fields]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

/**
 * Runtime builtins as settings rows. Edits stay local until the save bar commits them,
 * so a change to several values lands together and can be discarded as one.
 */
export function RuntimeEntriesSection() {
  const { t } = useI18n();
  const toast = useToast();
  const [groups, setGroups] = useState<CatalogGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [showIssues, setShowIssues] = useState(false);
  const [saving, setSaving] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      setGroups(await getRuntimeBuiltins());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const items = groups.flatMap((group) => group.items);
  const edits = items.flatMap((item) => {
    const id = itemId(item);
    if (!item.schema || !(id in drafts)) return [];
    const baseline = JSON.stringify(draftFrom(item.schema, item.value));
    if (JSON.stringify(drafts[id]) === baseline) return [];
    const parsed = parseDraft(item.schema, drafts[id], item.value);
    return [{ id, item, parsed }];
  });
  const dirtyIds = new Set(edits.map((edit) => edit.id));
  const invalid = edits.filter((edit) => Object.keys(edit.parsed.issues).length > 0);

  useEffect(() => {
    if (edits.length === 0) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [edits.length]);

  function discard() {
    setDrafts({});
    setItemErrors({});
    setShowIssues(false);
  }

  async function saveAll() {
    if (invalid.length > 0) {
      setShowIssues(true);
      document
        .getElementById(`setting-${invalid[0].id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSaving(true);
    const failed: Record<string, string> = {};
    const saved: string[] = [];
    for (const { id, item, parsed } of edits) {
      try {
        await putConfig(item.namespace!, item.key, { value: parsed.value, updated_by: UPDATED_BY });
        saved.push(id);
      } catch (err) {
        failed[id] = err instanceof Error ? err.message : String(err);
      }
    }
    setDrafts((current) => {
      const next = { ...current };
      saved.forEach((id) => delete next[id]);
      return next;
    });
    setItemErrors(failed);
    setShowIssues(false);
    setSaving(false);
    const failures = Object.keys(failed).length;
    toast.push(
      failures > 0
        ? { title: fill(t('settings.runtime.saveFailed'), { n: failures }), tone: 'danger' }
        : { title: fill(t('settings.runtime.savedCount'), { n: saved.length }), tone: 'success' },
    );
    await reload();
  }

  async function saveJson(item: CatalogItem, value: unknown) {
    if (!item.namespace) return;
    await putConfig(item.namespace, item.key, { value, updated_by: UPDATED_BY });
    toast.push({ title: `${item.label} · ${t('settings.runtime.saved')}`, tone: 'success' });
    await reload();
  }

  const needle = query.trim().toLowerCase();
  const visible = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => matchesQuery(item, needle)) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-0 z-10 -mx-1 bg-bg-elevated px-1 py-2">
        <ConfigToolbar
          leading={
            <SectionChips
              label={t('settings.runtime.sections')}
              sections={visible.map((group) => ({
                anchor: sectionAnchor('runtime', group.id),
                label: group.label,
                icon: groupIcon(group.id),
              }))}
            />
          }
          query={query}
          onQuery={setQuery}
          searchLabel={t('settings.runtime.search')}
          refreshLabel={t('settings.entries.refresh')}
          refreshing={loading}
          onRefresh={() => reload()}
        />
      </div>
      {error ? (
        <Alert tone="danger">
          <p className="break-all">{error}</p>
        </Alert>
      ) : null}
      {loading && groups.length === 0 ? (
        <ListSkeleton rows={3} />
      ) : groups.length === 0 ? (
        <EmptyNote>{t('settings.entries.empty')}</EmptyNote>
      ) : visible.length === 0 ? (
        <EmptyNote>{t('settings.runtime.noMatch')}</EmptyNote>
      ) : (
        visible.map((group) => (
          <GroupCard
            key={group.id}
            anchor={sectionAnchor('runtime', group.id)}
            title={group.label}
            icon={groupIcon(group.id)}
          >
            {group.items.map((item) => {
              const id = itemId(item);
              if (!item.schema) {
                return <JsonRow key={id} t={t} item={item} onSave={(value) => saveJson(item, value)} />;
              }
              const schema = item.schema;
              const draft = id in drafts ? drafts[id] : draftFrom(schema, item.value);
              const dirty = dirtyIds.has(id);
              const issues = dirty ? parseDraft(schema, draft, item.value).issues : {};
              return (
                <SettingRow
                  key={id}
                  t={t}
                  item={item}
                  schema={schema}
                  draft={draft}
                  issues={issues}
                  error={itemErrors[id]}
                  dirty={dirty}
                  reveal={showIssues}
                  onChange={(next) => {
                    setDrafts((current) => ({ ...current, [id]: next }));
                    setItemErrors(({ [id]: _drop, ...rest }) => rest);
                  }}
                  onReset={() => {
                    setDrafts(({ [id]: _drop, ...rest }) => rest);
                    setItemErrors(({ [id]: _drop, ...rest }) => rest);
                  }}
                />
              );
            })}
          </GroupCard>
        ))
      )}
      {edits.length > 0 ? (
        <div
          role="region"
          aria-label={t('settings.runtime.saveBar')}
          className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border-[0.5px] border-border bg-bg-elevated px-4 py-2.5 shadow-[var(--shadow-elevated)]"
        >
          <div className="flex flex-col">
            <span className="text-[13px] font-medium text-ink">
              {fill(t('settings.runtime.pending'), { n: edits.length })}
            </span>
            {showIssues && invalid.length > 0 ? (
              <span className={cn(ERROR_TEXT, 'flex items-center gap-1')}>
                <ConfigIcon name="alert" size={13} />
                {fill(t('settings.runtime.invalidCount'), { n: invalid.length })}
              </span>
            ) : (
              <span className="text-[12px] text-ink-faint">
                {edits.map((edit) => edit.item.label).join('、')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={discard}>
              {t('settings.runtime.discard')}
            </Button>
            <Button type="button" size="sm" loading={saving} onClick={() => void saveAll()}>
              {t('settings.runtime.saveAll')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
