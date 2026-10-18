// Fixed motor choices and bounded evidence for closed-loop planning. Ported
// from EmbodiedJev incremental.py (MIT). The menu is a fixed motor vocabulary
// with no object-derived waypoints; workspace-invalid moves stay visible as
// rejected options and are never clipped.
import { baselinePhase, candidates } from './planning.js'
import { WORKSPACE } from './world.js'

export const PROMPT_VERSION = 'incremental-planning-v2'
export const PLANNING_INSTRUCTIONS =
  'Plan toward the stated task goal using the current sensors and recent actual outcomes. ' +
  'Choose exactly one offered fixed incremental robot action for this decision; the next ' +
  'decision receives a new observation. Coordinates and increments are in metres in the ' +
  'world XYZ frame, not image pixels. Use the camera calibration to interpret image ' +
  'directions. A translation preserves the gripper command. Closing the gripper does not ' +
  'prove a grasp: held means both fingers contact the object while closed. Support contact ' +
  'reports physical contact, not proof of correct placement. Account for obstacles, ' +
  'occlusion, observed movement, rejected actions and discrepancies from your intended ' +
  'outcome. No task phase or movement sequence is prescribed. The action IDs and step ' +
  'sizes are fixed; do not invent an action or assume automatic alignment. If an image ' +
  'is attached, use its visible evidence alongside the available sensors; missing object ' +
  'coordinates are unknown, not zero. You may give a brief public intent and a short ' +
  'visual_evidence description of what is visibly supported, not private reasoning.'

const STEPS = [
  [40, 0.04],
  [10, 0.01],
  [2, 0.002]
]
const SENSORS = ['source', 'tcp', 'gripper', 'held', 'finger_contacts', 'grasp_secured', 'support_contact', 'forbidden_contact', 'sim_seconds']
const VISUAL_POSES = ['object', 'destination', 'visual_barrier']
const CAMERA_FIELDS = ['source', 'capture_id', 'status', 'sim_time', 'age_sim_seconds', 'width', 'height', 'camera_view', 'depth_units', 'message']
const CALIBRATION_FIELDS = ['position', 'forward', 'up', 'fx', 'fy', 'cx', 'cy', 'coordinate_frame', 'units']
const DETECTION_FIELDS = ['id', 'label', 'visible', 'position', 'tracked', 'age_sim_seconds', 'method', 'pixel_count', 'extent_xy_m']
export const GOAL_CONDITIONS = {
  object: 'resting stably in/on the requested destination for at least 0.4 seconds',
  gripper: 'open and no longer holding the object',
  final_tcp_z_min_m: 0.17
}

const copy = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
const pick = (row, keys) => Object.fromEntries(keys.filter((key) => key in row).map((key) => [key, copy(row[key])]))
const round = (value, digits) => Number(value.toFixed(digits))

function measuredTcp(observation) {
  const point = observation.tcp
  if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) throw new Error('TCP must contain three finite coordinates')
  return [...point]
}

/** All 21 motor commands around the measured TCP. Out-of-workspace targets are rejected, not clipped. */
export function incrementalCandidates(observation) {
  const point = measuredTcp(observation)
  const result = []
  for (const [axis, name] of ['x', 'y', 'z'].entries()) {
    for (const [sign, direction] of [
      [1, 'pos'],
      [-1, 'neg']
    ]) {
      for (const [millimetres, step] of STEPS) {
        const target = [...point]
        target[axis] += sign * step
        const signed = (sign * step).toFixed(3)
        result.push({
          id: `${name}_${direction}_${millimetres}`,
          label: `${name.toUpperCase()} ${sign > 0 ? '+' : ''}${signed} m`,
          phase: 'incremental',
          target,
          gripper: null,
          seconds: 0.45,
          admitted: true,
          rejection: null,
          preview: null
        })
      }
    }
  }
  result.push(
    { id: 'open', label: '张开夹爪', phase: 'incremental', target: [...point], gripper: 'open', seconds: 0.65, admitted: true, rejection: null, preview: null },
    { id: 'close', label: '闭合夹爪', phase: 'incremental', target: [...point], gripper: 'close', seconds: 0.65, admitted: true, rejection: null, preview: null },
    { id: 'hold', label: '保持当前位姿', phase: 'incremental', target: [...point], gripper: null, seconds: 0.3, admitted: true, rejection: null, preview: null }
  )
  for (const option of result) {
    if (option.target.some((value, i) => value < WORKSPACE[0][i] || value > WORKSPACE[1][i])) {
      option.admitted = false
      option.rejection = 'Target outside workspace; fixed increment was not clipped'
    }
  }
  return result
}

/** The offered menu: each admitted option with its world-frame delta, gripper command, and duration. */
export function incrementalMenu(options, observation) {
  const tcp = measuredTcp(observation)
  return Object.fromEntries(
    options
      .filter((option) => option.admitted)
      .map((option) => [
        option.id,
        JSON.stringify({ delta_xyz: option.target.map((value, i) => round(value - tcp[i], 5)), gripper: option.gripper, seconds: option.seconds })
      ])
  )
}

