// Calibrated RGB-D observations for the three coloured-block scenes. Ported from
// EmbodiedJev perception.py (MIT). Object poses come from rendered pixels, not
// MuJoCo body or geometry positions. TCP, gripper and contacts stay simulated
// proprioceptive sensors. This is a small colour detector with a known 4 cm cube
// prior, not a general vision model.
import { TASKS, TRAVEL_Z } from './world.js'

export const CUBE_SIZE_M = 0.04
export const OBJECT_MEMORY_SECONDS = 4
export const HELD_MEMORY_SECONDS = 8
export const DESTINATION_MEMORY_SECONDS = 12
export const IMAGE = { width: 640, height: 480 }
// The stock Panda view (azimuth 180) looks over the G1 forearm; this one sees the block.
export const EXTERNAL_CAMERA = { lookat: [0.43, 0, 0.035], distance: 1.05, azimuth: 120, elevation: -65, fovy: 45 }
// Mounted on the hand at pos .045 0 .025 with xyaxes "1 0 0 0 -1 0": it looks along hand +Z.
export const WRIST_CAMERA = { pos: [0.045, 0, 0.025], fovy: 80 }
export const VIEWS = ['external', 'wrist']
const LABELS = { object: '红色方块', destination: '蓝色目标', barrier: '黄色障碍' }

export class PerceptionUnavailable extends Error {}

const normalize = (v) => {
  const length = Math.hypot(...v)
  return v.map((value) => value / length)
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const round = (value, digits) => Number(value.toFixed(digits))
const focal = (height, fovy) => height / 2 / Math.tan((fovy * Math.PI) / 360)

function calibration(position, forward, up, fovy, { width, height } = IMAGE) {
  const f = focal(height, fovy)
  return { position, forward, up, fovy, fx: f, fy: f, cx: (width - 1) / 2, cy: (height - 1) / 2, width, height }
}

/** MuJoCo's free camera: forward and up from azimuth and elevation, eye at lookat - distance * forward. */
export function externalCalibration(spec = EXTERNAL_CAMERA, image = IMAGE) {
  const az = (spec.azimuth * Math.PI) / 180
  const el = (spec.elevation * Math.PI) / 180
  const forward = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)]
  const up = [-Math.sin(el) * Math.cos(az), -Math.sin(el) * Math.sin(az), Math.cos(el)]
  const position = spec.lookat.map((value, i) => value - spec.distance * forward[i])
  return calibration(position, forward, up, spec.fovy, image)
}

/** The wrist camera from the hand body pose `[x, y, z, R00..R22]` (row-major). */
export function wristCalibration(hand, spec = WRIST_CAMERA, image = IMAGE) {
  const r = hand.slice(3, 12)
  const apply = (v) => [0, 1, 2].map((row) => r[row * 3] * v[0] + r[row * 3 + 1] * v[1] + r[row * 3 + 2] * v[2])
  const offset = apply(spec.pos)
  const position = [hand[0] + offset[0], hand[1] + offset[1], hand[2] + offset[2]]
  return calibration(position, apply([0, 0, 1]), apply([0, -1, 0]), spec.fovy, image)
}

export function serialiseCalibration(c) {
  return {
    position: c.position.map((value) => round(value, 6)),
    forward: c.forward.map((value) => round(value, 6)),
    up: c.up.map((value) => round(value, 6)),
    fx: round(c.fx, 4),
    fy: round(c.fy, 4),
    cx: c.cx,
    cy: c.cy,
    coordinate_frame: 'world',
    units: 'metres'
  }
}

/**
 * Unproject axial depth for the pixels `accept(index)` keeps; image Y points down
 * and world up follows the camera. Returns a flat [x, y, z, ...] Float64Array.
 */
export function backproject(depth, width, accept, c) {
  const forward = normalize(c.forward)
  const up = normalize(c.up)
  const right = normalize(cross(forward, up))
  const out = []
  for (let i = 0; i < depth.length; i += 1) {
    const d = depth[i]
    if (!(d > 0 && d < 5) || !accept(i)) continue
    const column = i % width
    const row = (i - column) / width
    const u = ((column - c.cx) / c.fx) * d
    const v = ((c.cy - row) / c.fy) * d
    for (let k = 0; k < 3; k += 1) out.push(c.position[k] + d * forward[k] + u * right[k] + v * up[k])
  }
  return Float64Array.from(out)
}

