import assert from 'node:assert/strict'
import test from 'node:test'

import { captureEditor, restoreEditor } from '../src/editor-recovery.mjs'
import { ProjectSession } from '../src/project-session.mjs'
import { primitiveEntity, SceneModel } from '../src/scene-model.mjs'

const ui = () => ({ workspaceId: '', projectId: '', title: '', homeTask: 'Kept request', selected: null, inspector: null })

test('recovery keeps the draft and operation identity but never restores a resource grant', () => {
  const model = new SceneModel('scene-1')
  model.edit([{ kind: 'add', id: 'box-1', entity: primitiveEntity('Kept object') }])
  const projects = new ProjectSession({}, model)
  projects.scope = { workspaceId: crypto.randomUUID(), projectId: crypto.randomUUID(), revision: 4, missing: false, lease: 'obsolete authority' }
  projects.saveIntent = { operation: 'save', key: 'scene', operationId: crypto.randomUUID(), expectedRevision: 4,
    content: model.document.content, assets: [], lease: 'obsolete authority' }
  const snapshot = JSON.parse(JSON.stringify(captureEditor(model, projects, ui())))
  assert.ok(!JSON.stringify(snapshot).includes('obsolete authority'))
  const recovered = new SceneModel('new-empty-scene')
  const session = new ProjectSession({}, recovered)
  const details = restoreEditor(snapshot, recovered, session)
  assert.equal(recovered.document.content, model.document.content)
  assert.equal(recovered.dirty, true)
  assert.equal(session.saveIntent.operationId, projects.saveIntent.operationId)
  assert.equal(session.scope.lease, null)
  assert.equal(session.saveUncertain, true)
  assert.equal(details.homeTask, 'Kept request')
})

test('foreign or malformed recovery is rejected before the current draft changes', () => {
  const model = new SceneModel('scene-1')
  const session = new ProjectSession({}, model)
  const snapshot = captureEditor(model, session, ui())
  const before = model.document.content
  for (const invalid of [
    { ...snapshot, schemaVersion: 2 },
    { ...snapshot, scope: { workspaceId: '../outside', projectId: crypto.randomUUID(), missing: true } },
    { ...snapshot, ui: { ...ui(), selected: 'missing' } },
    { ...snapshot, savedContent: new SceneModel('foreign-scene').document.content },
    { ...snapshot, ui: { ...ui(), inspector: { id: null, reviewed: 0, draft: { position: 'not a vector' } } } }
  ]) {
    assert.throws(() => restoreEditor(invalid, model, session))
    assert.equal(model.document.content, before)
    assert.equal(session.scope, null)
  }
})
