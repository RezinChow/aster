import assert from 'node:assert/strict'
import test from 'node:test'

import { primitiveEntity, SceneModel } from '../src/scene-model.mjs'

test('failed edits preserve the scene and do not poison the next undo or redo', () => {
  const model = new SceneModel('scene-1')
  model.edit([{ kind: 'add', id: 'box-1', entity: primitiveEntity('Box') }])
  const before = model.document.content
  assert.throws(() => model.edit([{ kind: 'remove', id: 'missing' }]))
  assert.equal(model.document.content, before)
  model.undo()
  assert.deepEqual(model.scene.entities, {})
  model.redo()
  assert.equal(model.scene.entities['box-1'].name, 'Box')
  assert.equal(model.scene.revision, 3)
})

test('a delayed save cannot clear edits made after its submitted snapshot', () => {
  const model = new SceneModel('scene-1')
  model.edit([{ kind: 'add', id: 'box-1', entity: primitiveEntity('Box') }])
  const submitted = model.document.content
  model.edit([{ kind: 'add', id: 'box-2', entity: primitiveEntity('Second box') }])
  model.saved(submitted)
  assert.equal(model.dirty, true)
  assert.equal(Object.keys(model.scene.entities).length, 2)
  model.saved(model.document.content)
  assert.equal(model.dirty, false)
})

test('an invalid loaded document preserves the safe draft and its history', () => {
  const model = new SceneModel('scene-1')
  model.edit([{ kind: 'add', id: 'box-1', entity: primitiveEntity('Box') }])
  const before = model.document.content
  assert.throws(() => model.load('scene "bad" { unit = "cm" }'))
  assert.equal(model.document.content, before)
  assert.equal(model.dirty, true)
  model.undo()
  assert.deepEqual(model.scene.entities, {})
})

test('an inspector or drag cannot overwrite a scene revision it did not review', () => {
  const model = new SceneModel('scene-1')
  model.edit([{ kind: 'add', id: 'box-1', entity: primitiveEntity('Box') }])
  const reviewed = model.scene.revision
  const draft = { ...model.scene.entities['box-1'], name: 'Stale inspector' }
  model.edit([{ kind: 'add', id: 'box-2', entity: primitiveEntity('Newer edit') }])
  const safe = model.document.content
  assert.throws(() => model.edit([{ kind: 'replace', id: 'box-1', entity: draft }], reviewed))
  assert.equal(model.document.content, safe)
  model.undo()
  assert.equal(model.scene.entities['box-1'].name, 'Box')
  assert.equal(model.scene.entities['box-2'], undefined)
})
