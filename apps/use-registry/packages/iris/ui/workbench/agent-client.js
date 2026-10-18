const TURN_TIMEOUT_MS = 185_000

export class AgentClient {
  constructor(port, timeoutMs = TURN_TIMEOUT_MS) {
    this.port = port
    this.timeoutMs = timeoutMs
    this.sequence = 0
    this.pending = new Map()
    this.closed = false
    port.onmessage = ({ data }) => {
      if (data?.protocolVersion !== 1) return
      if (data.type === 'aix.agent.result') this.pending.get(data.id)?.resolve(data.text)
      else if (data.type === 'aix.agent.refused') this.pending.get(data.id)?.reject(failure(data.reason))
    }
    port.onmessageerror = () => this.close()
    port.start()
  }

  invoke(observation, signal) {
    if (this.closed) return Promise.reject(failure('closed'))
    if (signal?.aborted) return Promise.reject(failure('cancelled'))
    const id = ++this.sequence
    return new Promise((resolve, reject) => {
      const finish = (settle, value) => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', abort)
        this.pending.delete(id)
        settle(value)
      }
      const abort = () => finish(reject, failure('cancelled'))
      const timer = setTimeout(() => finish(reject, failure('agent_timeout')), this.timeoutMs)
      this.pending.set(id, {
        resolve: (value) => finish(resolve, value),
        reject: (error) => finish(reject, error)
      })
      signal?.addEventListener('abort', abort, { once: true })
      try {
        this.port.postMessage({ protocolVersion: 1, type: 'aix.agent.invoke', id, agent: 'iris', prompt: '选择下一步。', parameters: { observation } })
      } catch {
        finish(reject, failure('closed'))
      }
    })
  }

  close() {
    if (this.closed) return
    this.closed = true
    for (const waiter of [...this.pending.values()]) waiter.reject(failure('closed'))
    this.port.onmessage = null
    this.port.onmessageerror = null
    this.port.close()
  }
}

function failure(reason) {
  return Object.assign(new Error(reason), { reason })
}
