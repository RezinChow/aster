// One LIBERO episode under the visual-waypoint protocol, run as upstream's
// libero_compare loop: a planner proposes a waypoint when there is none, it
// was reached, it expired or motion stalled; the deterministic local
// controller drives OSC_POSE toward it in 5-step actions; LIBERO's predicate
// is checked after every environment step.
import {
  ACTION_REPEAT,
  MAX_PLANS,
  MAX_STEPS,
  PROTOCOL,
  STALL_BLOCKS,
  STALL_MOVEMENT_M,
  VIEWS,
  backproject,
  localState,
  motorAction,
  project,
  reached,
  resolvePlan
} from './libero-plan.js'
import { LiberoWorld } from './libero-world.js'

export const LIBERO_TASKS = {
  'libero-drawer': {
    name: '关闭顶层抽屉',
    goal: 'LIBERO libero_90 任务 0：把木柜最上层打开的抽屉推回关闭。成功由 LIBERO 的 Close 谓词判定。',
    scene: 'drawer',
    metric: { label: '抽屉位置', unit: 'mm', scale: 1000, digits: 0 }
  },
  'libero-microwave': {
    name: '关闭微波炉',
    goal: 'LIBERO libero_90 任务 33：把打开的微波炉门推回关闭。成功由 LIBERO 的 Close 谓词判定。',
    scene: 'microwave',
    metric: { label: '门铰链角', unit: '°', scale: 180 / Math.PI, digits: 0 }
  }
}

/** Each scene exports LIBERO's first init states 0..LIBERO_INITS-1 of its task. */
export const LIBERO_INITS = 10

export const PLANNERS = {
  vision: { name: '视觉模型', note: '模型只看两路标注相机图和机器人本体状态' },
  reference: { name: '参考航点', note: '特权基线：航点来自仿真内部状态，不是视觉结果' }
}

const modules = {
  drawer: () => import('./vendor/libero/drawer.js'),
  microwave: () => import('./vendor/libero/microwave.js')
}
const cache = new Map()

/** The exported scene module of one LIBERO task: PHYSICS, EPISODE, RENDER, RENDER_BIN. */
export function liberoScene(task) {
  const spec = LIBERO_TASKS[task]
  if (!spec) throw new Error('未知的 LIBERO 任务')
  if (!cache.has(spec.scene)) cache.set(spec.scene, modules[spec.scene]())
  return cache.get(spec.scene)
}

const TERMINAL = new Set(['completed', 'stopped', 'error', 'exhausted'])
const copy = (value) => (value === undefined ? undefined : structuredClone(value))
const round = (values, digits = 4) => values.map((value) => Number(value.toFixed(digits)))
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

function episodeId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return 'libero-' + Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** The plan fields a later planner turn may read: no rotation matrix, no images. */
export function publicPlan(plan) {
  if (!plan) return null
  const { target_rotation: _rotation, ...rest } = plan
  return { ...copy(rest), target_xyz: round(plan.target_xyz) }
}

// The point of the microwave door the reference pushes, in the door body's
// frame, which is the world frame turned about z by the hinge angle.
const DOOR_CONTACT = [0.1961, -0.0637]

/**
 * Privileged reference waypoints: positions read from the simulator, not from
 * images. Drawer: push the top drawer front along -y. Microwave: follow the
 * door's swing arc around its hinge from the init state's opening angle.
 */
export function referenceWaypoints(task, world) {
  if (task === 'libero-drawer') {
    return [
      { gripper: 'close', xyz: null },
      { gripper: 'close', xyz: [0, 0, 1.178] },
      { gripper: 'close', xyz: [0, 0, 1.115] },
      { gripper: 'close', xyz: [0, -0.25, 1.115] },
      { gripper: 'close', xyz: [0, -0.1, 1.178] }
    ]
  }
  if (task !== 'libero-microwave') throw new Error('未知的 LIBERO 任务')
  const [hinge] = world.goalAnchors()
  const height = 1.0
  const start = world.goalQpos()[0]
  const contact = (angle) => {
    const [c, s] = [Math.cos(angle), Math.sin(angle)]
    return [hinge[0] + c * DOOR_CONTACT[0] - s * DOOR_CONTACT[1], hinge[1] + s * DOOR_CONTACT[0] + c * DOOR_CONTACT[1]]
  }
  const first = contact(start)
  const points = [
    { gripper: 'close', xyz: null },
    { gripper: 'close', xyz: [...first, 1.185] },
    { gripper: 'close', xyz: [...first, height] }
  ]
  // Eight points carried past closed keep pushing through the latch within the step budget.
  for (let i = 1; i <= 8; i += 1) points.push({ gripper: 'close', xyz: [...contact(start + ((0.3 - start) * i) / 8), height] })
  return points
}

/**
 * The reference planner answers in the same schema as the vision model: a
 * calibrated pixel whose rendered depth plus offset is the waypoint when a
 * camera sees near it, else a world target. It advances when the previous
 * waypoint was reached or motion stalled.
 */
