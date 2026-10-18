import assert from 'node:assert/strict'
import { MessageChannel } from 'node:worker_threads'
import test from 'node:test'

import { AgentClient } from '../ui/workbench/agent-client.js'
import { loadMujoco } from '../ui/workbench/engine.js'
import { Session } from '../ui/workbench/session.js'

test('an unanswered host has a bounded deadline and a late answer cannot satisfy another turn', async () => {
  const channel = new MessageChannel()
  const client = new AgentClient(channel.port1, 100)
  const seen = []
  channel.port2.on('message', (message) => seen.push(message))
  try {
    await assert.rejects(client.invoke({ options: { direct: 'Take off' } }), { reason: 'agent_timeout' })
    channel.port2.postMessage({ protocolVersion: 1, type: 'aix.agent.result', id: 1, text: 'stale' })
    const next = client.invoke({ options: { hold: 'Hold position' } })
    channel.port2.postMessage({ protocolVersion: 1, type: 'aix.agent.result', id: 2, text: 'current' })
    assert.equal(await next, 'current')
    assert.equal(seen[0].agent, 'iris')
  } finally {
    client.close()
    channel.port2.close()
  }
})

test('stop and dispose finish while a host has not answered its decision', async () => {
  const mujoco = await loadMujoco()
  const channel = new MessageChannel()
  const client = new AgentClient(channel.port1)
  const requested = new Promise((resolve) => channel.port2.once('message', resolve))
  const session = Session.create(mujoco, {
    task: 'patrol', speed: 0,
    choose: async (_stage, request, signal) => {
      if (Object.keys(request.options).length === 1) return { choice: request.baseline_choice }
      return JSON.parse(await client.invoke(request, signal))
    }
  })
  try {
    session.start()
    await requested
    session.stop()
    await session.loop
    assert.equal(session.status, 'stopped')
    assert.equal(session.cycles, 0)
    await assert.rejects(client.invoke({}, session.abort.signal), { reason: 'cancelled' })
  } finally {
    await session.dispose()
    client.close()
    channel.port2.close()
  }
})

test('closing the frame rejects its outstanding waiters', async () => {
  const channel = new MessageChannel()
  const client = new AgentClient(channel.port1)
  try {
    const pending = assert.rejects(client.invoke({}), { reason: 'closed' })
    client.close()
    await pending
    await assert.rejects(client.invoke({}), { reason: 'closed' })
  } finally {
    client.close()
    channel.port2.close()
  }
})
