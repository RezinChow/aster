// The LIBERO visual-waypoint protocol (EmbodiedJev libero-rgbd-waypoint-v1,
// MIT): a planner names a target pixel in a calibrated camera, its rendered
// metric depth back-projects it to a world waypoint, and a local controller
// drives OSC_POSE toward it in 5-step actions. Ported from libero_policy.py.
import { axisAngleMatrix, orientationError } from './libero-world.js'

export const PROTOCOL = 'libero-rgbd-waypoint-v1'
export const AXES = ['x', 'y', 'z', 'rx', 'ry', 'rz']
export const VIEWS = ['external', 'wrist']
export const CAMERAS = { external: 'agentview', wrist: 'robot0_eye_in_hand' }
export const IMAGE_SIZE = 384
export const ACTION_REPEAT = 5
export const ACTION_SCALE = 0.5
export const MAX_STEPS = 600
export const MAX_PLANS = 60
export const STALL_BLOCKS = 3
export const STALL_MOVEMENT_M = 0.001
const POSITION_TOLERANCE = 0.005
const ROTATION_TOLERANCE = 0.025
const OFFSET_LIMIT = 0.2
const ROTATION_LIMIT = 0.5
const TEXT_LIMIT = 500
const PLAN_FIELDS = ['stage', 'intent', 'visual_evidence', 'target', 'rotation_delta', 'gripper', 'max_motor_steps']

export class PlanError extends Error {}

const fail = (message) => {
  throw new PlanError(message)
}
const sameKeys = (value, keys) => {
  const names = Object.keys(value)
  return names.length === keys.length && keys.every((key) => names.includes(key))
}

export function vector(value, size, bound) {
  if (!Array.isArray(value) || value.length !== size || !value.every((x) => typeof x === 'number' && Number.isFinite(x))) {
    fail(`应为 ${size} 个有限数值`)
  }
  if (bound !== undefined && value.some((x) => Math.abs(x) > bound)) fail('数值超出声明范围')
  return [...value]
}

/** Row-major 3x3 from an x, y, z, w quaternion. */
export function quaternionMatrix(quat) {
  const q = vector(quat, 4)
  const norm = Math.hypot(...q)
  if (norm < 1e-10) fail('机器人四元数无效')
  const [x, y, z, w] = q.map((value) => value / norm)
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]
  ]
}

const matMul3 = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]))

/**
 * A calibrated camera like robosuite camera_utils: K with the principal point
 * at the image centre, and camera_to_world for x right, y down, z forward.
 */
export function calibration(position, xmat, fovy, size = IMAGE_SIZE) {
  const f = (0.5 * size) / Math.tan((fovy * Math.PI) / 360)
  const r = [0, 1, 2].map((row) => [xmat[row * 3], -xmat[row * 3 + 1], -xmat[row * 3 + 2]])
  return {
    width: size,
    height: size,
    fovy,
    intrinsics: [
      [f, 0, size / 2],
      [0, f, size / 2],
      [0, 0, 1]
    ],
    camera_to_world: [...r.map((row, i) => [...row, position[i]]), [0, 0, 0, 1]]
  }
}

/** The world point a top-left image pixel sees at its rendered axial depth, or a refusal. */
export function backproject(packet, pixel) {
  const [u0, v0] = vector(pixel, 2)
  if (!(u0 >= 0 && u0 < packet.width && v0 >= 0 && v0 < packet.height)) fail('目标像素在相机图像之外')
  const u = Math.min(Math.round(u0), packet.width - 1)
  const v = Math.min(Math.round(v0), packet.height - 1)
  const depth = packet.depth[v * packet.width + u]
  if (!(depth > 0.05 && depth < 3)) fail('目标像素的深度无效或太远')
  const [[fx, , cx], [, fy, cy]] = packet.intrinsics
  const ray = [((u - cx) / fx) * depth, ((v - cy) / fy) * depth, depth]
  const m = packet.camera_to_world
  const xyz = [0, 1, 2].map((row) => m[row][0] * ray[0] + m[row][1] * ray[1] + m[row][2] * ray[2] + m[row][3])
  return { xyz, grounding: { camera_pixel: [u, v], depth_m: depth, surface_xyz_m: xyz } }
}