export class ReferencePlanner {
  constructor(task, world) {
    this.points = referenceWaypoints(task, world)
    this.index = -1
  }

  propose({ observation, packets, reason }) {
    if (this.index < 0 || reason === 'reached' || reason === 'stalled') this.index = Math.min(this.index + 1, this.points.length - 1)
    const point = this.points[this.index]
    const base = {
      stage: `参考航点 ${this.index + 1}/${this.points.length}`,
      intent: point.xyz ? 'Move the TCP to the next privileged reference waypoint.' : 'Close the gripper in place.',
      visual_evidence: 'Privileged simulator waypoint; not derived from the images.',
      rotation_delta: [0, 0, 0],
      gripper: point.gripper,
      max_motor_steps: point.xyz ? 8 : 2
    }
    if (!point.xyz) return { ...base, target: { kind: 'relative', delta_m: [0, 0, 0] } }
    for (const view of VIEWS) {
      const packet = packets?.[view]
      const uv = packet && project(packet, point.xyz)
      if (!uv || !(uv[0] >= 0 && uv[0] < packet.width && uv[1] >= 0 && uv[1] < packet.height)) continue
      try {
        const pixel = [Math.min(Math.round(uv[0]), packet.width - 1), Math.min(Math.round(uv[1]), packet.height - 1)]
        const { xyz } = backproject(packet, pixel)
        const offset = point.xyz.map((value, i) => value - xyz[i])
        if (offset.every((value) => Math.abs(value) <= 0.2)) {
          return { ...base, target: { kind: 'pixel', camera: view, pixel, offset_m: offset } }
        }
      } catch {
        // No valid depth at that pixel; try the other camera, then a world target.
      }
    }
    return { ...base, target: { kind: 'world', xyz_m: [...point.xyz] } }
  }
}

export class LiberoSession {
  /**
   * `propose({ observation, packets, previous, recent, reason })` returns
   * `{ answer, model, model_call, latency_ms, images }` or `{ error }`;
   * `capture(world)` returns the calibrated RGB-D packet per camera, each with
   * its annotated `image` data URL, or null without cameras.
   */
  static async create(mujoco, { task, planner = 'vision', init = 0, propose, capture = null, speed = 1 }) {
    if (!(planner in PLANNERS)) throw new Error('未知的规划方式')
    const scene = await liberoScene(task)
    const world = LiberoWorld.create(mujoco, { physics: scene.PHYSICS, episode: scene.EPISODE, init })
    return new LiberoSession(world, { task, planner, propose, capture, speed })
  }

  constructor(world, { task, planner, propose, capture, speed }) {
    this.id = episodeId()
    this.world = world
    this.task = task
    this.planner = planner
    this.reference = planner === 'reference' ? new ReferencePlanner(task, world) : null
    this.propose = propose
    this.capture = capture
    this.speed = speed
    this.status = 'idle'
    this.stage = 'ready'
    this.message = null
    this.history = []
    this.frames = []
    this.plan = null
    this.age = 0
    this.stalled = 0
    this.finger = -1
    this.recent = []
    this.modelCalls = 0
    this.singleStep = false
    this.started = null
    this.finished = null
    this.cancelled = false
    this.wakers = []
    this.loop = null
    this.record()
  }

  frameObservation() {
    const world = this.world
    return {
      tcp: world.tcp,
      sim_seconds: Number((world.steps / world.episode.controller.control_hz).toFixed(3)),
      step: world.steps,
      gripper: this.finger > 0 ? 'closed' : 'open',
      gripper_qpos: world.fingerQpos,
      goal_qpos: world.goalQpos(),
      success: world.success()
    }
  }

  record() {
    this.lastFrame = { observation: this.frameObservation(), qpos: this.world.qpos, plan: this.history.length }
    this.frames.push(this.lastFrame)
  }

  wake() {
    for (const resolve of this.wakers.splice(0)) resolve()
  }

  async awake() {
    while (!this.cancelled && this.status !== 'running') await new Promise((resolve) => this.wakers.push(resolve))
    return !this.cancelled
  }

