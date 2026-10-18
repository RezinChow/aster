import assert from 'node:assert/strict'
import test from 'node:test'

import { ProjectSession } from '../src/project-session.mjs'
import { primitiveEntity, SceneModel } from '../src/scene-model.mjs'

const refusal = (reason) => Object.assign(new Error(reason), { reason })

test('project writes cannot start before their immutable intent is durable', async () => {
  const model = new SceneModel('scene-1')
  let effects = 0
  const session = new ProjectSession({ async request() { effects += 1 } }, model,
    async () => { throw refusal('unavailable') })
  session.scope = { workspaceId: 'workspace-1', projectId: 'project-1', lease: 'lease-1', revision: 1 }
  await assert.rejects(session.save(), { reason: 'unavailable' })
  assert.ok(session.saveIntent.operationId)
  assert.equal(effects, 0)
  const creating = new ProjectSession(session.host, model, session.checkpoint)
  await assert.rejects(creating.create('workspace-1', 'Safe title'), { reason: 'unavailable' })
  assert.ok(creating.createIntent.id)
  assert.equal(effects, 0)
})

test('a failed completion checkpoint cannot enable a duplicate create', async () => {
  let checkpoints = 0
  const effects = new Map()
  const session = new ProjectSession({ async request(input) {
    if (!effects.has(input.id)) effects.set(input.id, { id: input.id, title: input.title })
    return effects.get(input.id)
  } }, new SceneModel('scene-1'), async () => {
    checkpoints += 1
    if (checkpoints === 2) throw refusal('unavailable')
  })
  await assert.rejects(session.create('workspace-1', 'Original'), { reason: 'unavailable' })
  const original = session.createIntent.id
  const result = await session.create('workspace-1', 'Changed')
  assert.equal(result.id, original)
  assert.equal(result.title, 'Original')
  assert.equal(effects.size, 1)
})

test('a project read cannot replace edits made while it was loading', async () => {
  const model = new SceneModel('scene-local')
  const remote = new SceneModel('scene-remote')
  let finishRead
  const read = new Promise((resolve) => { finishRead = resolve })
  const closed = []
  const session = new ProjectSession({
    async request(operation) {
      if (operation.operation === 'open') return { lease: 'new-lease' }
      if (operation.operation === 'read') return read
      if (operation.operation === 'close') { closed.push(operation.lease); return null }
      throw new Error('Unexpected operation')
    }
  }, model)
  session.scope = { workspaceId: 'workspace-1', projectId: 'project-old', lease: 'old-lease', revision: 1 }
  const opening = session.open('workspace-1', 'project-new')
  model.edit([{ kind: 'add', id: 'box-1', entity: primitiveEntity('Typed during loading') }])
  const draft = model.document.content
  finishRead({ revision: 1, content: remote.document.content })
  await assert.rejects(opening, { reason: 'conflict' })
  assert.equal(model.document.content, draft)
  assert.equal(model.dirty, true)
  assert.equal(session.scope.projectId, 'project-old')
  assert.deepEqual(closed, ['new-lease'])
})

test('an expired lease renews authority without changing reviewed bytes or revision', async () => {
  const model = new SceneModel('scene-1')
  model.edit([{ kind: 'add', id: 'box-1', entity: primitiveEntity('Keep this draft') }])
  const submitted = model.document.content
  let first
  const session = new ProjectSession({
    async request(operation) {
      if (operation.operation === 'open') return { lease: 'fresh-lease' }
      if (operation.operation === 'close') return null
      if (operation.operation === 'save') {
        if (operation.lease === 'expired-lease') {
          first = { ...operation }
          throw refusal('not_found')
        }
        assert.equal(operation.lease, 'fresh-lease')
        assert.equal(operation.expectedRevision, 7)
        assert.equal(operation.operationId, first.operationId)
        assert.equal(operation.content, submitted)
        return { operationId: operation.operationId, document: { key: 'scene', revision: 8, content: submitted } }
      }
      throw new Error('Unexpected operation')
    }
  }, model)
  session.scope = { workspaceId: 'workspace-1', projectId: 'project-1', lease: 'expired-lease', revision: 7 }
  await session.save()
  assert.equal(model.dirty, false)
  assert.equal(session.scope.revision, 8)
})