const imageOnly = (observation) => observation?.perception?.source === 'vision'

function sensorEvidence(observation, { image = false, camera = true } = {}) {
  const evidence = pick(observation, SENSORS)
  if ('task' in observation) evidence.goal = observation.task
  evidence.units = 'metres'
  if (!image) Object.assign(evidence, pick(observation, VISUAL_POSES))
  const perception = observation.perception
  if (camera && perception && typeof perception === 'object') {
    const metadata = pick(perception, CAMERA_FIELDS)
    if (perception.calibration) metadata.calibration = pick(perception.calibration, CALIBRATION_FIELDS)
    if (perception.views) {
      metadata.views = Object.fromEntries(
        Object.entries(perception.views)
          .filter(([name]) => name === 'external' || name === 'wrist')
          .map(([name, row]) => [name, { mount: row.mount, calibration: pick(row.calibration ?? {}, CALIBRATION_FIELDS) }])
      )
    }
    if (!image && Array.isArray(perception.objects)) metadata.objects = perception.objects.slice(0, 3).map((row) => pick(row, DETECTION_FIELDS))
    evidence.perception = metadata
  }
  return evidence
}

function publicIntention(record) {
  const decision = record.decision ?? {}
  return Object.fromEntries(
    ['intent', 'visual_evidence'].filter((key) => typeof decision[key] === 'string' && decision[key]).map((key) => [key, decision[key].slice(0, 240)])
  )
}

/**
 * Actual sensors and the last six attempted actions, never an oracle. Direct
 * vision does not inherit object poses from history. Success truth, rollout
 * predictions, travel height and image bytes are outside this evidence.
 */
export function planningState(observation, history) {
  const image = imageOnly(observation)
  const state = { observation: sensorEvidence(observation, { image }), goal_conditions: copy(GOAL_CONDITIONS), recent_outcomes: [] }
  for (const record of history.slice(-6)) {
    const before = record.before ?? {}
    const after = record.after ?? {}
    const action = record.action ?? {}
    const transition = {
      cycle: record.cycle,
      option: action.id,
      executed: record.executed ?? true,
      after: sensorEvidence(after, { image: image || imageOnly(after), camera: false })
    }
    if (action.target) transition.target_tcp = copy(action.target)
    transition.gripper_command = action.gripper ?? 'unchanged'
    if ('seconds' in action) transition.duration_seconds = action.seconds
    if (before.tcp && after.tcp) transition.tcp_delta_m = after.tcp.map((value, i) => round(value - before.tcp[i], 5))
    if (!image && !imageOnly(before) && !imageOnly(after) && before.object && after.object) {
      transition.object_delta_m = after.object.map((value, i) => round(value - before.object[i], 5))
    }
    const rejection = record.rejection ?? action.rejection
    if (rejection) transition.rejection = String(rejection).slice(0, 240)
    const intention = publicIntention(record)
    if (Object.keys(intention).length) transition.public_intention = intention
    state.recent_outcomes.push(transition)
  }
  if (history.length) {
    const intention = publicIntention(history.at(-1))
    if (Object.keys(intention).length) state.previous_intention = intention
  }
  return state
}

/**
 * The scripted skill quantized to the same fixed menu, for the explicitly
 * selected baseline and for tests. It is never a fallback for a model and
 * never ranks or prunes model options.
 */
export function baselineChoice(observation, options) {
  if (imageOnly(observation) || !observation.object || !observation.destination) {
    throw new Error('The rule baseline requires measured object and destination coordinates')
  }
  const legal = new Map(options.filter((option) => option.admitted).map((option) => [option.id, option]))
  if (legal.size === 0) throw new Error('No admitted incremental action')
  const desired = candidates(null, baselinePhase(observation), observation)[0]
  if (desired.gripper && legal.has(desired.gripper)) {
    const actual = observation.gripper === 'closed' ? 'close' : 'open'
    if (desired.gripper !== actual) return desired.gripper
  }
  const point = measuredTcp(observation)
  const away = (target) => Math.hypot(...target.map((value, i) => value - desired.target[i]))
  const current = away(point)
  let best = null
  for (const option of legal.values()) {
    if (['open', 'close', 'hold'].includes(option.id)) continue
    if (!best || away(option.target) < away(best.target)) best = option
  }
  if (best && away(best.target) < current - 1e-6) return best.id
  if (legal.has('hold')) return 'hold'
  throw new Error('No admitted baseline motion makes progress')
}

/** Three repeats of one action with no pose or contact change stop the episode; nothing is substituted. */
export function incrementalStalled(history) {
  if (history.length < 3) return false
  const recent = history.slice(-3)
  if (new Set(recent.map((item) => item.action.id)).size !== 1) return false
  const moved = (a, b) => Math.hypot(...a.map((value, i) => value - b[i])) >= 0.002
  if (moved(recent[0].before.tcp, recent[2].after.tcp)) return false
  for (const { before, after } of recent) {
    if (moved(before.tcp, after.tcp)) return false
    for (const key of ['held', 'gripper', 'finger_contacts', 'support_contact']) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) return false
    }
  }
  return true
}