/** numpy.percentile with linear interpolation. */
export function percentile(values, q) {
  const sorted = Float64Array.from(values).sort()
  if (!sorted.length) return NaN
  const at = (q / 100) * (sorted.length - 1)
  const low = Math.floor(at)
  const high = Math.min(sorted.length - 1, low + 1)
  return sorted[low] + (sorted[high] - sorted[low]) * (at - low)
}

function extentXY(points, keep) {
  const low = [Infinity, Infinity]
  const high = [-Infinity, -Infinity]
  let count = 0
  for (let i = 0; i < points.length; i += 3) {
    if (!keep(points[i + 2])) continue
    count += 1
    for (let k = 0; k < 2; k += 1) {
      low[k] = Math.min(low[k], points[i + k])
      high[k] = Math.max(high[k], points[i + k])
    }
  }
  return { count, low, high, size: [high[0] - low[0], high[1] - low[1]] }
}

const MASKS = {
  object: (r, g, b) => r > 45 && r > 1.45 * g && r > 1.45 * b,
  destination: (r, g, b) => b > 45 && b > 1.45 * r && b > 1.15 * g,
  barrier: (r, g, b) => r > 80 && g > 60 && r > 1.5 * b && g > 1.3 * b
}

/**
 * Known coloured objects from one RGB-D frame, using no segmentation IDs.
 * frame: { rgb: Uint8Array (w*h*3, top-left origin), depth: Float32Array (w*h, metres), calibration }.
 */
export function estimateScene(frame, task) {
  const { rgb, depth, calibration: c } = frame
  const { width, height } = c
  if (rgb.length !== width * height * 3 || depth.length !== width * height) throw new Error('RGB and depth image sizes must match')
  if (!TASKS[task]) throw new Error('Unknown visual task')
  const detected = {}
  for (const [name, mask] of Object.entries(MASKS)) {
    const raw = backproject(depth, width, (i) => mask(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]), c)
    // The camera looks down on this known tabletop workspace. Filtering by
    // workspace bounds rejects distant background, not hidden simulator IDs.
    const kept = []
    for (let i = 0; i < raw.length; i += 3) {
      const [x, y, z] = [raw[i], raw[i + 1], raw[i + 2]]
      if (z > -0.01 && z < 0.45 && x > 0.15 && x < 0.75 && Math.abs(y) < 0.4) kept.push(x, y, z)
    }
    const points = Float64Array.from(kept)
    const count = points.length / 3
    if (count < 20) continue
    const heights = points.filter((_, i) => i % 3 === 2)
    let position
    let extent
    if (name === 'object') {
      const topZ = percentile(heights, 95)
      extent = extentXY(points, (z) => z >= topZ - 0.004)
      if (extent.count < 16) continue
      // A narrow red sliver behind the gripper is not a reliable centre.
      if (extent.size.some((size) => size < 0.026 || size > 0.065)) continue
      position = [(extent.low[0] + extent.high[0]) / 2, (extent.low[1] + extent.high[1]) / 2, topZ - CUBE_SIZE_M / 2]
    } else {
      // Blue tray floor / block top is the support plane. The destination
      // denotes the centre of the red cube when resting on that plane.
      const surfaceZ = percentile(heights, name === 'destination' && task !== 'stack' ? 15 : 95)
      // A tray's upper rim defines its XY centre without the perspective
      // bias from partly hidden floor pixels. Its lower plane sets height.
      const rimZ = percentile(heights, 95)
      extent = extentXY(points, (z) => Math.abs(z - rimZ) < 0.004)
      if (extent.count < 20) continue
      if (extent.size.some((size) => size < (name === 'destination' ? 0.035 : 0.01))) continue
      position = [
        (extent.low[0] + extent.high[0]) / 2,
        (extent.low[1] + extent.high[1]) / 2,
        name === 'destination' ? surfaceZ + CUBE_SIZE_M / 2 : surfaceZ
      ]
    }
    detected[name] = { position, pixel_count: count, extent_xy_m: extent.size }
  }
  return detected
}

const required = (task) => (task === 'barrier' ? ['object', 'destination', 'barrier'] : ['object', 'destination'])

/**
 * Tracks estimates across captures as VisualObserver does. `observe` takes the
 * captured frames (external first) and the simulated proprioception, and either
 * returns an observation or throws PerceptionUnavailable. Ground truth never
 * fills a missing object.
 */
