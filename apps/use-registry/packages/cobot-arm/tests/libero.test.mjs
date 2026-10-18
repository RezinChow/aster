import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { loadMujoco } from '../ui/workbench/engine.js'
import { STATE_BYTES, episodeResult, evaluationPlan, evaluationReport, reportState, storedReport } from '../ui/workbench/libero-evaluation.js'
import {
  CAMERAS,
  MAX_PLANS,
  MAX_STEPS,
  PlanError,
  VIEWS,
  backproject,
  calibration,
  localState,
  motorAction,
  project,
  reached,
  resolvePlan
} from '../ui/workbench/libero-plan.js'
import { LIBERO_INITS, LIBERO_TASKS, LiberoSession, ReferencePlanner, liberoScene } from '../ui/workbench/libero-session.js'
import { LiberoWorld } from '../ui/workbench/libero-world.js'

const mujoco = await loadMujoco()
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/libero/${name}`, import.meta.url), 'utf8'))
const world = async (task, init = 0) => {
  const scene = await liberoScene(task)
  return LiberoWorld.create(mujoco, { physics: scene.PHYSICS, episode: scene.EPISODE, init })
}
const maxAbs = (a, b) => Math.max(...a.map((value, i) => Math.abs(value - b[i])))

async function finish(session) {
  session.start()
  while (session.loop) await session.loop
  return session.snapshot()
}

// Catch a controller or export drift: robosuite's OSC_POSE on the exported
// model, replayed from the reference simulator's own action sequence.
test('the drawer replay tracks robosuite within a millimetre and succeeds at the same step', async () => {
  const reference = fixture('drawer-reference.json')
  const w = await world('libero-drawer')
  let worst = 0
  let success = null
  reference.actions.forEach((action, k) => {
    w.step(action)
    worst = Math.max(worst, maxAbs(w.tcp, reference.steps[k].eef))
    if (success === null && w.success()) success = k + 1
  })
  assert.ok(worst < 1e-3, `TCP error ${worst} m`)
  assert.equal(success, reference.steps.findIndex((step) => step.success) + 1)
  w.dispose()
})

// MuJoCo 3.15 and 3.5 resolve the door contact differently, so the replay is
// exact only in free space; the open-loop success step stays close.
test('the microwave replay is exact before contact and succeeds within a few steps of robosuite', async () => {
  const reference = fixture('microwave-reference.json')
  const w = await world('libero-microwave')
  let success = null
  reference.actions.forEach((action, k) => {
    w.step(action)
    if (k < 80) assert.ok(maxAbs(w.tcp, reference.steps[k].eef) < 1e-4, `step ${k + 1}`)
    if (success === null && w.success()) success = k + 1
  })
  const expected = reference.steps.findIndex((step) => step.success) + 1
  assert.ok(success !== null && Math.abs(success - expected) <= 10, `success at ${success}, robosuite ${expected}`)
  w.dispose()
})

// robosuite reported its camera and robot observations from kinematics a
// substep before the exported state, so hand-borne values agree within 1e-4
// (under 0.03 px for the wrist camera at 384 px).
const EXTRINSICS_TOLERANCE = { external: 1e-6, wrist: 1e-4 }

test('the live cameras reproduce robosuite calibration and the init state starts unsolved', async () => {
  for (const task of Object.keys(LIBERO_TASKS)) {
    const w = await world(task)
    try {
      const exported = w.episode.cameras
      for (const view of VIEWS) {
        const pose = w.cameraPose(CAMERAS[view])
        const live = calibration(pose.position, pose.xmat, pose.fovy, exported.size)
        assert.ok(maxAbs(live.intrinsics.flat(), exported[view].intrinsics.flat()) < 1e-6, `${task} ${view} intrinsics`)
        const error = maxAbs(live.camera_to_world.flat(), exported[view].camera_to_world.flat())
        assert.ok(error < EXTRINSICS_TOLERANCE[view], `${task} ${view} extrinsics ${error}`)
      }
      assert.equal(w.success(), false)
      assert.ok(maxAbs(w.tcp, w.episode.observation.tcp) < 1e-4, 'TCP as robot0_eef_pos')
      assert.ok(maxAbs(w.quaternionXyzw, w.episode.observation.quat_xyzw) < 1e-4, 'hand quaternion as robot0_eef_quat')
    } finally {
      w.dispose()
    }
  }
})

// Catch an init state that is not the one robosuite settled, or an index the
// scene does not carry being accepted.
test('every exported init state starts unsolved where robosuite left the robot', async () => {
  for (const task of Object.keys(LIBERO_TASKS)) {
    const { EPISODE, PHYSICS } = await liberoScene(task)
    assert.equal(EPISODE.inits.length, LIBERO_INITS)
    assert.deepEqual(
      EPISODE.inits.map((init) => init.index),
      Array.from({ length: LIBERO_INITS }, (_, i) => i)
    )
    assert.equal(EPISODE.inits[0].settled_state_sha256, EPISODE.settled_state_sha256)
    for (let init = 0; init < LIBERO_INITS; init++) {
      const w = await world(task, init)
      try {
        const exported = EPISODE.inits[init]
        assert.equal(w.success(), false, `${task} init ${init} starts solved`)
        assert.ok(maxAbs(w.tcp, exported.observation.tcp) < 1e-4, `${task} init ${init} TCP`)
        assert.ok(exported.physics_check.hull_max_deviation_m < 1e-4, `${task} init ${init} collision hulls`)
      } finally {
        w.dispose()
      }
    }
    for (const init of [-1, LIBERO_INITS, 0.5]) {
      assert.throws(() => LiberoWorld.create(mujoco, { physics: PHYSICS, episode: EPISODE, init }), /初始状态无效/)
    }
  }
})

// Catch the legacy njmax/nconmax sizing returning: it reserved 1.26 GiB per
// MjData, so a world and its replay scratch data overflowed the WASM heap.
test('each LIBERO model reserves a bounded constraint arena', async () => {
  for (const task of Object.keys(LIBERO_TASKS)) {
    const w = await world(task)
    try {
      assert.ok(w.model.narena <= 16 * 2 ** 20, `${task} arena ${w.model.narena}`)
      w.poses(w.qpos)
    } finally {
      w.dispose()
    }
  }
})

function syntheticPacket(depth = 1) {
  // MuJoCo camera axes as xmat columns: x right (0, 1, 0), y up, z back; it looks along (-0.8, 0, -0.6).
  const pose = { position: [0.5, 0, 1.6], xmat: [0, -0.6, 0.8, 1, 0, 0, 0, 0.8, 0.6], fovy: 45 }
  const packet = calibration(pose.position, pose.xmat, pose.fovy, 384)
  packet.depth = new Float32Array(384 * 384).fill(depth)
  return packet
}

test('back-projection and projection invert each other on a calibrated camera', () => {
  const packet = syntheticPacket(1.2)
  for (const pixel of [[192, 192], [10, 300], [383, 0]]) {
    const { xyz, grounding } = backproject(packet, pixel)
    assert.deepEqual(grounding.camera_pixel, pixel)
    assert.equal(grounding.depth_m, Math.fround(1.2))
    const uv = project(packet, xyz)
    assert.ok(maxAbs(uv, pixel) < 1e-6, JSON.stringify({ pixel, uv }))
  }
  assert.equal(project(packet, [0.5, 0, 3]), null, 'a point behind the camera has no pixel')
})

const observation = { task: 'close the top drawer', step: 0, tcp: [-0.2, 0, 1.18], quaternion_xyzw: [1, 0, 0, 0], gripper_qpos: [0.04, -0.04] }
const answer = (patch = {}) => ({
  stage: 'approach',
  intent: 'Move above the drawer handle.',
  visual_evidence: 'The drawer front is visible.',
  target: { kind: 'relative', delta_m: [0.05, 0, 0] },
  rotation_delta: [0, 0, 0],
  gripper: 'close',
  max_motor_steps: 4,
  ...patch
})

// Catch a malformed or out-of-bounds plan being grounded instead of refused.
test('a plan is grounded only when it matches the waypoint schema and bounds exactly', () => {
  const packets = { external: syntheticPacket(1), wrist: syntheticPacket(0.01) }
  const relative = resolvePlan(answer(), observation, packets)
  assert.ok(maxAbs(relative.target_xyz, [-0.15, 0, 1.18]) < 1e-12)
  const pixel = resolvePlan(answer({ target: { kind: 'pixel', camera: 'external', pixel: [192, 192], offset_m: [0, 0, 0.1] } }), observation, packets)
  assert.equal(pixel.grounding.camera, 'external')
  assert.ok(Math.abs(pixel.target_xyz[2] - (1.6 - 0.6 + 0.1)) < 1e-6)
  for (const [patch, message] of [
    [{ extra: 1 }, '视觉规划不符合航点格式'],
    [{ stage: '' }, '公开规划描述无效'],
    [{ intent: 'x'.repeat(501) }, '公开规划描述无效'],
    [{ gripper: 'grip' }, '夹爪目标无效'],
    [{ max_motor_steps: 9 }, '航点有效步数无效'],
    [{ max_motor_steps: 2.5 }, '航点有效步数无效'],
    [{ rotation_delta: [0.6, 0, 0] }, '数值超出声明范围'],
    [{ target: { kind: 'relative', delta_m: [0.21, 0, 0] } }, '数值超出声明范围'],
    [{ target: { kind: 'relative', delta_m: [0, 0, 0], extra: 1 } }, '目标必须是 pixel、relative 或 world'],
    [{ target: { kind: 'world', xyz_m: [0, 0, 2] } }, '视觉航点超出声明的世界工作区'],
    [{ target: { kind: 'pixel', camera: 'side', pixel: [1, 1], offset_m: [0, 0, 0] } }, '未知相机'],
    [{ target: { kind: 'pixel', camera: 'external', pixel: [384, 1], offset_m: [0, 0, 0] } }, '目标像素在相机图像之外'],
    [{ target: { kind: 'pixel', camera: 'wrist', pixel: [1, 1], offset_m: [0, 0, 0] } }, '目标像素的深度无效或太远'],
    [{ target: { kind: 'pixel', camera: 'external', pixel: ['1', 1], offset_m: [0, 0, 0] } }, '应为 2 个有限数值']
  ]) {
    assert.throws(() => resolvePlan(answer(patch), observation, packets), (error) => error instanceof PlanError && error.message === message, JSON.stringify(patch))
  }
  assert.throws(() => resolvePlan(answer({ target: { kind: 'pixel', camera: 'external', pixel: [1, 1], offset_m: [0, 0, 0] } }), observation, {}), PlanError)
})

test('the local controller moves each axis toward the waypoint with the upstream magnitude rule', () => {
  const plan = resolvePlan(answer({ target: { kind: 'relative', delta_m: [0.2, -0.003, -0.01] } }), observation, {})
  const state = localState(observation, plan, -1)
  assert.equal(reached(state), false)
  const action = motorAction(state)
  assert.equal(action.length, 7)
  assert.equal(action[0], 0.5, '0.2 m clips at the 0.5 action scale')
  assert.equal(action[1], 0, 'inside the 5 mm tolerance')
  assert.ok(Math.abs(action[2] + 0.04) < 1e-12, '-0.01 m / (0.05 m x 5)')
  assert.deepEqual(action.slice(3, 6), [0, 0, 0])
  assert.equal(action[6], 1)
  assert.equal(motorAction(localState(observation, { ...plan, gripper: 'hold' }, -1))[6], -1)
  const there = resolvePlan(answer({ target: { kind: 'relative', delta_m: [0.004, 0, 0] } }), observation, {})
  assert.equal(reached(localState(observation, there, 1)), true)
})

// Catch the reference baseline losing either task from any exported init
// state: both run through the same schema, grounding and local controller as
// the vision planner.
test('the privileged reference planner closes both LIBERO tasks from every init state within the budget', async () => {
  for (const [task, budget] of [['libero-drawer', 200], ['libero-microwave', 500]]) {
    for (let init = 0; init < LIBERO_INITS; init++) {
      const session = await LiberoSession.create(mujoco, { task, planner: 'reference', init, speed: 0 })
      const snapshot = await finish(session)
      assert.equal(snapshot.status, 'completed', `${task} init ${init}: ${snapshot.message}`)
      assert.equal(snapshot.init, init)
      assert.ok(snapshot.frame.observation.success)
      assert.ok(snapshot.steps <= budget, `${task} init ${init} took ${snapshot.steps} steps`)
      assert.equal(snapshot.model_calls, 0)
      assert.ok(snapshot.history.every((record) => !record.model_call && record.plan.visual_evidence.startsWith('Privileged')))
      const replay = session.replayFrame(0)
      assert.equal(replay.observation.step, 0)
      assert.equal(replay.poses.xpos.length, session.world.model.nbody * 3)
      await session.dispose()
    }
  }
})

test('the reference planner names a calibrated pixel when a camera sees the waypoint', async () => {
  const w = await world('libero-drawer')
  const planner = new ReferencePlanner('libero-drawer', w)
  assert.equal(planner.propose({ observation: w.observation(), packets: null, reason: 'initial' }).target.kind, 'relative')
  const pose = w.cameraPose(CAMERAS.external)
  const packet = calibration(pose.position, pose.xmat, pose.fovy, 384)
  const forward = [-pose.xmat[2], -pose.xmat[5], -pose.xmat[8]]
  const axial = [0, 0, 1.178].reduce((sum, value, i) => sum + forward[i] * (value - pose.position[i]), 0)
  packet.depth = new Float32Array(384 * 384).fill(axial)
  const next = planner.propose({ observation: w.observation(), packets: { external: packet }, reason: 'reached' })
  assert.equal(next.target.kind, 'pixel')
  const plan = resolvePlan(next, w.observation(), { external: packet })
  assert.ok(maxAbs(plan.target_xyz, [0, 0, 1.178]) < 1e-9)
  w.dispose()
})

// Catch a refused or failed vision turn being replaced by motion.
test('an invalid plan or an unavailable model stops the episode before any motion', async () => {
  for (const propose of [
    async () => ({ answer: answer({ gripper: 'grip' }), model: 'm', model_call: true, latency_ms: 5 }),
    async () => ({ error: '视觉模型不可用（standalone），已停止；没有使用规则替代。' })
  ]) {
    const session = await LiberoSession.create(mujoco, { task: 'libero-drawer', planner: 'vision', propose, speed: 0 })
    const snapshot = await finish(session)
    assert.equal(snapshot.status, 'error')
    assert.equal(snapshot.steps, 0)
    assert.equal(snapshot.frame_count, 1)
    assert.ok(snapshot.message)
    await session.dispose()
  }
})

test('a planner that never progresses exhausts the plan budget and is not counted as success', async () => {
  let calls = 0
  const propose = async ({ observation: seen, packets, previous, recent, reason }) => {
    calls += 1
    assert.equal(packets, null)
    assert.equal(typeof seen.task, 'string')
    if (calls > 1) assert.ok(previous && Array.isArray(recent) && reason)
    return { answer: answer({ target: { kind: 'relative', delta_m: [0, 0, 0] }, max_motor_steps: 1 }), model: 'm', model_call: true, latency_ms: 1 }
  }
  const session = await LiberoSession.create(mujoco, { task: 'libero-drawer', planner: 'vision', propose, speed: 0 })
  const snapshot = await finish(session)
  assert.equal(snapshot.status, 'exhausted')
  assert.equal(snapshot.cycles, MAX_PLANS)
  assert.equal(snapshot.model_calls, MAX_PLANS)
  assert.ok(snapshot.steps <= MAX_STEPS)
  await session.dispose()
})

test('the batch report keeps every planner, task and run within the view state limits', () => {
  const plan = evaluationPlan({ tasks: Object.keys(LIBERO_TASKS), planners: ['vision', 'reference'], runs: LIBERO_INITS })
  assert.equal(plan.length, 4 * LIBERO_INITS)
  assert.deepEqual(plan[0], { planner: 'vision', task: 'libero-drawer', run: 0, init: 0 })
  assert.ok(plan.every((item) => item.init === item.run))
  assert.throws(() => evaluationPlan({ tasks: ['transfer'], planners: ['vision'], runs: 1 }))
  assert.throws(() => evaluationPlan({ tasks: ['libero-drawer'], planners: ['oracle'], runs: 1 }))
  assert.throws(() => evaluationPlan({ tasks: ['libero-drawer'], planners: ['vision'], runs: LIBERO_INITS + 1 }))
  const history = Array.from({ length: MAX_PLANS }, (_, i) => ({ model_call: true, latency_ms: 1000 + i, model: 'bailian/deepseek-v4.1-flash', plan: { target: { kind: 'pixel' } } }))
  const snapshot = {
    task: 'libero-microwave',
    planner: 'vision',
    status: 'exhausted',
    steps: MAX_STEPS,
    max_steps: MAX_STEPS,
    cycles: MAX_PLANS,
    max_cycles: MAX_PLANS,
    history,
    message: 'x'.repeat(400),
    model_calls: MAX_PLANS,
    frame: { observation: { goal_qpos: [-0.123456789], sim_seconds: 30 } },
    wall_seconds: 120.5
  }
  const results = plan.map((item) => episodeResult({ ...snapshot, task: item.task, planner: item.planner, init: item.init }, item.run))
  assert.equal(results.at(-1).init, LIBERO_INITS - 1)
  assert.equal(results[0].message.length, 160)
  assert.equal(results[0].pixel_targets, MAX_PLANS)
  const report = evaluationReport({ plan, results, complete: true })
  assert.equal(report.summary.length, 4)
  assert.equal(report.summary[0].success_rate, 0)
  const text = reportState(report)
  assert.ok(text && new TextEncoder().encode(text).length <= STATE_BYTES)
  assert.deepEqual(storedReport(text), report)
  assert.equal(storedReport('{"format":"g1-arm-batch-v1","results":[],"summary":[]}'), null)
})