  sleep(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms)
      this.wakers.push(() => {
        if (this.cancelled) {
          clearTimeout(timer)
          resolve()
        }
      })
    })
  }

  start(singleStep = false) {
    if (TERMINAL.has(this.status)) throw new Error('请先重置实验再重新开始')
    if (this.status === 'running') return
    this.status = 'running'
    this.singleStep = singleStep
    this.message = null
    if (this.started === null) this.started = performance.now()
    this.wake()
    if (!this.loop) {
      this.loop = this.run().finally(() => {
        this.loop = null
      })
    }
  }

  pause() {
    if (this.status === 'running') this.status = 'paused'
  }

  stop() {
    this.cancelled = true
    if (!TERMINAL.has(this.status)) this.status = 'stopped'
    this.finished ??= performance.now()
    this.wake()
  }

  end(status, message = null) {
    this.status = status
    this.message = message
    this.stage = status === 'completed' ? 'verified' : 'observing'
    this.finished = performance.now()
  }

  refreshReason(observation) {
    if (!this.plan) return 'initial'
    if (reached(localState(observation, this.plan, this.finger))) return 'reached'
    if (this.stalled >= STALL_BLOCKS) return 'stalled'
    if (this.age >= this.plan.max_motor_steps) return 'expired'
    return null
  }

  async replan(observation, reason) {
    this.stage = 'deciding'
    const packets = this.capture ? await this.capture(this.world) : null
    if (this.cancelled) return false
    const request = { observation, packets, previous: publicPlan(this.plan), recent: copy(this.recent.slice(-3)), reason }
    const shown = packets ? Object.fromEntries(VIEWS.filter((view) => packets[view]?.image).map((view) => [view, packets[view].image])) : null
    const proposal = this.reference
      ? { answer: this.reference.propose(request), model: PLANNERS.reference.name, model_call: false, latency_ms: 0, images: shown }
      : await this.propose(request)
    if (this.cancelled) return false
    if (proposal.model_call) this.modelCalls += 1
    if (proposal.error) {
      this.end('error', proposal.error)
      return false
    }
    let plan
    try {
      plan = resolvePlan(proposal.answer, observation, packets ?? {})
    } catch (failure) {
      this.end('error', `规划未通过航点校验：${failure.message}`)
      return false
    }
    this.plan = plan
    this.age = 0
    this.stalled = 0
    this.history.push({
      cycle: this.history.length + 1,
      reason,
      label: plan.stage,
      plan: publicPlan(plan),
      answer: copy(proposal.answer),
      model: proposal.model,
      model_call: !!proposal.model_call,
      latency_ms: proposal.latency_ms,
      images: proposal.images ?? null,
      before: { tcp: observation.tcp, step: observation.step },
      start_step: observation.step,
      end_step: observation.step,
      blocks: 0,
      after: this.frameObservation()
    })
    return true
  }

  async run() {
    const world = this.world
    try {
      while (!this.cancelled) {
        if (!(await this.awake())) return
        if (world.steps >= MAX_STEPS) return this.end('exhausted', `已用完 ${MAX_STEPS} 步环境预算，任务未完成`)
        const observation = world.observation()
        const reason = this.refreshReason(observation)
        if (reason) {
          if (this.history.length >= MAX_PLANS) return this.end('exhausted', `已用完 ${MAX_PLANS} 次规划预算，任务未完成`)
          if (!(await this.replan(observation, reason))) return
        }
        this.stage = 'executing'
        const action = motorAction(localState(observation, this.plan, this.finger))
        const current = this.history.at(-1)
        for (let k = 0; k < ACTION_REPEAT && world.steps < MAX_STEPS; k += 1) {
          if (!(await this.awake())) return
          world.step(action)
          this.record()
          if (world.success()) break
          if (this.speed > 0) await this.sleep(50 / this.speed)
          else if (k === ACTION_REPEAT - 1) await this.sleep(0)
        }
        if (this.cancelled) return
        this.finger = action[6]
        const after = world.observation()
        this.recent.push({
          before_tcp: observation.tcp,
          after_tcp: after.tcp,
          delta_m: after.tcp.map((value, i) => value - observation.tcp[i]),
          gripper_qpos: after.gripper_qpos,
          action
        })
        if (this.recent.length > 8) this.recent.shift()
        this.stalled = dist(observation.tcp, after.tcp) < STALL_MOVEMENT_M ? this.stalled + 1 : 0
        this.age += 1
        current.blocks += 1
        current.end_step = world.steps
        current.after = this.frameObservation()
        this.stage = 'observing'
        if (world.success()) return this.end('completed')
        if (this.singleStep) this.pause()
      }
    } catch (failure) {
      if (!this.cancelled) this.end('error', String(failure?.message ?? failure))
    }
  }

  snapshot() {
    const plan = this.history.at(-1) ?? null
    return {
      id: this.id,
      benchmark: 'libero',
      protocol: PROTOCOL,
      status: this.status,
      stage: this.stage,
      phase: plan?.label ?? null,
      task: this.task,
      seed: 0,
      init: this.world.init,
      planner: this.planner,
      speed: this.speed,
      cycles: this.history.length,
      max_cycles: MAX_PLANS,
      steps: this.world.steps,
      max_steps: MAX_STEPS,
      threshold: null,
      message: this.message,
      frame: { ...this.lastFrame, poses: this.world.poses() },
      history: this.history,
      candidates: [],
      last_decision: plan,
      last_intent: null,
      frame_count: this.frames.length,
      model_calls: this.modelCalls,
      success: this.status === 'completed',
      wall_seconds: this.started ? Number((((this.finished ?? performance.now()) - this.started) / 1000).toFixed(2)) : 0
    }
  }

  replayFrame(index) {
    if (!(index >= 0 && index < this.frames.length)) throw new Error('帧序号超出范围')
    const saved = this.frames[index]
    return { ...saved, poses: this.world.poses(saved.qpos) }
  }

  async dispose() {
    this.stop()
    await this.loop
    this.world.dispose()
  }
}
