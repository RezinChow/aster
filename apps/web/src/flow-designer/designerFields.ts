import {
  createA3sFlowExpression,
  localizeA3sFlowDagManifest,
  selectA3sFlowDagNodeConfiguration,
  type A3sFlowDagNodeManifest,
  type A3sFlowDagNodeRegistry,
  type A3sFlowWorkflowDagNode,
} from '@a3s-lab/flow-ui';
import type { WorkflowNodeFieldDefinition } from '@a3s-lab/flow-ui';
import { flowNodeGroups, type FlowWebsiteLocale } from './flow-node-catalog';
import { createPlaygroundNodeCatalog } from './WorkflowPlayground.custom-nodes';

export type DesignerFieldView = {
  name: string;
  control: string;
  label: { zh: string; en: string };
  required: boolean;
};

const registries = new Map<FlowWebsiteLocale, A3sFlowDagNodeRegistry>();

export function designerRegistry(
  locale: FlowWebsiteLocale = 'en',
): A3sFlowDagNodeRegistry {
  const cached = registries.get(locale);
  if (cached) return cached;
  const registry = createPlaygroundNodeCatalog(locale).registry;
  registries.set(locale, registry);
  return registry;
}

/** Node types the designer library offers, in catalog order. */
export function designerNodeTypes(): readonly string[] {
  const custom = createPlaygroundNodeCatalog('en').custom.map(
    (entry) => entry.manifest.type,
  );
  return [...flowNodeGroups.flatMap((group) => group.types), ...custom];
}

export function designerControl(
  field: WorkflowNodeFieldDefinition,
): string {
  const declared =
    field._input_type ??
    field.control_widget ??
    field.controlWidget ??
    field.input_type ??
    field.inputType ??
    field.widget ??
    field.type;
  return typeof declared === 'string' && declared.length > 0 ? declared : 'StrInput';
}

function localizedField(
  type: string,
  fieldName: string,
  locale: FlowWebsiteLocale,
): WorkflowNodeFieldDefinition | undefined {
  const manifest = localizeA3sFlowDagManifest(
    designerRegistry(locale).require(type),
    locale,
  );
  return manifest.fields.find((field) => field.name === fieldName);
}

export function designerFieldView(
  type: string,
  fieldName: string,
): DesignerFieldView {
  const en = localizedField(type, fieldName, 'en');
  const zh = localizedField(type, fieldName, 'zh');
  if (!en) throw new Error(`Unknown field ${type}.${fieldName}`);
  return {
    name: fieldName,
    control: designerControl(en),
    label: {
      zh: zh?.display_name?.trim() || en.display_name?.trim() || fieldName,
      en: en.display_name?.trim() || fieldName,
    },
    required: en.required === true,
  };
}

export function designerFields(type: string): DesignerFieldView[] {
  return designerRegistry('en')
    .require(type)
    .fields.map((field) => designerFieldView(type, field.name));
}

/** Node types whose start reference should render as a node picker. */
const REGION_REFERENCE_TYPES: ReadonlySet<string> = new Set([
  'iteration',
  'loop',
]);

export type DesignerManifestContext = {
  /**
   * Graph-aware choices for reference fields (region `start_node_id`).
   * Presentation-only: the stored value and semantic digests are unchanged.
   */
  nodeOptions?: ReadonlyArray<{ value: string; label: string }>;
};

function applyReferenceOptions(
  type: string,
  field: WorkflowNodeFieldDefinition,
  context?: DesignerManifestContext,
): WorkflowNodeFieldDefinition {
  const nodeOptions = context?.nodeOptions;
  if (!nodeOptions || nodeOptions.length === 0) return field;
  if (!REGION_REFERENCE_TYPES.has(type) || field.name !== 'start_node_id') {
    return field;
  }
  return {
    ...field,
    _input_type: 'DropdownInput',
    options: nodeOptions.map(({ value, label }) => ({ value, label })),
  };
}

/** Manifest the inspector renders: both labels, the declared control, no help prose. */
export function presentDesignerManifest(
  type: string,
  locale: FlowWebsiteLocale = 'en',
  context?: DesignerManifestContext,
): A3sFlowDagNodeManifest {
  const manifest = localizeA3sFlowDagManifest(
    designerRegistry(locale).require(type),
    locale,
  );
  return {
    ...manifest,
    description: '',
    fields: manifest.fields.map((field) => {
      const view = designerFieldView(type, field.name);
      const label =
        view.label.zh === view.label.en
          ? view.label.en
          : `${view.label.zh} / ${view.label.en}`;
      return {
        ...field,
        display_name: label,
        info: undefined,
      };
    })
      .map((field) => applyReferenceOptions(type, field, context)),
  };
}