test('lease renewal after revocation refuses the write and keeps the draft', async () => {
  const model = new SceneModel('scene-1')
  model.edit([{ kind: 'add', id: 'box-1', entity: primitiveEntity('Protected draft') }])
  const draft = model.document.content
  let writes = 0
  const session = new ProjectSession({
    async request(operation) {
      if (operation.operation === 'save') writes += 1
      throw refusal('not_found')
    }
  }, model)
  session.scope = { workspaceId: 'workspace-1', projectId: 'project-1', lease: 'expired-lease', revision: 7 }
  await assert.rejects(session.save(), { reason: 'not_found' })
  assert.equal(writes, 1)
  assert.equal(model.document.content, draft)
  assert.equal(model.dirty, true)
})

test('a lost save reply replays one owner effect and preserves newer local edits', async () => {
  const model = new SceneModel('scene-1')
  const receipts = new Map()
  let stored = null
  let effects = 0
  let loseReply = true
  const session = new ProjectSession(
    {
      async request(operation) {
        if (operation.operation === 'open') return { lease: 'lease-1' }
        if (operation.operation === 'read') {
          if (!stored) throw refusal('not_found')
          return stored
        }
        if (operation.operation === 'save') {
          if (receipts.has(operation.operationId)) return receipts.get(operation.operationId)
          assert.equal(operation.expectedRevision, null)
          stored = { key: 'scene', revision: 1, content: operation.content }
          const receipt = { operationId: operation.operationId, document: stored }
          receipts.set(operation.operationId, receipt)
          effects += 1
          if (loseReply) {
            loseReply = false
            throw refusal('outcome_unknown')
          }
          return receipt
        }
        throw new Error('Unexpected operation')
      }
    },
    model
  )
  await session.open('workspace-1', 'project-1')
  await assert.rejects(session.save(), { reason: 'missing_scene' })
  model.edit([{ kind: 'add', id: 'box-1', entity: primitiveEntity('Submitted box') }])
  await assert.rejects(session.save({ create: true }), { reason: 'outcome_unknown' })
  const identity = session.saveIntent.operationId
  model.edit([{ kind: 'add', id: 'box-2', entity: primitiveEntity('Newer box') }])
  await assert.rejects(session.open('workspace-2', 'project-2'), { reason: 'outcome_unknown' })
  const receipt = await session.save()
  assert.equal(receipt.operationId, identity)
  assert.equal(effects, 1)
  assert.equal(session.scope.revision, 1)
  assert.equal(session.saveIntent, null)
  assert.equal(model.dirty, true)
  assert.ok(model.scene.entities['box-2'])
  assert.ok(!stored.content.includes('Newer box'))
})

test('a conflicting save retains the draft and never adopts an unreviewed owner revision', async () => {
  const model = new SceneModel('scene-1')
  const session = new ProjectSession(
    {
      async request(operation) {
        if (operation.operation === 'open') return { lease: 'lease-1' }
        if (operation.operation === 'read') return { revision: 4, content: model.document.content }
        if (operation.operation === 'save') {
          assert.equal(operation.expectedRevision, 4)
          throw refusal('conflict')
        }
        throw new Error('Unexpected operation')
      }
    },
    model
  )
  await session.open('workspace-1', 'project-1')
  model.edit([{ kind: 'add', id: 'box-1', entity: primitiveEntity('Safe draft') }])
  const content = model.document.content
  await assert.rejects(session.save(), { reason: 'conflict' })
  assert.equal(session.scope.revision, 4)
  assert.equal(session.saveIntent, null)
  assert.equal(model.document.content, content)
  assert.equal(model.dirty, true)
})

