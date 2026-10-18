import assert from 'node:assert/strict'
import test from 'node:test'

import { loadMujoco } from '../ui/workbench/engine.js'
import {
  PLANNING_INSTRUCTIONS,
  baselineChoice,
  incrementalCandidates,
  incrementalMenu,
  incrementalStalled,
  planningState
} from '../ui/workbench/incremental.js'
import { Perception, externalCalibration, wristCalibration } from '../ui/workbench/perception.js'
import { Session } from '../ui/workbench/session.js'
import { TASKS, WORKSPACE } from '../ui/workbench/world.js'

const mujoco = await loadMujoco()

/** The vision observation as the page builds it, minus the pixels Node cannot render. */
function visionObserver(task) {
  const perception = new Perception(task, { geometry: false })
  let hand = null
  return (world) => {
    const sensors = world.sensors()
    if (perception.lastTime === sensors.simTime && perception.lastObservation) return structuredClone(perception.lastObservation)
    hand ??= world.bodyId('hand')
    const frame = world.frame({})
    return perception.observe(
      { external: { calibration: externalCalibration() }, wrist: { calibration: wristCalibration(frame.bodies[hand]) } },
      sensors
    )
  }
}

// Catch a clipped step, a missing motor command, or a menu that offers a rejected target.
test('the menu is 18 fixed moves plus open, close and hold, rejecting targets outside the G1 workspace', () => {
  const options = incrementalCandidates({ tcp: [0.29, 0, 0.2] })
  assert.equal(options.length, 21)
  const ids = options.map((option) => option.id)
  for (const axis of 'xyz') for (const sign of ['pos', 'neg']) for (const mm of [40, 10, 2]) assert.ok(ids.includes(`${axis}_${sign}_${mm}`))
  assert.ok(['open', 'close', 'hold'].every((id) => ids.includes(id)))
  const back = options.find((option) => option.id === 'x_neg_40')
  assert.equal(back.admitted, false, 'x 0.29 - 0.04 leaves the workspace')
  assert.deepEqual(back.target.map((v) => Number(v.toFixed(3))), [0.25, 0, 0.2], 'the rejected target is not clipped')
  assert.ok(back.target[0] < WORKSPACE[0][0])
  const menu = incrementalMenu(options, { tcp: [0.29, 0, 0.2] })
  assert.equal('x_neg_40' in menu, false)
  assert.deepEqual(JSON.parse(menu.z_neg_10), { delta_xyz: [0, 0, -0.01], gripper: null, seconds: 0.45 })
  assert.deepEqual(JSON.parse(menu.close), { delta_xyz: [0, 0, 0], gripper: 'close', seconds: 0.65 })
  assert.throws(() => incrementalCandidates({ tcp: [0, Number.NaN, 0] }), /three finite/)
})

// Catch simulator object poses or success truth reaching a vision decision.
test('vision planning evidence carries sensors and camera calibration, never object poses or success', async () => {
  const session = await Session.create(mujoco, { task: 'transfer', seed: 0, speed: 0, choose: async () => ({}), mode: 'vision' })
  const observation = visionObserver('transfer')(session.world)
  const state = planningState(observation, [])
  for (const key of ['object', 'destination', 'visual_barrier', 'success', 'relative_geometry']) {
    assert.equal(key in state.observation, false, key)
  }
  assert.equal(state.observation.perception.source, 'vision')
  assert.deepEqual(Object.keys(state.observation.perception.views), ['external', 'wrist'])
  assert.equal(state.observation.perception.objects, undefined)
  assert.equal(state.goal_conditions.final_tcp_z_min_m, 0.17)
  assert.equal(JSON.stringify(state).includes('base64'), false)
  assert.throws(() => baselineChoice(observation, incrementalCandidates(observation)), /requires measured object/)

  const privileged = planningState(session.world.observe(), [])
  assert.ok(Array.isArray(privileged.observation.object))
  await session.dispose()
})

// Catch the fixed vocabulary being unable to finish a G1 task inside the vision budget.
test('the quantized skill finishes every task with fixed steps inside 80 decisions', async () => {
  for (const task of Object.keys(TASKS)) {
    let world
    const requests = []
    const oracle = async (stage, request) => {
      requests.push(request)
      const options = incrementalCandidates(request.state.observation)
      return { choice: baselineChoice(world.observe(), options), source: 'model', model_call: true }
    }
    const session = await Session.create(mujoco, { task, seed: 0, speed: 0, choose: oracle, mode: 'vision', maxCycles: 80, observe: visionObserver(task) })
    world = session.world
    session.start()
    await session.loop
    const snapshot = session.snapshot()
    await session.dispose()
    assert.equal(snapshot.status, 'completed', `${task}: ${snapshot.message}`)
    assert.ok(snapshot.cycles <= 80, `${task}: ${snapshot.cycles}`)
    assert.equal(snapshot.observation_mode, 'vision')
    assert.equal(snapshot.model_calls, snapshot.cycles)
    assert.ok(requests.every((request) => request.control === 'incremental' && request.baseline_choice === null))
    assert.ok(requests.every((request) => request.decision.instructions === PLANNING_INSTRUCTIONS))
    assert.ok(requests.every((request) => !('object' in request.state.observation)))
    assert.ok(snapshot.history.every((item) => item.phase === 'incremental' && item.executed))
    console.info(`${task}: ${snapshot.cycles} fixed steps`)
  }
})

// Catch an unsafe or unreachable chosen step being executed or silently replaced.
test('the safety filter rejects the chosen step without substituting another', async () => {
  const session = await Session.create(mujoco, {
    task: 'barrier',
    seed: 0,
    speed: 0,
    choose: async () => ({ choice: 'z_neg_40', source: 'model', model_call: true }),
    mode: 'vision',
    maxCycles: 12,
    observe: visionObserver('barrier')
  })
  session.start()
  await session.loop
  const snapshot = session.snapshot()
  await session.dispose()
  const rejected = snapshot.history.filter((item) => !item.executed)
  assert.ok(rejected.length >= 3, 'lowering the hand onto the barrier must be refused')
  assert.ok(rejected.every((item) => /接触/.test(item.rejection)))
  assert.ok(rejected.every((item) => item.before.tcp.join() === item.after.tcp.join()))
  assert.equal(snapshot.status, 'stalled')
  assert.match(snapshot.message, /没有切换规则策略/)
})

// Catch a vision model failure turning into a silent rule move.
test('a failed vision decision stops the episode', async () => {
  const session = await Session.create(mujoco, {
    task: 'transfer',
    seed: 0,
    speed: 0,
    choose: async () => {
      throw new Error('视觉模型不可用（代理运行失败），已停止；没有使用规则替代。')
    },
    mode: 'vision',
    observe: visionObserver('transfer')
  })
  session.start()
  await session.loop
  const snapshot = session.snapshot()
  await session.dispose()
  assert.equal(snapshot.status, 'error')
  assert.equal(snapshot.cycles, 0)
  assert.match(snapshot.message, /没有使用规则替代/)
})

test('three identical steps with no pose or contact change are a stall', () => {
  const still = { tcp: [0.4, 0, 0.2], held: false, gripper: 'open', finger_contacts: [], support_contact: false }
  const step = { action: { id: 'hold' }, before: still, after: still }
  assert.equal(incrementalStalled([step, step]), false)
  assert.equal(incrementalStalled([step, step, step]), true)
  assert.equal(incrementalStalled([step, step, { ...step, action: { id: 'open' } }]), false)
  assert.equal(incrementalStalled([step, step, { ...step, after: { ...still, tcp: [0.4, 0, 0.21] } }]), false)
})
