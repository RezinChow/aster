// Phase menu and candidate rollouts. Ported from EmbodiedJev planning.py (MIT).
import { TRAVEL_Z } from './world.js'

export const PHASES = {
  approach: '移至物体上方',
  descend: '下降对准',
  grasp: '闭合夹爪',
  lift: '抬升物体',
  carry: '移向目标',
  lower: '降低放置',
  release: '松开夹爪',
  withdraw: '向上撤离',
  recover: '张开重试',
  finish: '完成'
}

const PHASE_GUIDANCE = {
  approach: 'Move the open gripper to 0.14 m above the object, aligned in XY.',
  descend: "Move the open gripper down to the object's height, ready to grasp it.",
  grasp: 'Close the fingers around the object at the current position.',
  lift: 'Raise the held object to the travel height, keeping the same XY position.',
  carry: 'Move the held object above the destination at travel height.',
  lower: 'Lower the held object onto the destination, keeping the fingers closed.',
  release: 'Open the fingers to release the object onto its destination support.',
  withdraw: 'Raise the empty open gripper away from the placed object.',
  recover: 'Open the empty fingers after an unsuccessful grasp.',
  finish: 'Finish the task after physical success has been verified.'
}

const norm = (values) => Math.hypot(...values)
const minus = (a, b) => a.map((value, i) => value - b[i])
const plus = (a, b) => a.map((value, i) => value + b[i])
const travelHeight = (state) => state.relative_geometry?.travel_tcp_height_m ?? TRAVEL_Z

export function eligiblePhases(state) {
  const p = state.tcp
  const cube = state.object
  const target = state.destination
  const closed = state.gripper === 'closed'
  const nearDestination = norm(minus(cube, target).slice(0, 2)) < 0.025
  if (state.success) return ['finish']
  if (!closed && nearDestination && state.support_contact) return ['withdraw']
  if (state.held) {
    if (norm(minus(p, target).slice(0, 2)) < 0.02) {
      return Math.abs(cube[2] - target[2]) < 0.012 ? ['lower', 'release'] : ['lower', 'carry']
    }
    if (cube[2] < travelHeight(state) - 0.045) return ['lift']
    return ['carry', 'lift']
  }
  if (closed) return ['recover', 'grasp']
  if (norm(minus(p, cube).slice(0, 2)) > 0.007) return ['approach']
  if (Math.abs(p[2] - cube[2]) > 0.006) return ['descend', 'approach']
  return ['grasp', 'approach']
}

export function baselinePhase(state) {
  const eligible = eligiblePhases(state)
  if (eligible.includes('release') && Math.abs(state.object[2] - state.destination[2]) < 0.012) return 'release'
  return eligible[0]
}

function gripperChanges(command, state) {
  if (!command) return false
  const wanted = command === 'close' ? 'closed' : command === 'open' ? 'open' : command
  return wanted !== state
}

/** Keep phases that move the gripper or change the fingers, and prefer those that get closer. */
export function phasesWithEffect(world, phases, state) {
  const position = state.tcp
  const anchor = state.held ? state.destination : state.object
  const here = norm(minus(position, anchor))
  const evaluated = phases.map((phase) => {
    const option = candidates(world, phase, state)[0]
    const target = option.target ?? position
    return {
      phase,
      moves: norm(minus(target, position)) >= 0.002,
      changes: gripperChanges(option.gripper, state.gripper),
      closer: norm(minus(target, anchor)) - here <= -0.002
    }
  })
  const moving = evaluated.filter((item) => item.moves || item.changes).map((item) => item.phase)
  if (moving.length === 0) return [...phases]
  const productive = evaluated.filter((item) => moving.includes(item.phase) && (item.closer || item.changes)).map((item) => item.phase)
  if (productive.length && productive.length < moving.length) return productive
  return moving
}

