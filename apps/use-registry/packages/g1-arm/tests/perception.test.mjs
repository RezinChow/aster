import assert from 'node:assert/strict'
import test from 'node:test'

import { loadMujoco } from '../ui/workbench/engine.js'
import {
  HELD_MEMORY_SECONDS,
  OBJECT_MEMORY_SECONDS,
  Perception,
  PerceptionUnavailable,
  estimateScene,
  externalCalibration,
  percentile,
  wristCalibration
} from '../ui/workbench/perception.js'
import { Session } from '../ui/workbench/session.js'
import { TASKS } from '../ui/workbench/world.js'

const mujoco = await loadMujoco()
const close = (actual, expected, tolerance, label) =>
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) <= tolerance, `${label}: ${actual} vs ${expected}`))

test('the camera calibrations match MuJoCo for the G1 external view and the wrist mount', () => {
  // MuJoCo 3.3.7 mjv camera for lookat (.43, 0, .035), distance 1.05, azimuth 120, elevation -65, fovy 45.
  const external = externalCalibration()
  close(external.position, [0.6518746018, -0.3842980564, 0.986623168], 1e-6, 'external position')
  close(external.forward, [-0.211309135, 0.3659981489, -0.9063078165], 1e-6, 'external forward')
  close(external.up, [-0.4531539083, 0.7848855853, 0.42261827], 1e-6, 'external up')
  // MuJoCo keeps the frustum in float32.
  assert.ok(Math.abs(external.fy - 579.4112674354) < 1e-4)
  assert.deepEqual([external.cx, external.cy], [319.5, 239.5])
  // wrist_camera at hand pos .045 0 .025, xyaxes "1 0 0 0 -1 0", fovy 80, on this hand pose.
  const hand = [
    0.3832067915, -0.0805159378, 0.318546198, 0.9998761309, 0.0055371531, -0.0147330483, 0.0056601234, -0.9999493857,
    0.0083179977, -0.0146862446, -0.0084003583, -0.9998568639
  ]
  const wrist = wristCalibration(hand)
  close(wrist.position, [0.4278329015, -0.0800532848, 0.2928888798], 1e-6, 'wrist position')
  close(wrist.forward, [-0.0147330482, 0.0083179977, -0.9998568892], 1e-6, 'wrist forward')
  close(wrist.up, [-0.0055371532, 0.9999493957, 0.0084003583], 1e-6, 'wrist up')
  assert.ok(Math.abs(wrist.fy - 286.0208657016) < 1e-4)
})

test('percentile interpolates linearly as numpy does', () => {
  assert.equal(percentile([1, 2, 3, 4, 5], 50), 3)
  assert.ok(Math.abs(percentile([0, 10], 95) - 9.5) < 1e-12)
  assert.ok(Math.abs(percentile([4, 1, 3, 2], 15) - 1.45) < 1e-12)
})

// A ray-cast RGB-D frame of axis-aligned coloured boxes: { center, half, rgb }.
function rayFrame(boxes, calibration) {
  const { width, height, position, forward, up, fx, fy, cx, cy } = calibration
  const right = [forward[1] * up[2] - forward[2] * up[1], forward[2] * up[0] - forward[0] * up[2], forward[0] * up[1] - forward[1] * up[0]]
  const rgb = new Uint8Array(width * height * 3).fill(238)
  const depth = new Float32Array(width * height)
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const a = (column - cx) / fx
      const b = (cy - row) / fy
      // forward has unit length, so the ray parameter is the axial depth.
      const d = [0, 1, 2].map((k) => forward[k] + a * right[k] + b * up[k])
      let best = Infinity
      let hit = null
      for (const box of boxes) {
        let near = -Infinity
        let far = Infinity
        for (let k = 0; k < 3; k += 1) {
          const t1 = (box.center[k] - box.half[k] - position[k]) / d[k]
          const t2 = (box.center[k] + box.half[k] - position[k]) / d[k]
          near = Math.max(near, Math.min(t1, t2))
          far = Math.min(far, Math.max(t1, t2))
        }
        if (near <= far && near > 0 && near < best) {
          best = near
          hit = box
        }
      }
      if (!hit) continue
      const i = row * width + column
      depth[i] = best
      rgb.set(hit.rgb, i * 3)
    }
  }
  return { rgb, depth, calibration }
}

