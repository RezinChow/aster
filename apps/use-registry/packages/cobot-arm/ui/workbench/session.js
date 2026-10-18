// One experiment episode in skills mode. Ported from EmbodiedJev runtime.py
// Session (MIT): each cycle chooses a phase, previews the candidate actions on
// shadow worlds, chooses an action, then executes it in 20-step chunks.
import { baselinePhase, candidates, eligiblePhases, phaseOptions, phasesWithEffect, previewCandidates } from './planning.js'
import { RobotWorld } from './world.js'

const TERMINAL = new Set(['completed', 'stopped', 'error', 'exhausted', 'stalled'])
const dist = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]))
const copy = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
const later = () => new Promise((resolve) => setTimeout(resolve, 0))

function compactObservation(o) {
  const g = o.relative_geometry
  return {
    goal: o.task,
    units: 'metres',
    tcp: o.tcp,
    object: o.object,
    destination: o.destination,
    gripper: o.gripper,
    object_held: o.held,
    finger_contacts: o.finger_contacts,
    destination_support_contact: o.support_contact,
    geometry: g,
    relations: {
      tcp_aligned_with_object_xy: g.tcp_object_xy_distance_m <= 0.007,
      tcp_at_object_height: Math.abs(g.tcp_above_object_m) <= 0.006,
      object_aligned_with_destination_xy: g.object_destination_xy_distance_m < 0.025,
      object_at_destination_height: Math.abs(g.object_above_destination_m) < 0.012
    },
    forbidden_contact: o.forbidden_contact,
    success: o.success
  }
}

/** The compact evidence one decision sees: this observation and the last two outcomes. */
export function decisionState(observation, history) {
  return {
    observation: compactObservation(observation),
    recent_outcomes: history.slice(-2).map((item) => ({
      phase: item.phase,
      option: item.action.id,
      tcp_displacement_m: Number(dist(item.before.tcp, item.after.tcp).toFixed(4)),
      object_displacement_m: Number(dist(item.before.object, item.after.object).toFixed(4)),
      object_held_after: item.after.held,
      success_after: item.after.success
    }))
  }
}

