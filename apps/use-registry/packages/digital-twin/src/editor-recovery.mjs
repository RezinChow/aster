import { decodeScene } from './domain.mjs'

const uuid = (value) => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value) && value !== '00000000-0000-0000-0000-000000000000'
const revision = (value) => Number.isSafeInteger(value) && value >= 0
const text = (value, limit) => typeof value === 'string' && value.length <= limit
const object = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((key) => keys.includes(key))
const invalid = () => Object.assign(new Error('recovery_invalid'), { reason: 'recovery_invalid' })

export function captureEditor(model, projects, ui) {
  const { lease: _lease, ...scope } = projects.scope ?? {}
  const { lease: _intentLease, ...saveIntent } = projects.saveIntent ?? {}
  const selected = typeof ui.selected === 'string' && Object.hasOwn(model.scene.entities, ui.selected) ? ui.selected : null
  return { schemaVersion: 1, content: model.document.content, savedContent: model.savedContent,
    scope: projects.scope ? scope : null, saveIntent: projects.saveIntent ? saveIntent : null,
    createIntent: projects.createIntent, ui: { ...ui, workspaceId: scope.workspaceId ?? ui.workspaceId,
      projectId: scope.projectId ?? ui.projectId, selected, inspector: ui.inspector?.id === selected ? ui.inspector : null } }
}

/** Validate the complete recovery record before changing any live editor state. */
export function restoreEditor(value, model, projects) {
  if (!object(value, ['schemaVersion', 'content', 'savedContent', 'scope', 'saveIntent', 'createIntent', 'ui']) || value.schemaVersion !== 1 ||
    !text(value.content, 16 * 1024 * 1024) || !text(value.savedContent, 16 * 1024 * 1024)) throw invalid()
  const current = decodeScene(value.content)
  const saved = decodeScene(value.savedContent)
  if (current.scene.id !== saved.scene.id) throw invalid()
  const { scope, saveIntent, createIntent, ui } = value
  if (scope !== null && (!object(scope, ['workspaceId', 'projectId', 'revision', 'missing']) || !uuid(scope.workspaceId) || !uuid(scope.projectId) ||
    typeof scope.missing !== 'boolean' || (!scope.missing && !revision(scope.revision)))) throw invalid()
  if (saveIntent !== null) {
    if (!scope || !object(saveIntent, ['operation', 'key', 'operationId', 'expectedRevision', 'content', 'assets']) ||
      saveIntent.operation !== 'save' || saveIntent.key !== 'scene' || !uuid(saveIntent.operationId) ||
      !(saveIntent.expectedRevision === null || revision(saveIntent.expectedRevision)) ||
      !text(saveIntent.content, 16 * 1024 * 1024) || !Array.isArray(saveIntent.assets) || saveIntent.assets.length > 64 ||
      !saveIntent.assets.every((asset) => typeof asset === 'string' && /^sha256:[a-f0-9]{64}$/.test(asset))) throw invalid()
    decodeScene(saveIntent.content)
  }
  if (createIntent !== null && (!object(createIntent, ['operation', 'workspaceId', 'id', 'title']) ||
    createIntent.operation !== 'create-project' || !uuid(createIntent.workspaceId) || !uuid(createIntent.id) ||
    !text(createIntent.title, 128) || !createIntent.title.trim() || saveIntent)) throw invalid()
  if (!object(ui, ['workspaceId', 'projectId', 'title', 'homeTask', 'selected', 'inspector']) ||
    !text(ui.workspaceId, 36) || (ui.workspaceId !== '' && !uuid(ui.workspaceId)) ||
    !text(ui.projectId, 36) || (ui.projectId !== '' && !uuid(ui.projectId)) ||
    !text(ui.title, 128) || !text(ui.homeTask, 24000) ||
    !(ui.selected === null || (typeof ui.selected === 'string' && Object.hasOwn(current.scene.entities, ui.selected)))) throw invalid()
  if (scope && (scope.workspaceId !== ui.workspaceId || scope.projectId !== ui.projectId)) throw invalid()
  if (ui.inspector !== null) {
    const draft = ui.inspector?.draft
    if (!object(ui.inspector, ['id', 'reviewed', 'draft']) || ui.inspector.id !== ui.selected || !revision(ui.inspector.reviewed) ||
      !object(draft, ['name', 'position', 'rotation', 'scale', 'motion', 'mass', 'friction']) ||
      !['static', 'dynamic', 'kinematic'].includes(draft.motion) || !['name', 'mass', 'friction'].every((key) => text(draft[key], 4096)) ||
      !['position', 'rotation', 'scale'].every((key) => Array.isArray(draft[key]) && draft[key].length === 3 && draft[key].every((field) => text(field, 4096)))) throw invalid()
  }
  model.restore(current.content, saved.content)
  projects.scope = scope ? { ...scope, lease: null } : null
  projects.saveIntent = saveIntent ? { ...saveIntent, lease: null } : null
  projects.createIntent = createIntent
  projects.saveUncertain = !!saveIntent
  projects.createUncertain = !!createIntent
  return ui
}