const GREY = [207, 214, 217]
const RED = [224, 48, 48]
const BLUE = [26, 112, 184]
const YELLOW = [237, 168, 38]
function sceneBoxes(task, cube, { withCube = true } = {}) {
  const boxes = [{ center: [0.32, 0, -0.025], half: [0.55, 0.43, 0.025], rgb: GREY }]
  if (withCube) boxes.push({ center: cube, half: [0.02, 0.02, 0.02], rgb: RED })
  if (task === 'stack') boxes.push({ center: [0.43, 0.18, 0.02], half: [0.03, 0.03, 0.02], rgb: BLUE })
  else {
    boxes.push({ center: [0.43, 0.18, 0.003], half: [0.07, 0.07, 0.003], rgb: BLUE })
    for (const [x, y, sx, sy] of [
      [0.354, 0.18, 0.006, 0.082],
      [0.506, 0.18, 0.006, 0.082],
      [0.43, 0.104, 0.07, 0.006],
      [0.43, 0.256, 0.07, 0.006]
    ]) {
      boxes.push({ center: [x, y, 0.012], half: [sx, sy, 0.012], rgb: BLUE })
    }
  }
  if (task === 'barrier') boxes.push({ center: [0.43, 0, 0.055], half: [0.115, 0.018, 0.055], rgb: YELLOW })
  return boxes
}

test('colour and depth recover the cube, the destination and the barrier from pixels alone', () => {
  const cube = [0.405, -0.184, 0.02]
  for (const task of ['transfer', 'stack', 'barrier']) {
    const found = estimateScene(rayFrame(sceneBoxes(task, cube), externalCalibration()), task)
    close(found.object.position, cube, 0.0015, `${task} cube`)
    close(found.destination.position, [0.43, 0.18, TASKS[task].target_z], 0.0015, `${task} destination`)
    if (task === 'barrier') close(found.barrier.position.slice(0, 2), [0.43, 0], 0.003, 'barrier')
    else assert.equal(found.barrier, undefined)
    assert.ok(found.object.extent_xy_m.every((size) => size > 0.035 && size < 0.041))
  }
})

test('an occluded cube is tracked for a bounded time, then perception refuses instead of using the simulator', () => {
  const cube = [0.405, -0.184, 0.02]
  const calibration = externalCalibration()
  const seen = { external: rayFrame(sceneBoxes('transfer', cube), calibration) }
  const hidden = { external: rayFrame(sceneBoxes('transfer', cube, { withCube: false }), calibration) }
  const perception = new Perception('transfer', { views: ['external'] })
  const sensors = (simTime, extra = {}) => ({
    tcp: [0.38, -0.08, 0.22],
    closed: false,
    fingers: [],
    support: false,
    forbidden: false,
    contactSeconds: 0,
    simTime,
    goal: TASKS.transfer.goal,
    sceneName: TASKS.transfer.name,
    ...extra
  })
  const first = perception.observe(seen, sensors(0))
  assert.equal(first.perception.status, 'ready')
  assert.equal(first.source, 'RGB-D estimates + simulated proprioception')
  const tracked = perception.observe(hidden, sensors(OBJECT_MEMORY_SECONDS - 0.5))
  assert.equal(tracked.perception.status, 'partial')
  assert.equal(tracked.perception.objects[0].method, 'last_seen_static')
  assert.deepEqual(tracked.object, first.object)
  assert.throws(() => perception.observe(hidden, sensors(OBJECT_MEMORY_SECONDS + 0.5)), PerceptionUnavailable)
  assert.equal(perception.history.at(-1).status, 'unavailable')

  // Held: the hidden cube follows the TCP by the offset measured while visible.
  const held = new Perception('transfer', { views: ['external'] })
  const grip = { closed: true, fingers: ['left', 'right'] }
  held.observe(seen, sensors(0, { tcp: [0.405, -0.184, 0.021], ...grip }))
  const carried = held.observe(hidden, sensors(HELD_MEMORY_SECONDS - 1, { tcp: [0.405, -0.184, 0.121], ...grip }))
  assert.equal(carried.perception.objects[0].method, 'last_seen_plus_tcp_contact')
  close(carried.object, [cube[0], cube[1], cube[2] + 0.1], 0.0015, 'carried cube')
})

test('a session decides on the observation hook and stops when perception refuses', async () => {
  let calls = 0
  const seen = []
  const observe = (world) => {
    calls += 1
    if (calls > 1) throw new PerceptionUnavailable('看不到必需的方块、目标或障碍，且没有有效视觉定位；已停止，未使用仿真真值补齐。')
    const observation = world.observe()
    observation.object = observation.object.map((value, i) => (i === 0 ? value + 0.003 : value))
    return observation
  }
  const choose = async (_stage, request) => {
    seen.push(request.state.observation.object)
    return { choice: request.baseline_choice, source: 'rule' }
  }
  const session = await Session.create(mujoco, { task: 'transfer', seed: 0, speed: 0, choose, mode: 'rgbd', observe })
  const truth = session.world.cube
  session.start()
  await session.loop
  const snapshot = session.snapshot()
  await session.dispose()
  assert.equal(snapshot.observation_mode, 'rgbd')
  assert.ok(Math.abs(seen[0][0] - (truth[0] + 0.003)) < 1e-4, 'the decision saw the hook observation, not the simulator')
  assert.equal(snapshot.status, 'error')
  assert.match(snapshot.message, /未使用仿真真值补齐/)
  assert.equal(snapshot.cycles, 1)
})