/** Describe planned effects without recommending or dropping any offered phase. */
export function phaseOptions(world, phases, state) {
  const options = {}
  for (const phase of phases) {
    const option = candidates(world, phase, state)[0]
    const delta = minus(option.target, state.tcp)
    const moves = ['X', 'Y', 'Z']
      .map((axis, i) => (Math.abs(delta[i]) >= 0.002 ? `${axis} ${delta[i] >= 0 ? '+' : ''}${delta[i].toFixed(3)} m` : null))
      .filter(Boolean)
    const motion = moves.length ? moves.join(', ') : 'no TCP displacement'
    options[phase] = `${PHASE_GUIDANCE[phase]} Planned change: ${motion}; fingers ${option.gripper ?? 'unchanged'}.`
  }
  return options
}

/** The direct, gentle and hold actions for a phase, without rollouts. */
export function candidates(world, phase, state) {
  const p = state.tcp
  const cube = state.object
  const dest = state.destination
  const travelZ = Number(travelHeight(state))
  if (!Number.isFinite(travelZ) || travelZ < 0.02 || travelZ > 0.42) throw new Error('观测中的安全搬运高度超出工作区')
  let target = [...p]
  let grip = null
  let duration = 0.8
  if (phase === 'approach') {
    target = plus(cube, [0, 0, 0.14])
    grip = 'open'
  } else if (phase === 'descend') {
    target = plus(cube, [0, 0, 0.001])
  } else if (phase === 'grasp') {
    grip = 'close'
    duration = 0.65
  } else if (phase === 'lift') {
    target = [p[0], p[1], travelZ]
    duration = 1.1
  } else if (phase === 'carry') {
    target = [dest[0] + p[0] - cube[0], dest[1] + p[1] - cube[1], travelZ]
    duration = 1.6
  } else if (phase === 'lower') {
    target = plus(plus(dest, minus(p, cube)), [0, 0, 0.002])
    duration = 1.2
  } else if (phase === 'release' || phase === 'recover') {
    grip = 'open'
    duration = 0.8
  } else if (phase === 'withdraw') {
    target = [p[0], p[1], travelZ]
    duration = 1.0
  } else if (phase !== 'finish') {
    throw new Error('Unknown phase')
  }
  const result = [{ id: 'direct', label: PHASES[phase], phase, target, gripper: grip, seconds: duration, admitted: true, rejection: null, preview: null }]
  if (norm(minus(target, p)) > 0.03) {
    result.push({ id: 'gentle', label: '减速执行', phase, target, gripper: grip, seconds: duration * 1.5, admitted: true, rejection: null, preview: null })
  }
  result.push({ id: 'hold', label: '保持当前位姿', phase, target: [...p], gripper: null, seconds: 0.3, admitted: true, rejection: null, preview: null })
  return result
}

/** Roll each candidate out on a shadow world and reject unsafe ones. Yields between rollouts. */
export async function previewCandidates(world, options, state, phase, pause) {
  for (const option of options) {
    const shadow = world.clone()
    try {
      const unsafeBefore = shadow.unsafeContacts
      const initialZ = shadow.cube[2]
      for (const _ of shadow.motion(option.target, option.gripper, option.seconds, false));
      const after = shadow.observe()
      const error = Math.hypot(...shadow.cube.map((value, i) => value - shadow.target[i]))
      option.preview = {
        tcp: after.tcp,
        object: after.object,
        held: after.held,
        support_contact: after.support_contact,
        target_error_m: Number(error.toFixed(4))
      }
      if (shadow.unsafeContacts > unsafeBefore) {
        option.admitted = false
        option.rejection = '预演发生机械臂与台面或障碍接触'
      } else if ((phase === 'lift' || phase === 'carry') && state.held && !after.held) {
        option.admitted = false
        option.rejection = '预演丢失双侧抓取接触'
      } else if (phase === 'carry' && shadow.cube[2] < initialZ - 0.045) {
        option.admitted = false
        option.rejection = '预演物体下落'
      }
    } catch (failure) {
      option.admitted = false
      option.rejection = String(failure?.message ?? failure)
    } finally {
      shadow.dispose()
    }
    await pause()
  }
  return options
}
