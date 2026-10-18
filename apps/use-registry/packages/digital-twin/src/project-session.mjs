import { decodeScene } from './domain.mjs'

/** A retry keeps the reviewed revision and submitted bytes, including after later local edits. */
export class ProjectSession {
  constructor(host, model, checkpoint = async () => {}) {
    this.host = host
    this.model = model
    this.scope = null
    this.saveIntent = null
    this.createIntent = null
    this.saveUncertain = false
    this.createUncertain = false
    this.checkpoint = checkpoint
  }

  async open(workspaceId, projectId) {
    if (this.saveIntent || this.createIntent)
      throw Object.assign(new Error('outcome_unknown'), { reason: 'outcome_unknown' })
    const reviewed = this.model.version
    const lease = await this.host.request({
      operation: 'open',
      workspaceId,
      projectId,
      resources: ['scene'],
      access: 'read-write'
    })
    let document
    try {
      document = await this.host.request({
        operation: 'read',
        lease: lease.lease,
        key: 'scene',
        revision: null
      })
      decodeScene(document.content)
    } catch (error) {
      if (error.reason !== 'not_found') {
        await this.host.request({ operation: 'close', lease: lease.lease }).catch(() => {})
        throw error
      }
    }
    if (this.model.version !== reviewed) {
      await this.host.request({ operation: 'close', lease: lease.lease }).catch(() => {})
      throw Object.assign(new Error('conflict'), { reason: 'conflict' })
    }
    const previous = this.scope
    this.scope = {
      workspaceId,
      projectId,
      lease: lease.lease,
      revision: document?.revision,
      missing: !document
    }
    if (document) this.model.load(document.content)
    if (previous) await this.host.request({ operation: 'close', lease: previous.lease }).catch(() => {})
    return this.scope
  }

  async create(workspaceId, title) {
    if (this.saveIntent) throw Object.assign(new Error('outcome_unknown'), { reason: 'outcome_unknown' })
    this.createIntent ??= {
      operation: 'create-project',
      workspaceId,
      id: crypto.randomUUID(),
      title
    }
    const intent = this.createIntent
    await this.checkpoint()
    try {
      const project = await this.host.request(intent)
      this.createIntent = null
      this.createUncertain = false
      try {
        await this.checkpoint()
      } catch (error) {
        this.createIntent = intent
        this.createUncertain = true
        throw error
      }
      return project
    } catch (error) {
      if (!this.createUncertain && ['invalid_request', 'conflict', 'not_found'].includes(error.reason))
        this.createIntent = null
      else this.createUncertain = true
      await this.checkpoint()
      throw error
    }
  }

  async save({ create = false } = {}) {
    if (!this.scope) throw Object.assign(new Error('no_project'), { reason: 'no_project' })
    if (this.createIntent) throw Object.assign(new Error('outcome_unknown'), { reason: 'outcome_unknown' })
    if (this.scope.missing && !create && !this.saveIntent)
      throw Object.assign(new Error('missing_scene'), { reason: 'missing_scene' })
    this.saveIntent ??= {
      operation: 'save',
      lease: this.scope.lease,
      key: 'scene',
      operationId: crypto.randomUUID(),
      expectedRevision: this.scope.missing ? null : this.scope.revision,
      content: this.model.document.content,
      assets: [
        ...new Set(
          Object.values(this.model.scene.entities).flatMap((entity) =>
            [entity.visual?.asset, entity.body?.collider.kind === 'mesh' ? entity.body.collider.asset : null].filter(
              Boolean
            )
          )
        )
      ].sort()
    }
    const intent = this.saveIntent
    await this.checkpoint()
    if (!this.scope.lease) await this.renew()
    let receipt
    try {
      try {
        receipt = await this.host.request(intent)
      } catch (error) {
        if (error.reason !== 'not_found' || this.saveUncertain) throw error
        await this.renew()
        receipt = await this.host.request(intent)
      }
    } catch (error) {
      if (!this.saveUncertain && ['invalid_request', 'conflict', 'not_found'].includes(error.reason))
        this.saveIntent = null
      else this.saveUncertain = true
      await this.checkpoint()
      throw error
    }
    return this.accept(receipt)
  }

  async renew() {
    const { workspaceId, projectId } = this.scope
    const fresh = await this.host.request({
      operation: 'open',
      workspaceId,
      projectId,
      resources: ['scene'],
      access: 'read-write'
    })
    const previous = this.scope.lease
    this.scope.lease = fresh.lease
    if (this.saveIntent) this.saveIntent.lease = fresh.lease
    if (previous) await this.host.request({ operation: 'close', lease: previous }).catch(() => {})
  }

  async reconcile() {
    if (!this.saveIntent) return
    await this.renew()
    const receipt = await this.host.request({
      operation: 'read-receipt',
      lease: this.scope.lease,
      operationId: this.saveIntent.operationId
    })
    return this.accept(receipt)
  }

  async accept(receipt) {
    const intent = this.saveIntent
    this.saveUncertain = true
    // Do not accept a reply for different bytes as the outcome of this intent.
    if (
      !receipt ||
      receipt.operationId !== intent.operationId ||
      receipt.document.key !== intent.key ||
      receipt.document.content !== intent.content
    ) {
      throw Object.assign(new Error('outcome_unknown'), { reason: 'outcome_unknown' })
    }
    this.scope.revision = receipt.document.revision
    this.scope.missing = false
    this.saveIntent = null
    this.saveUncertain = false
    this.model.saved(intent.content)
    try {
      await this.checkpoint()
    } catch (error) {
      this.saveIntent = intent
      this.saveUncertain = true
      throw error
    }
    return receipt
  }
}