export class Perception {
  constructor(task, { geometry = true, views = VIEWS } = {}) {
    if (!TASKS[task]) throw new Error('Unknown visual task')
    if (!views.length || views.some((view) => !VIEWS.includes(view))) throw new Error('相机观测需要至少一种有效视角')
    this.task = task
    this.geometry = geometry
    this.views = [...views]
    this.seen = {}
    this.lastTime = null
    this.lastObservation = null
    this.lastTcp = null
    this.lastHeld = false
    this.heldOffset = null
    this.initialObjectZ = null
    this.stableSeconds = 0
    this.maxLift = 0
    this.captureId = 0
    this.history = []
  }

  /** An explicit external intervention can change a frame at the same sim time. */
  invalidate() {
    this.lastTime = null
    this.lastObservation = null
    this.seen = {}
    this.heldOffset = null
    this.lastHeld = false
  }

  tracked(detections, tcp, held, simTime) {
    const rows = []
    const estimates = {}
    for (const name of required(this.task)) {
      const found = detections[name]
      const previous = this.seen[name]
      // On the release boundary the last held estimate is still useful; the
      // next unheld observation must meet the shorter static limit.
      const limit = name === 'object' ? (held || this.lastHeld ? HELD_MEMORY_SECONDS : OBJECT_MEMORY_SECONDS) : DESTINATION_MEMORY_SECONDS
      const age = found ? 0 : previous ? simTime - previous.time : null
      let position = null
      let tracked = false
      let method = 'rgb_colour_and_depth'
      if (found) {
        position = [...found.position]
        this.seen[name] = { position: [...position], time: simTime }
        if (name === 'object' && held) this.heldOffset = position.map((value, i) => value - tcp[i])
      } else if (previous && age <= limit) {
        tracked = true
        position = [...previous.position]
        method = 'last_seen_static'
        if (name === 'object' && held) {
          if (!this.lastHeld || !this.heldOffset) this.heldOffset = position.map((value, i) => value - tcp[i])
          position = tcp.map((value, i) => value + this.heldOffset[i])
          method = 'last_seen_plus_tcp_contact'
        } else if (name === 'object' && this.lastHeld && this.lastTcp && this.heldOffset) {
          position = this.lastTcp.map((value, i) => value + this.heldOffset[i])
          // Keep the propagated release location while retaining the last
          // visual timestamp, so expiry is never silently reset.
          previous.position = [...position]
        }
      }
      if (position) estimates[name] = position
      const row = {
        id: name,
        label: LABELS[name],
        visible: !!found,
        position: position ? position.map((value) => round(value, 5)) : null,
        tracked,
        age_sim_seconds: age === null ? null : round(age, 3),
        method: position ? method : 'unavailable'
      }
      if (found) Object.assign(row, { pixel_count: found.pixel_count, extent_xy_m: found.extent_xy_m.map((v) => round(v, 5)) })
      rows.push(row)
    }
    return { rows, estimates }
  }