/** The pixel a world point projects to, or null behind the camera. */
export function project(packet, point) {
  const m = packet.camera_to_world
  const d = [0, 1, 2].map((i) => point[i] - m[i][3])
  const camera = [0, 1, 2].map((column) => m[0][column] * d[0] + m[1][column] * d[1] + m[2][column] * d[2])
  if (!(camera[2] > 0)) return null
  const [[fx, , cx], [, fy, cy]] = packet.intrinsics
  return [(fx * camera[0]) / camera[2] + cx, (fy * camera[1]) / camera[2] + cy]
}

/**
 * Check a planner answer against the waypoint schema and ground it: the same
 * rules as upstream resolve_plan. Throws PlanError; nothing is substituted.
 */
export function resolvePlan(answer, observation, packets) {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer) || !sameKeys(answer, PLAN_FIELDS)) fail('视觉规划不符合航点格式')
  for (const name of ['stage', 'intent', 'visual_evidence']) {
    if (typeof answer[name] !== 'string' || answer[name].length < 1 || answer[name].length > TEXT_LIMIT) fail('公开规划描述无效')
  }
  if (!['open', 'hold', 'close'].includes(answer.gripper)) fail('夹爪目标无效')
  if (!Number.isInteger(answer.max_motor_steps) || answer.max_motor_steps < 1 || answer.max_motor_steps > 8) fail('航点有效步数无效')
  const target = answer.target
  if (!target || typeof target !== 'object' || Array.isArray(target)) fail('目标无效')
  const source = { kind: target.kind, observation_step: observation.step }
  let xyz
  if (target.kind === 'pixel' && sameKeys(target, ['kind', 'camera', 'pixel', 'offset_m'])) {
    if (!VIEWS.includes(target.camera) || !packets[target.camera]) fail('未知相机')
    const grounded = backproject(packets[target.camera], target.pixel)
    const offset = vector(target.offset_m, 3, OFFSET_LIMIT)
    xyz = grounded.xyz.map((value, i) => value + offset[i])
    Object.assign(source, grounded.grounding, { camera: target.camera, offset_m: offset })
  } else if (target.kind === 'relative' && sameKeys(target, ['kind', 'delta_m'])) {
    const delta = vector(target.delta_m, 3, OFFSET_LIMIT)
    xyz = observation.tcp.map((value, i) => value + delta[i])
  } else if (target.kind === 'world' && sameKeys(target, ['kind', 'xyz_m'])) {
    xyz = vector(target.xyz_m, 3)
  } else {
    fail('目标必须是 pixel、relative 或 world')
  }
  if (Math.abs(xyz[0]) > 1 || Math.abs(xyz[1]) > 1 || !(xyz[2] > 0 && xyz[2] < 1.8)) fail('视觉航点超出声明的世界工作区')
  const rotation = matMul3(axisAngleMatrix(vector(answer.rotation_delta, 3, ROTATION_LIMIT)), quaternionMatrix(observation.quaternion_xyzw))
  return { ...structuredClone(answer), target_xyz: xyz, target_rotation: rotation, grounding: source }
}

/** The error the local controller follows toward the current waypoint. */
export function localState(observation, plan, previousGripper) {
  return {
    position_error_m: plan.target_xyz.map((value, i) => value - observation.tcp[i]),
    rotation_error_rad: orientationError(plan.target_rotation, quaternionMatrix(observation.quaternion_xyzw)),
    gripper_target: plan.gripper,
    previous_gripper_command: previousGripper
  }
}

export function reached(state) {
  return (
    Math.max(...state.position_error_m.map(Math.abs)) <= POSITION_TOLERANCE &&
    Math.max(...state.rotation_error_rad.map(Math.abs)) <= ROTATION_TOLERANCE
  )
}

/**
 * The deterministic local controller: each axis moves by the sign of its error
 * outside tolerance, with upstream's distance-only magnitude. It never picks
 * a target; the waypoint and gripper come from the planner.
 */
export function motorAction(state, repeat = ACTION_REPEAT, scale = ACTION_SCALE) {
  const errors = [...state.position_error_m, ...state.rotation_error_rad]
  const values = errors.map((error, i) => {
    const tolerance = i < 3 ? POSITION_TOLERANCE : ROTATION_TOLERANCE
    const sign = error > tolerance ? 1 : error < -tolerance ? -1 : 0
    const native = i < 3 ? 0.05 : 0.5
    return sign * Math.min(scale, Math.max(0.01, Math.abs(error) / (native * repeat)))
  })
  const fingers = { open: -1, close: 1, hold: state.previous_gripper_command }
  return [...values, fingers[state.gripper_target]]
}
