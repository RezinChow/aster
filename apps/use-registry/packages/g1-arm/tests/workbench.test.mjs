import assert from 'node:assert/strict'
import test from 'node:test'

import { loadMujoco } from '../ui/workbench/engine.js'
import { eligiblePhases } from '../ui/workbench/planning.js'
import { Session } from '../ui/workbench/session.js'
import { MESHES, VISUALS } from '../ui/workbench/vendor/g1/g1.js'
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

test('the G1 scene settles at the upstream travel pose', async () => {
  const world = await RobotWorld.create(mujoco, 'transfer', 0)
  const settled = world.position
  // EmbodiedJev G1Spec settles its tcp at (0.38165, -0.07967, 0.21521): the
  // position servos sag about 5 mm under the gravity they do not compensate.
  for (const [value, expected] of settled.map((v, i) => [v, [0.38165, -0.07967, 0.21521][i]])) {
    assert.ok(Math.abs(value - expected) < 2e-4, `tcp ${settled}`)
  }
  assert.ok(Math.abs(settled[2] - TRAVEL_Z) < 6e-3)
  assert.equal(world.observe().robot, 'Unitree G1 右臂 + 平行夹爪')
  assert.deepEqual(eligiblePhases(world.observe()), ['approach'])
  assert.equal(world.success(), false)
  world.dispose()
})

test('the vendored G1 keeps the upstream model: degrees of freedom, actuators, mass and colliders', async () => {
  const world = await RobotWorld.create(mujoco, 'transfer', 0)
  const { model } = world
  // The task scene adds the cube freejoint (7 qpos, 6 dof) to the robot's 38 hinges.
  assert.equal(model.nq, 45)
  assert.equal(model.nv, 44)
  assert.equal(model.nu, 37)
  let robotMass = 0
  let robotColliders = 0
  const cube = world.bodyId('cube')
  for (let body = 1; body < model.nbody; body += 1) if (body !== cube) robotMass += model.body_mass[body]
  for (let geom = 0; geom < model.ngeom; geom += 1) {
    const body = model.geom_bodyid[geom]
    if (body === 0 || body === cube) continue
    if (model.geom_contype[geom] || model.geom_conaffinity[geom]) robotColliders += 1
  }
  // verify_g1_grasp.py builds 34.8905 kg with its 0.06 kg cube, and 25
  // colliding geoms with its table, cube and support.
  assert.ok(Math.abs(robotMass - 34.8305276) < 1e-6, `mass ${robotMass}`)
  assert.equal(robotColliders, 22)
  world.dispose()
})

test('the packed G1 carries every visual mesh it draws', () => {
  assert.equal(VISUALS.length, 21)
  for (const { mesh } of VISUALS) assert.ok(mesh in MESHES, mesh)
})

test('inverse kinematics restarts from a backup pose when the current pose gets stuck', async () => {
  const world = await RobotWorld.create(mujoco, 'transfer', 0)
  const goal = [0.448, -0.176, 0.252]
  const current = world.shared.armQ.map((address) => world.data.qpos[address])
  assert.ok(world.dls(goal, current).error > 0.004, 'the warm start converges; pick another goal')
  const solved = world.solveIk(goal)
  assert.ok(solved.error <= 0.004, `restart error ${solved.error}`)
  world.dispose()
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