  /**
   * frames: { external?: frame, wrist?: frame }. sensors: the simulated
   * proprioception { tcp, closed, fingers, support, forbidden, contactSeconds,
   * simTime, goal, sceneName }.
   */
  observe(frames, sensors) {
    const started = performance.now()
    const { tcp, closed, fingers, support, forbidden, contactSeconds, simTime } = sensors
    if (this.lastTime === simTime && this.lastObservation) return structuredClone(this.lastObservation)
    const detections = {}
    if (this.geometry) {
      // External detections take precedence; another enabled view may fill
      // occluded objects. Disabled views are never rendered or read.
      for (const view of this.views) {
        for (const [name, detection] of Object.entries(estimateScene(frames[view], this.task))) detections[name] ??= detection
      }
    }
    const held = fingers.length === 2 && closed
    const { rows, estimates } = this.geometry ? this.tracked(detections, tcp, held, simTime) : { rows: [], estimates: {} }
    const missing = this.geometry ? required(this.task).filter((name) => !estimates[name]) : []
    this.captureId += 1
    const primary = frames[this.views[0]]
    const metadata = {
      capture_id: this.captureId,
      source: this.geometry ? 'rgbd' : 'vision',
      status: missing.length ? 'unavailable' : rows.some((row) => row.tracked) ? 'partial' : 'ready',
      sim_time: round(simTime, 4),
      latency_ms: 0,
      objects: rows,
      width: primary.calibration.width,
      height: primary.calibration.height,
      calibration: serialiseCalibration(primary.calibration),
      camera_view: this.views.join(' + '),
      camera_views: [...this.views],
      primary_view: this.views[0],
      capture_schedule: 'fresh synchronized views at decision/action boundaries; not a continuous video stream',
      detector: this.geometry ? 'known-colour RGB masks + calibrated metric depth' : 'none; raw RGB to model',
      proprioception: 'simulated TCP, gripper command and finger/support contacts',
      tracking_limits_sim_seconds: {
        unheld_object: OBJECT_MEMORY_SECONDS,
        held_object: HELD_MEMORY_SECONDS,
        destination: DESTINATION_MEMORY_SECONDS
      },
      tracking_assumption: 'static unheld objects; no slip while two finger contacts persist',
      views: Object.fromEntries(
        this.views.map((view) => [view, { calibration: serialiseCalibration(frames[view].calibration), mount: view === 'external' ? 'fixed' : 'robot hand' }])
      )
    }
    if (this.geometry) metadata.cube_size_prior_m = CUBE_SIZE_M
    else metadata.message = '已启用视角的 RGB 图像可用于模型输入；不含物体或目标坐标。'
    if (missing.length) metadata.message = '看不到必需的方块、目标或障碍，且没有有效视觉定位；已停止，未使用仿真真值补齐。'
    else if (rows.some((row) => row.tracked)) metadata.message = '部分物体被遮挡，正在限时使用上次视觉定位与夹爪反馈。'
    metadata.latency_ms = round(performance.now() - started, 2)
    this.history.push(metadata)
    if (missing.length) throw Object.assign(new PerceptionUnavailable(metadata.message), { metadata })
    const common = {
      task: sensors.goal,
      units: 'metres',
      tcp: tcp.map((value) => round(value, 5)),
      gripper: closed ? 'closed' : 'open',
      finger_contacts: [...fingers].sort(),
      held,
      grasp_secured: contactSeconds >= 0.16,
      support_contact: support,
      forbidden_contact: forbidden
    }
    if (!this.geometry) {
      const observation = {
        ...common,
        source: `${this.views.join(' + ')} RGB pixels + simulated proprioception`,
        sim_seconds: round(simTime, 3),
        perception: structuredClone(metadata)
      }
      this.remember(simTime, tcp, held, observation)
      return observation
    }
    const cube = estimates.object
    const target = estimates.destination
    const travelHeight = estimates.barrier ? Math.max(TRAVEL_Z, estimates.barrier[2] + 0.06) : TRAVEL_Z
    if (travelHeight > 0.42) throw new PerceptionUnavailable('视觉估计的障碍高度超出可用工作区，请调整场景')
    const elapsed = this.lastTime === null ? 0 : Math.max(0, simTime - this.lastTime)
    const oldCube = this.lastObservation ? this.lastObservation.object : cube
    const speed = elapsed ? Math.hypot(...cube.map((value, i) => value - oldCube[i])) / elapsed : Infinity
    const aligned = Math.hypot(cube[0] - target[0], cube[1] - target[1]) < 0.025
    const stable = support && aligned && speed < 0.025 && !closed
    this.stableSeconds = stable ? this.stableSeconds + elapsed : 0
    this.initialObjectZ ??= cube[2]
    this.maxLift = Math.max(this.maxLift, cube[2] - this.initialObjectZ)
    const observation = {
      ...common,
      source: 'RGB-D estimates + simulated proprioception',
      scene_name: sensors.sceneName,
      object: cube.map((value) => round(value, 5)),
      destination: target.map((value) => round(value, 5)),
      relative_geometry: {
        tcp_object_xy_distance_m: round(Math.hypot(tcp[0] - cube[0], tcp[1] - cube[1]), 4),
        tcp_above_object_m: round(tcp[2] - cube[2], 4),
        object_destination_xy_distance_m: round(Math.hypot(cube[0] - target[0], cube[1] - target[1]), 4),
        object_above_destination_m: round(cube[2] - target[2], 4),
        travel_tcp_height_m: round(travelHeight, 4)
      },
      stable_seconds: round(this.stableSeconds, 3),
      success: this.stableSeconds >= 0.4 && !closed && tcp[2] >= 0.17,
      max_lift_m: round(this.maxLift, 4),
      sim_seconds: round(simTime, 3),
      perception: structuredClone(metadata)
    }
    if (estimates.barrier) observation.visual_barrier = estimates.barrier.map((value) => round(value, 5))
    this.remember(simTime, tcp, held, observation)
    return observation
  }

  remember(simTime, tcp, held, observation) {
    this.lastTime = simTime
    this.lastTcp = [...tcp]
    this.lastHeld = held
    this.lastObservation = structuredClone(observation)
  }
}