/** Operators `executePlaygroundGraph` already evaluates, including catalog defaults. */
const TRIAL_EXPRESSION_OPS = new Set([
  'literal',
  'field',
  'concat',
  'not',
  'and',
  'or',
  'eq',
  'ne',
  'contains',
  'in',
  'gt',
  'gte',
  'lt',
  'lte',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trialExpressionViolation(value: unknown): string | undefined {
  if (!isRecord(value) || typeof value.op !== 'string' || !TRIAL_EXPRESSION_OPS.has(value.op)) {
    return 'expected an expression';
  }
  if (value.op === 'literal') return 'value' in value ? undefined : 'expected an expression';
  if (value.op === 'field') {
    return typeof value.path === 'string' ? undefined : 'expected an expression';
  }
  if (value.op === 'not') return trialExpressionViolation(value.value);
  if (value.op === 'concat' || value.op === 'and' || value.op === 'or') {
    return Array.isArray(value.values) &&
      value.values.every((item) => trialExpressionViolation(item) === undefined)
      ? undefined
      : 'expected an expression';
  }
  return trialExpressionViolation(value.left) ?? trialExpressionViolation(value.right);
}

function optionValues(field: WorkflowNodeFieldDefinition): string[] {
  const raw = field.options ?? field.enum ?? field.choices ?? [];
  if (!Array.isArray(raw)) return [];
  const values: string[] = [];
  for (const option of raw) {
    if (typeof option === 'string' && option.length > 0) values.push(option);
    else if (isRecord(option)) {
      const value = option.value ?? option.name;
      if (typeof value === 'string' && value.length > 0) values.push(value);
    }
  }
  return values;
}

function rangeOf(field: WorkflowNodeFieldDefinition): {
  min?: number;
  max?: number;
  step?: number;
} {
  return field.range_spec ?? field.rangeSpec ?? {};
}

function isListField(field: WorkflowNodeFieldDefinition, control: string): boolean {
  return (
    field.list === true ||
    field.is_list === true ||
    control === 'MultiselectInput' ||
    control === 'SortableListInput' ||
    control === 'FileInput' ||
    control === 'ActionPickerInput'
  );
}

function isObjectControl(control: string): boolean {
  return (
    control === 'JSONInput' ||
    control === 'HandleInput' ||
    control === 'McpInput' ||
    control === 'DataDisplayInput' ||
    control === 'A3sFlowSpecInput' ||
    control === 'A3sFlowSchemaInput'
  );
}

function isRowList(field: WorkflowNodeFieldDefinition, control: string): boolean {
  return (
    field.type === 'table' ||
    control === 'A3sFlowBatchInput' ||
    control === 'A3sFlowChildrenInput'
  );
}

function configuredRows(
  field: WorkflowNodeFieldDefinition,
  current: unknown,
): unknown[] {
  const source =
    Array.isArray(current) && current.length > 0
      ? current
      : Array.isArray(field.value)
        ? field.value
        : [];
  const first = isRecord(source[0]) ? structuredClone(source[0]) : {};
  if (typeof first.step_key === 'string') first.step_key = 'configured';
  else if (typeof first.child_id === 'string') first.child_id = 'configured';
  else first.configured = true;
  return [first];
}

export function validDesignerValue(
  field: WorkflowNodeFieldDefinition,
  current: unknown,
): unknown {
  const control = designerControl(field);
  if (control === 'BoolInput' || field.type === 'bool') {
    return typeof current === 'boolean' ? !current : true;
  }
  if (control === 'IntInput' || control === 'SliderInput' || field.type === 'int' || field.type === 'slider') {
    const range = rangeOf(field);
    const step = range.step ?? (control === 'SliderInput' ? 0.01 : 1);
    const min = range.min ?? 0;
    const max = range.max ?? min + step * 10;
    const base = typeof current === 'number' && Number.isFinite(current) ? current : min;
    const next = Number((base + step).toFixed(6));
    if (next <= max && next !== base) return next;
    return min === base ? max : min;
  }
  if (control === 'DurationInput') {
    const units = optionValues(field);
    const unit = units[0] ?? 'Minutes';
    const amount = isRecord(current) && typeof current.value === 'number' ? current.value : 1;
    return { value: amount + 1, unit };
  }
  if (control === 'A3sFlowExpressionInput') {
    return createA3sFlowExpression({ op: 'field', path: 'input.configured' });
  }
  if (isRowList(field, control)) return configuredRows(field, current);
  if (isListField(field, control)) {
    const options = optionValues(field);
    return options.length > 0 ? [options[0]] : ['configured'];
  }
  const choices = optionValues(field);
  if (choices.length > 0) {
    const currentText = typeof current === 'string' ? current : '';
    return choices.find((option) => option !== currentText) ?? choices[0];
  }
  if (control === 'A3sFlowSpecInput') {
    const base = isRecord(current)
      ? structuredClone(current)
      : isRecord(field.value)
        ? structuredClone(field.value)
        : {};
    base.name = base.name === 'configured.workflow' ? 'configured.workflow.alt' : 'configured.workflow';
    return base;
  }
  if (isObjectControl(control) || field.type === 'dict') {
    if (control === 'HandleInput') return { source: 'input.configured' };
    if (control === 'McpInput') return { server: 'configured', tool: 'lookup' };
    return { configured: true };
  }
  if (typeof current === 'string') {
    return current === 'configured' ? 'configured-2' : 'configured';
  }
  return 'configured';
}

export function invalidDesignerValue(field: WorkflowNodeFieldDefinition): unknown {
  const control = designerControl(field);
  if (control === 'BoolInput' || field.type === 'bool') return 'not-a-boolean';
  if (control === 'IntInput' || control === 'SliderInput' || field.type === 'int' || field.type === 'slider') {
    return 'not-a-number';
  }
  if (control === 'DropdownInput' || control === 'ModelInput') return '__not_an_option__';
  if (control === 'DurationInput') return { value: 'nope', unit: 'Centuries' };
  if (control === 'A3sFlowExpressionInput') return { op: 'not-an-op' };
  if (isRowList(field, control)) return 'not-a-table';
  if (isListField(field, control)) return 'not-a-list';
  if (isObjectControl(control) || field.type === 'dict') return 'not-an-object';
  return 0;
}

export function designerFieldViolation(
  field: WorkflowNodeFieldDefinition,
  value: unknown,
): string | undefined {
  const control = designerControl(field);
  if (control === 'BoolInput' || field.type === 'bool') {
    return typeof value === 'boolean' ? undefined : 'expected a boolean';
  }
  if (control === 'IntInput' || control === 'SliderInput' || field.type === 'int' || field.type === 'slider') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'expected a number';
    const range = rangeOf(field);
    if (range.min != null && value < range.min) return 'below minimum';
    if (range.max != null && value > range.max) return 'above maximum';
    return undefined;
  }
  if (control === 'DurationInput') {
    const units = optionValues(field);
    if (!isRecord(value) || typeof value.value !== 'number' || !Number.isFinite(value.value) || value.value < 0) {
      return 'expected a duration';
    }
    if (typeof value.unit !== 'string' || (units.length > 0 && !units.includes(value.unit))) {
      return 'expected a duration unit';
    }
    return undefined;
  }
  if (control === 'A3sFlowExpressionInput') {
    const expression = isRecord(value) && isRecord(value.expression) ? value.expression : value;
    return trialExpressionViolation(expression);
  }
  if (isRowList(field, control)) {
    return Array.isArray(value) && value.length > 0 && value.every(isRecord)
      ? undefined
      : 'expected a table';
  }
  if (isListField(field, control)) {
    return Array.isArray(value) && value.every((item) => typeof item === 'string')
      ? undefined
      : 'expected a list';
  }
  if (isObjectControl(control) || field.type === 'dict') {
    return isRecord(value) ? undefined : 'expected an object';
  }
  const options = optionValues(field);
  if (options.length > 0) {
    return typeof value === 'string' && options.includes(value)
      ? undefined
      : 'expected one of the declared options';
  }
  if (typeof value !== 'string' || (field.required === true && value.trim().length === 0)) {
    return 'expected text';
  }
  return undefined;
}

export function designerFieldViolations(
  manifest: A3sFlowDagNodeManifest,
  value: Record<string, unknown>,
): Array<{ path: string; code: string; message: string }> {
  const issues: Array<{ path: string; code: string; message: string }> = [];
  for (const field of manifest.fields) {
    const message = designerFieldViolation(field, value[field.name]);
    if (!message) continue;
    issues.push({
      path: field.name,
      code: 'designer.field.invalid',
      message,
    });
  }
  return issues;
}

export function readDagField(
  node: A3sFlowWorkflowDagNode,
  fieldName: string,
  registry: A3sFlowDagNodeRegistry = designerRegistry(),
): unknown {
  const manifest = registry.require(node.data.type);
  return selectA3sFlowDagNodeConfiguration(node, manifest)[fieldName];
}