test('unavailable or invalid reads keep the previous project and its draft', async () => {
  const model = new SceneModel('scene-1')
  const session = new ProjectSession(
    {
      async request(operation) {
        if (operation.operation === 'open') return { lease: 'new-lease' }
        if (operation.operation === 'read') return { revision: 9, content: 'invalid ACL' }
        if (operation.operation === 'close') return null
        throw new Error('Unexpected operation')
      }
    },
    model
  )
  session.scope = {
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    lease: 'old-lease',
    revision: 2
  }
  model.edit([{ kind: 'add', id: 'box-1', entity: primitiveEntity('Keep me') }])
  const before = model.document.content
  await assert.rejects(session.open('workspace-1', 'project-2'))
  assert.equal(session.scope.projectId, 'project-1')
  assert.equal(model.document.content, before)
  assert.equal(model.dirty, true)
})

test('authority refusal after a lost reply keeps the intent until an authorized receipt confirms it', async () => {
  const model = new SceneModel('scene-1')
  let receipt
  let attempts = 0
  const session = new ProjectSession(
    {
      async request(operation) {
        if (operation.operation === 'open') return { lease: crypto.randomUUID() }
        if (operation.operation === 'close') return null
        if (operation.operation === 'read') return { revision: 7, content: model.document.content }
        if (operation.operation === 'save') {
          attempts += 1
          if (attempts === 1) {
            receipt = {
              operationId: operation.operationId,
              document: { key: 'scene', revision: 8, content: operation.content }
            }
            throw refusal('outcome_unknown')
          }
          throw refusal('not_found')
        }
        if (operation.operation === 'read-receipt') {
          assert.equal(operation.operationId, receipt.operationId)
          return receipt
        }
        throw new Error('Unexpected operation')
      }
    },
    model
  )
  await session.open('workspace-1', 'project-1')
  model.edit([{ kind: 'add', id: 'box-1', entity: primitiveEntity('Saved despite a lost reply') }])
  await assert.rejects(session.save(), { reason: 'outcome_unknown' })
  await assert.rejects(session.save(), { reason: 'not_found' })
  assert.equal(session.saveIntent.operationId, receipt.operationId)
  await assert.rejects(session.open('workspace-2', 'project-2'), { reason: 'outcome_unknown' })
  await session.reconcile()
  assert.equal(attempts, 2)
  assert.equal(session.saveIntent, null)
  assert.equal(session.scope.revision, 8)
  assert.equal(model.dirty, false)
})

test('an unconfirmed create retries the same project and submitted title after authority recovers', async () => {
  const records = new Map()
  let attempts = 0
  const session = new ProjectSession(
    {
      async request(operation) {
        assert.equal(operation.operation, 'create-project')
        attempts += 1
        if (attempts === 2) throw refusal('not_found')
        if (!records.has(operation.id)) records.set(operation.id, { id: operation.id, title: operation.title })
        if (attempts === 1) throw refusal('outcome_unknown')
        return records.get(operation.id)
      }
    },
    new SceneModel('scene-1')
  )
  await assert.rejects(session.create('workspace-1', 'Original title'), { reason: 'outcome_unknown' })
  const intent = { ...session.createIntent }
  await assert.rejects(session.create('workspace-1', 'Changed title'), { reason: 'not_found' })
  assert.deepEqual(session.createIntent, intent)
  const result = await session.create('workspace-1', 'Another title')
  assert.equal(result.title, 'Original title')
  assert.equal(result.id, intent.id)
  assert.equal(records.size, 1)
  assert.equal(session.createIntent, null)
})

test('saving a loaded scene retains visual and collision asset references', async () => {
  const model = new SceneModel('scene-1')
  const visual = `sha256:${'a'.repeat(64)}`
  const collision = `sha256:${'b'.repeat(64)}`
  const entity = primitiveEntity('Loaded mesh')
  entity.visual = { asset: visual }
  entity.body.collider = { kind: 'mesh', asset: collision }
  model.edit([{ kind: 'add', id: 'mesh-1', entity }])
  const session = new ProjectSession(
    {
      async request(operation) {
        assert.deepEqual(operation.assets, [visual, collision])
        return {
          operationId: operation.operationId,
          document: { key: 'scene', revision: 2, content: operation.content }
        }
      }
    },
    model
  )
  session.scope = { workspaceId: 'workspace-1', projectId: 'project-1', lease: 'lease-1', revision: 1 }
  await session.save()
  assert.equal(model.dirty, false)
})
