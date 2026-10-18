/** The view's private MessagePort carries fixed operations, never native HTTP credentials. */
export class Host extends EventTarget {
  constructor() {
    super()
    this.sequence = 0
    this.waiters = new Map()
    this.tail = Promise.resolve()
    const documentId = new URLSearchParams(location.hash.slice(1)).get('aix-document')
    if (!documentId || window === parent) return
    const channel = new MessageChannel()
    this.port = channel.port1
    this.port.onmessage = ({ data }) => {
      if (data?.protocolVersion !== 1) return
      if (data.type === 'aix.view.connect' || data.type === 'aix.view.environment') {
        this.environment = data.environment
        if (data.type === 'aix.view.connect') this.stateJSON = data.stateJSON
        this.dispatchEvent(new Event('environment'))
      } else if (data.type === 'aix.resource.result') this.waiters.get(data.id)?.resolve(data.value)
      else if (data.type === 'aix.resource.refused')
        this.waiters.get(data.id)?.reject(Object.assign(new Error(data.reason), { reason: data.reason }))
      else if (data.type === 'aix.view.seed') {
        this.homeSeed = data
        this.dispatchEvent(new Event('home-seed'))
      } else if (data.type === 'aix.view.checkpoint' && Number.isSafeInteger(data.id) && data.id > 0 &&
        ['leave', 'renew'].includes(data.purpose) && Object.keys(data).every((key) => ['protocolVersion', 'type', 'id', 'purpose'].includes(key))) {
        this.dispatchEvent(new CustomEvent('checkpoint', { detail: data }))
      }
    }
    this.port.onmessageerror = () => this.close()
    this.port.start()
    parent.postMessage({ protocolVersion: 1, type: 'aix.document.ready', documentId }, '*', [channel.port2])
    window.addEventListener('pagehide', () => this.close(), { once: true })
  }

  request(request) {
    const result = this.tail.then(() => this.send(request))
    this.tail = result.catch(() => {})
    return result
  }

  send(request) {
    if (!this.port) return Promise.reject(Object.assign(new Error('closed'), { reason: 'closed' }))
    const id = ++this.sequence
    return new Promise((resolve, reject) => {
      const finish = (settle, value) => {
        clearTimeout(timer)
        this.waiters.delete(id)
        settle(value)
      }
      const timer = setTimeout(
        () => finish(reject, Object.assign(new Error('outcome_unknown'), { reason: 'outcome_unknown' })),
        65_000
      )
      this.waiters.set(id, {
        resolve: (value) => finish(resolve, value),
        reject: (error) => finish(reject, error)
      })
      try {
        this.port.postMessage({ protocolVersion: 1, type: 'aix.resource.request', id, request })
      } catch {
        finish(reject, Object.assign(new Error('closed'), { reason: 'closed' }))
      }
    })
  }

  reportHome(delivery, applied, seed, holdsWork) {
    this.port?.postMessage({ protocolVersion: 1, type: 'aix.view.home', delivery, applied, seed, holdsWork, modelRequests: 0 })
  }

  reportRecovery(dirty) {
    this.port?.postMessage({ protocolVersion: 1, type: 'aix.view.recovery', dirty })
  }

  checkpointResult(id, ok, dirty) {
    this.port?.postMessage({ protocolVersion: 1, type: 'aix.view.checkpoint.result', id, ok, dirty })
  }

  close() {
    for (const waiter of this.waiters.values())
      waiter.reject(Object.assign(new Error('closed'), { reason: 'closed' }))
    this.port?.close()
    this.port = null
  }
}
