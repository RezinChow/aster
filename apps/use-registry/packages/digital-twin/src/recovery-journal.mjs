/** Recovery writes serialize immutable intents before any remote project effect. */
export class RecoveryJournal {
  constructor(host, capture, restore) {
    this.host = host
    this.capture = capture
    this.restore = restore
    this.revision = 0
    this.ready = false
    this.intent = null
    this.confirmed = null
    this.tail = Promise.resolve()
    this.scheduled = null
    this.timer = null
  }

  async load() {
    const snapshot = await this.host.request({ operation: 'read-draft', key: 'session' })
    if (!snapshot || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 ||
      !(snapshot.content === null || typeof snapshot.content === 'string')) throw this.failure('unavailable')
    if (snapshot.content !== null) await this.restore(JSON.parse(snapshot.content))
    this.revision = snapshot.revision
    this.confirmed = snapshot.content
    this.ready = true
  }

  checkpoint() {
    clearTimeout(this.timer)
    const scheduled = this.scheduled
    this.scheduled = null
    const operation = this.tail.then(async () => {
      if (!this.ready) throw this.failure('closed')
      if (this.intent) await this.commit()
      const content = JSON.stringify(this.capture())
      if (content === this.confirmed) return
      this.intent = { operation: 'save-draft', key: 'session', operationId: crypto.randomUUID(),
        expectedRevision: this.revision, content }
      await this.commit()
    })
    this.tail = operation.catch(() => {})
    if (scheduled) operation.then(scheduled.resolve, scheduled.reject)
    return operation
  }

  schedule() {
    if (!this.scheduled) {
      let resolve, reject
      const promise = new Promise((accept, refuse) => { resolve = accept; reject = refuse })
      this.scheduled = { promise, resolve, reject }
    }
    clearTimeout(this.timer)
    this.timer = setTimeout(() => { void this.checkpoint().catch(() => {}) }, 200)
    return this.scheduled.promise
  }

  async commit() {
    const intent = this.intent
    const receipt = await this.host.request(intent)
    if (!receipt || receipt.revision !== intent.expectedRevision + 1 || receipt.content !== intent.content)
      throw this.failure('outcome_unknown')
    this.revision = receipt.revision
    this.confirmed = receipt.content
    this.intent = null
  }

  failure(reason) { return Object.assign(new Error(reason), { reason }) }
}
