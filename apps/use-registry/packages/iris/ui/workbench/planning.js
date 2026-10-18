// Flight phase menu. Ported from EmbodiedJev planning.py mission branch (MIT).
// One phase is eligible at a time. Visit and inspect offer one candidate per
// remaining point, and every candidate is rolled out on a shadow world.
export const PHASES = {
  takeoff: '起飞爬升',
  visit: '飞往航点',
  return: '返回起降坪上空',
  land: '下降降落',
  pickup: '下降挂钩取件',
  carry: '带件飞行',
  drop: '释放载荷',
  inspect: '抵近巡检',
  finish: '完成'
}

const GUIDANCE = {
  takeoff: 'Spin up and climb to patrol altitude above the landing pad.',
  visit: 'Fly to a waypoint marker and hold position beside it.',
  return: 'Fly back above the landing pad at patrol altitude.',
  land: 'Descend onto the landing pad and cut the rotors.',
  pickup: 'Hover over the payload at hook height and close the hook to pick it up.',
  carry: 'Climb and fly to above the drop zone while carrying the payload.',
  drop: 'Descend over the drop zone and open the hook to release the payload.',
  inspect: 'Fly to a standoff point and hold heading toward the inspected structure.',
  finish: 'Finish the task after physical success has been verified.'
}

const hypot2 = (point) => Math.hypot(point[0], point[1])

export function eligiblePhases(state) {
  const mission = state.mission
  const position = state.tcp
  if (state.success) return ['finish']
  if (mission.grounded) return ['takeoff']
  const abovePad = hypot2(position) <= 0.35
  if (mission.task === 'delivery') {
    const [bx, by, radius] = mission.drop_zone
    const placed = Math.hypot(mission.payload[0] - bx, mission.payload[1] - by) < radius && mission.payload[2] < 0.09
    if (placed && !mission.held) return [abovePad ? 'land' : 'return']
    if (!mission.held) return ['pickup']
    return Math.hypot(position[0] - bx, position[1] - by) > 0.3 ? ['carry'] : ['drop']
  }
  if (mission.task === 'inspect') {
    if (!mission.inspected.every(Boolean)) return ['inspect']
    return [abovePad ? 'land' : 'return']
  }
  if (!mission.visited.every(Boolean)) return ['visit']
  return [hypot2(position) > 0.35 ? 'return' : 'land']
}

export function baselinePhase(state) {
  return eligiblePhases(state)[0]
}

function candidate(id, label, phase, target, gripper, seconds) {
  return { id, label, phase, target: [...target], gripper, seconds, admitted: true, rejection: null, preview: null }
}

export function candidates(world, phase, state) {
  const mission = state.mission
  const position = state.tcp
  const result = []
  if (phase === 'takeoff') result.push(candidate('direct', PHASES[phase], phase, mission.pad_hover, null, 3))
  else if (phase === 'visit') {
    mission.visited.forEach((done, index) => {
      if (!done) result.push(candidate(`mark_${index + 1}`, `飞往航点 ${index + 1}`, phase, mission.marks[index], null, 4))
    })
  } else if (phase === 'pickup') result.push(candidate('direct', PHASES[phase], phase, mission.pickup, 'close', 5))
  else if (phase === 'carry') {
    const [bx, by] = mission.drop_zone
    result.push(candidate('direct', PHASES[phase], phase, [bx, by, 1.2], null, 5))
  } else if (phase === 'drop') result.push(candidate('direct', PHASES[phase], phase, mission.drop, 'open', 8))
  else if (phase === 'inspect') {
    mission.inspected.forEach((done, index) => {
      if (!done) result.push(candidate(`point_${index + 1}`, `巡检点 ${index + 1}`, phase, mission.points[index], null, 7))
    })
  } else if (phase === 'return') result.push(candidate('direct', PHASES[phase], phase, mission.pad_hover, null, 6))
  else if (phase === 'land') result.push(candidate('direct', PHASES[phase], phase, [...mission.pad_hover.slice(0, 2), mission.rest_z], null, 6))
  else if (phase === 'finish') result.push(candidate('direct', PHASES[phase], phase, position, null, 0.5))
  else throw new Error('Unknown phase')
  result.push(candidate('hold', '原地悬停', phase, position, null, 0.5))
  return result
}

export function phaseOptions(world, phases, state) {
  const options = {}
  for (const phase of phases) {
    const option = candidates(world, phase, state)[0]
    const delta = option.target.slice(0, 3).map((value, index) => value - state.tcp[index])
    const moves = ['X', 'Y', 'Z']
      .map((axis, index) => (Math.abs(delta[index]) >= 0.002 ? `${axis} ${delta[index] >= 0 ? '+' : ''}${delta[index].toFixed(3)} m` : null))
      .filter(Boolean)
    const hook = option.gripper === 'close' ? 'hook close' : option.gripper === 'open' ? 'hook open' : 'hook unchanged'
    options[phase] = `${GUIDANCE[phase]} Planned change: ${moves.join(', ') || 'no displacement'}; ${hook}.`
  }
  return options
}

/** Roll each candidate out on a shadow world. A shadow visit does not mark the live mission. */
export async function previewCandidates(world, options, phase, pause) {
  for (const option of options) {
    const shadow = world.clone()
    try {
      const unsafeBefore = shadow.unsafeContacts
      for (const _ of shadow.motion(option.target, option.gripper, option.seconds, false));
      const here = shadow.position
      const goal = option.target.slice(0, 3)
      const dist = Math.hypot(here[0] - goal[0], here[1] - goal[1], here[2] - goal[2])
      const after = shadow.observe()
      option.preview = {
        tcp: after.tcp,
        object: after.object,
        held: false,
        support_contact: after.support_contact,
        target_error_m: Number(dist.toFixed(4))
      }
      const mission = after.mission
      const pointIndex = option.id.startsWith('point_') ? Number(option.id.split('_')[1]) - 1 : -1
      if (shadow.unsafeContacts > unsafeBefore) {
        option.admitted = false
        option.rejection = '预演发生坠机或倾覆'
      } else if (phase === 'land' && !mission.grounded) {
        option.admitted = false
        option.rejection = '预演未能降落'
      } else if (phase === 'pickup' && !mission.held) {
        option.admitted = false
        option.rejection = '预演未能挂上载荷'
      } else if (phase === 'drop' && mission.held) {
        option.admitted = false
        option.rejection = '预演未能释放载荷'
      } else if (phase === 'inspect' && pointIndex >= 0 && !mission.inspected[pointIndex] && mission.dwell_s[pointIndex] < 0.3) {
        option.admitted = false
        option.rejection = '预演未达成抵近对准'
      } else if (!['land', 'pickup', 'drop'].includes(phase) && dist > 0.25) {
        option.admitted = false
        option.rejection = '预演未在规定时间内抵达目标'
      }
    } catch (failure) {
      option.admitted = false
      option.rejection = String(failure?.message ?? failure)
    } finally {
      shadow.dispose()
    }
    if (pause) await pause()
  }
}
