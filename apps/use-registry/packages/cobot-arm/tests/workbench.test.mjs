import assert from 'node:assert/strict'
import test from 'node:test'

import { loadMujoco } from '../ui/workbench/engine.js'
import { eligiblePhases } from '../ui/workbench/planning.js'
import { Session } from '../ui/workbench/session.js'
import { MESHES, VISUALS } from '../ui/workbench/vendor/panda/panda.js'
import { RobotWorld, TASKS, TRAVEL_Z } from '../ui/workbench/world.js'

const mujoco = await loadMujoco()

const baseline = async (_stage, request) => ({ choice: request.baseline_choice, source: 'rule' })

async function episode(task, seed, choose = baseline) {
  const session = await Session.create(mujoco, { task, seed, speed: 0, choose })
  session.start()
  await session.loop
  const snapshot = session.snapshot()
  await session.dispose()
  return snapshot
}

test('the Panda scene settles at the upstream travel pose', async () => {
  const world = await RobotWorld.create(mujoco, 'transfer', 0)
  const settled = world.position
  for (const [value, expected] of settled.map((v, i) => [v, [0.37997, -0.07999, 0.22001][i]])) {
    assert.ok(Math.abs(value - expected) < 2e-4, `tcp ${settled}`)
  }
  assert.ok(Math.abs(settled[2] - TRAVEL_Z) < 1e-3)
  assert.deepEqual(eligiblePhases(world.observe()), ['approach'])
  assert.equal(world.success(), false)
  world.dispose()
})

test('the packed Panda carries every visual mesh it draws', () => {
  assert.equal(VISUALS.length, 58)
  for (const { mesh } of VISUALS) assert.ok(mesh in MESHES, mesh)
})

test('the rule baseline completes all three tasks in eight verified cycles', async () => {
  for (const task of Object.keys(TASKS)) {
    const snapshot = await episode(task, 0)
    assert.equal(snapshot.status, 'completed', `${task}: ${snapshot.message}`)
    assert.equal(snapshot.stage, 'verified')
    assert.equal(snapshot.cycles, 8, task)
    assert.deepEqual(
      snapshot.history.map((item) => item.phase),
      ['approach', 'descend', 'grasp', 'lift', 'carry', 'lower', 'release', 'withdraw'],
      task
    )
  }
})

test('seeds move the source cube', async () => {
  const seen = new Set()
  for (const seed of [1, 2, 3]) {
    const world = await RobotWorld.create(mujoco, 'transfer', seed)
    seen.add(world.cube.slice(0, 2).map((v) => v.toFixed(3)).join(','))
    world.dispose()
  }
  assert.equal(seen.size, 3)
})

test('every decision offers its baseline, and a choice outside the offer stops the episode', async () => {
  const offered = []
  const done = await episode('transfer', 0, async (stage, request) => {
    assert.ok(request.baseline_choice in request.options, stage)
    assert.equal(request.decision.type, 'choice')
    assert.ok(request.state.observation.goal)
    offered.push(stage)
    return { choice: request.baseline_choice, source: 'rule' }
  })
  assert.equal(done.status, 'completed')
  assert.equal(offered.length, 16)
  const refused = await episode('transfer', 0, async () => ({ choice: 'fly', source: 'model' }))
  assert.equal(refused.status, 'error')
  assert.match(refused.message, /未提供的选项/)
})

test('a choice below the threshold waits for a person, then the episode goes on', async () => {
  const unsure = async (stage, request) => ({
    choice: request.baseline_choice,
    source: 'model',
    selected_probability: stage === 'action' ? 0.4 : null
  })
  const session = await Session.create(mujoco, { task: 'transfer', seed: 0, speed: 0, choose: unsure })
  session.start()
  while (session.status === 'running') await new Promise((resolve) => setTimeout(resolve, 5))
  const waiting = session.snapshot()
  assert.equal(waiting.status, 'uncertain')
  assert.equal(waiting.threshold, 0.55)
  assert.equal(waiting.cycles, 0)
  assert.equal(waiting.last_decision.selected_probability, 0.4)
  assert.match(waiting.message, /低于设定门槛/)

  session.start(false, 0.4)
  await session.loop
  const done = session.snapshot()
  await session.dispose()
  assert.equal(done.status, 'completed')
  assert.equal(done.cycles, 8)
})

test('an unpaced episode runs faster than real time, previews included', async () => {
  const started = performance.now()
  const snapshot = await episode('transfer', 0)
  const perSecond = (performance.now() - started) / snapshot.frame.time
  assert.ok(perSecond < 400, `${perSecond.toFixed(1)} ms per simulated second`)
})