function episodeId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export class Session {
  /**
   * `choose(stage, request)` returns a decision object. request carries the
   * agent observation (`options`, `baseline_choice`, `state`, `decision`).
   */
  static async create(mujoco, { task = 'transfer', seed = 0, threshold = 0.55, maxCycles = 30, speed = 1.5, choose }) {
    const world = await RobotWorld.create(mujoco, task, seed)
    return new Session(world, { threshold, maxCycles, speed, choose })
  }

  constructor(world, { threshold, maxCycles, speed, choose }) {
    this.id = episodeId()
    this.world = world
    this.choose = choose
    this.threshold = threshold
    this.maxCycles = maxCycles
    this.speed = speed
    this.status = 'idle'
    this.stage = 'ready'
    this.phase = null
    this.cycles = 0
    this.history = []
    this.frames = []
    this.currentCandidates = []
    this.lastDecision = null
    this.lastIntent = null
    this.lastInputs = { phase: null, action: null }
    this.message = null
    this.singleStep = false
    this.started = null
    this.finished = null
    this.cancelled = false
    this.wakers = []
    this.loop = null
    this.modelCalls = 0
    this.lastFrame = world.frame()
    this.record(this.lastFrame)
  }

  record(frame) {
    this.lastFrame = frame
    this.frames.push({ time: frame.time, qpos: frame.qpos, observation: frame.observation, cycle: this.cycles, phase: this.phase })
  }

  wake() {
    for (const resolve of this.wakers.splice(0)) resolve()
  }

  /** Resolve true once running, false once stopped. */
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

  start(singleStep = false, threshold) {
    if (TERMINAL.has(this.status)) throw new Error('请先重置实验再重新开始')
    if (this.status === 'running') return
    if (threshold !== undefined && Number.isFinite(threshold)) this.threshold = threshold
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
    if (this.status !== 'completed') this.status = 'stopped'
    this.finished = performance.now()
    this.wake()
  }

  /** A published probability below the threshold stops the episode for a person, as upstream. */
  belowThreshold(decision) {
    const probability = decision.selected_probability
    if (typeof probability !== 'number' || probability >= this.threshold) return false
    this.status = 'uncertain'
    this.stage = 'deciding'
    this.message = '候选动作概率低于设定门槛，等待人工处理'
    return true
  }

  async decide(stage, observation, question, options, reference) {
    if (!(await this.awake())) return null
    const request = {
      state: decisionState(observation, this.history),
      decision: { type: 'choice', instructions: question, criteria: options },
      options,
      baseline_choice: reference
    }
    this.lastInputs[stage] = Object.keys(options).length > 1 ? copy({ state: request.state, decision: request.decision }) : null
    const decision = await this.choose(stage, request)
    if (decision.model_call) this.modelCalls += 1
    if (this.cancelled) return null
    if (!(decision.choice in options)) throw new Error('决策返回了未提供的选项')
    return decision
  }

  async run() {
    const world = this.world
    try {
      while (!this.cancelled) {
        if (!(await this.awake())) return
        if (this.cycles >= this.maxCycles) {
          this.status = 'exhausted'
          this.message = '已达到动作预算'
          this.finished = performance.now()
          return
        }
        const observation = world.observe()
        const phases = phasesWithEffect(world, eligiblePhases(observation), observation)
        this.stage = 'deciding'
        this.lastDecision = null
        this.lastIntent = null
        this.lastInputs = { phase: null, action: null }
        this.currentCandidates = []
        let reference = baselinePhase(observation)
        if (!phases.includes(reference)) reference = phases[0]
        const intent = await this.decide(
          'phase',
          observation,
          'Choose the next phase that makes progress toward the goal, given the measured geometry and contacts. ' +
            'Avoid repeating a motion that has already reached its target.',
          phaseOptions(world, phases, observation),
          reference
        )
        if (!intent) return
        this.lastIntent = intent
        if (this.belowThreshold(intent)) continue
        const phase = intent.choice
        this.phase = phase
        if (phase === 'finish') {
          this.finish()
          return
        }
        this.stage = 'previewing'
        const options = candidates(world, phase, observation)
        await previewCandidates(world, options, observation, phase, later)
        if (this.cancelled) return
        this.currentCandidates = copy(options)
        const legal = options.filter((item) => item.admitted)
        const progress = legal.filter((item) => item.id !== 'hold')
        if (progress.length === 0) throw new Error('动作预演未找到可执行的前进动作')
        const menu = Object.fromEntries(
          legal.map((item) => [
            item.id,
            JSON.stringify({
              motion: item.id,
              phase,
              target_tcp: item.target ? item.target.map((value) => Number(value.toFixed(4))) : null,
              gripper_command: item.gripper ?? 'unchanged',
              duration_seconds: item.seconds,
              preview: item.preview
            })
          ])
        )
        const decision = await this.decide(
          'action',
          observation,
          'Select the action that progresses the chosen phase. Hold only when moving is unjustified. ' +
            `Chosen phase: ${phase}. All offered actions passed the configured simulation checks.`,
          menu,
          progress[0].id
        )
        if (!decision) return
        if (this.belowThreshold(decision)) {
          this.lastDecision = decision
          continue
        }
        const selected = legal.find((item) => item.id === decision.choice)
        this.cycles += 1
        this.lastDecision = decision
        this.stage = 'executing'
        const unsafeBefore = world.unsafeContacts
        for (const frame of world.motion(selected.target, selected.gripper, selected.seconds)) {
          if (!(await this.awake())) return
          this.record(frame)
          if (world.unsafeContacts > unsafeBefore) throw new Error('执行层检测到台面或障碍接触，已停止')
          if (this.speed > 0) await this.sleep(40 / this.speed)
          if (this.cancelled) return
        }
        const after = world.observe()
        this.history.push({
          cycle: this.cycles,
          phase,
          label: selected.label,
          intent,
          decision,
          action: copy(selected),
          before: observation,
          after,
          candidates: copy(options),
          decision_inputs: copy(this.lastInputs),
          rejected_count: options.filter((item) => !item.admitted).length
        })
        this.stage = 'observing'
        if (world.success()) {
          this.finish()
          return
        }
        if (this.stalled()) {
          this.status = 'stalled'
          this.stage = 'observing'
          this.message = '连续三次重复选择未带来位姿或接触变化，已停止推理；请查看历史决策后重置。'
          this.finished = performance.now()
          return
        }
        if (this.singleStep) this.pause()
      }
    } catch (failure) {
      if (!this.cancelled) {
        this.status = 'error'
        this.message = String(failure?.message ?? failure)
        this.finished = performance.now()
      }
    }
  }

  stalled() {
    if (this.history.length < 3) return false
    const recent = this.history.slice(-3)
    if (new Set(recent.map((item) => item.phase)).size !== 1) return false
    for (const key of ['tcp', 'object']) if (dist(recent[0].before[key], recent[2].after[key]) >= 0.002) return false
    for (const { before, after } of recent) {
      for (const key of ['tcp', 'object']) if (dist(before[key], after[key]) >= 0.002) return false
      for (const key of ['held', 'gripper', 'finger_contacts', 'support_contact']) {
        if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) return false
      }
    }
    return true
  }

  finish() {
    if (this.cancelled) return
    if (!this.world.success()) throw new Error('物理成功条件尚未满足')
    this.status = 'completed'
    this.stage = 'verified'
    this.finished = performance.now()
  }

  snapshot() {
    return {
      id: this.id,
      status: this.status,
      stage: this.stage,
      phase: this.phase,
      task: this.world.task,
      seed: this.world.seed,
      speed: this.speed,
      cycles: this.cycles,
      max_cycles: this.maxCycles,
      provider: 'agent',
      scene_config: {},
      threshold: this.threshold,
      message: this.message,
      frame: this.lastFrame,
      history: this.history,
      candidates: this.currentCandidates,
      last_decision: this.lastDecision,
      last_intent: this.lastIntent,
      last_decision_inputs: this.lastInputs,
      frame_count: this.frames.length,
      model_calls: this.modelCalls,
      wall_seconds: this.started ? Number((((this.finished ?? performance.now()) - this.started) / 1000).toFixed(2)) : 0
    }
  }

  replayFrame(index) {
    if (!(index >= 0 && index < this.frames.length)) throw new Error('帧序号超出范围')
    const saved = this.frames[index]
    return { time: saved.time, qpos: saved.qpos, observation: saved.observation, ...this.world.replayFrame(saved.qpos) }
  }

  /** Stop the loop and free the WASM objects once it has returned. */
  async dispose() {
    this.stop()
    await this.loop
    this.world.dispose()
  }
}
