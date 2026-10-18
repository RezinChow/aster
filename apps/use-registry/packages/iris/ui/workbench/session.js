// One flight episode. Same decision loop as the arm workbenches: choose a
// phase, preview the candidates, choose an action, then fly it.
import { baselinePhase, candidates, eligiblePhases, phaseOptions, previewCandidates } from './planning.js'
import { RobotWorld } from './world.js'

const TERMINAL = new Set(['completed', 'stopped', 'error', 'exhausted', 'stalled'])
const dist = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]))
const copy = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
const later = () => new Promise((resolve) => setTimeout(resolve, 0))

function compactObservation(observation) {
  return {
    goal: observation.task,
    units: 'metres',
    tcp: observation.tcp,
    object: observation.object,
    destination: observation.destination,
    mission: observation.mission,
    support_contact: observation.support_contact,
    forbidden_contact: observation.forbidden_contact,
    success: observation.success
  }
}

export function decisionState(observation, history) {
  return {
    observation: compactObservation(observation),
    recent_outcomes: history.slice(-2).map((item) => ({
      phase: item.phase,
      option: item.action.id,
      tcp_displacement_m: Number(dist(item.before.tcp, item.after.tcp).toFixed(4)),
      success_after: item.after.success,
      mission_after: item.after.mission
    }))
  }
}

function episodeId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export class Session {
  static create(mujoco, { task = 'patrol', seed = 0, threshold = 0.55, maxCycles = 30, speed = 1.5, choose }) {
    const world = RobotWorld.create(mujoco, task, seed)
    return new Session(world, { threshold, maxCycles, speed, choose })
  }

  constructor(world, { threshold, maxCycles, speed, choose }) {
    this.id = episodeId()
    this.world = world
    this.choose = choose
    this.mode = 'privileged'
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
    this.abort = new AbortController()
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
    if (!this.loop) this.loop = this.run().finally(() => { this.loop = null })
  }

  pause() {
    if (this.status === 'running') this.status = 'paused'
  }

  stop() {
    this.cancelled = true
    this.abort.abort()
    if (this.status !== 'completed') this.status = 'stopped'
    this.finished = performance.now()
    this.wake()
  }

  belowThreshold(decision) {
    const probability = decision.selected_probability
    if (typeof probability !== 'number' || probability >= this.threshold) return false
    this.status = 'uncertain'
    this.stage = 'deciding'
    this.message = '候选动作概率低于设定门槛。确认后执行当前动作，或重置实验。'
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
    const decision = await this.choose(stage, request, this.abort.signal)
    if (decision.model_call) this.modelCalls += 1
    if (this.cancelled) return null
    if (!(decision.choice in options)) throw new Error('决策返回了未提供的选项')
    return decision
  }

  async execute(selected) {
    const unsafeBefore = this.world.unsafeContacts
    for (const frame of this.world.motion(selected.target, selected.gripper, selected.seconds)) {
      if (!(await this.awake())) return false
      this.record(frame)
      if (this.world.unsafeContacts > unsafeBefore) throw new Error('执行层检测到坠机或倾覆，已停止')
      if (this.speed > 0) await this.sleep(40 / this.speed)
      if (this.cancelled) return false
    }
    return true
  }

  async run() {
    try {
      await this.runSkills()
    } catch (failure) {
      if (!this.cancelled) {
        this.status = 'error'
        this.message = String(failure?.message ?? failure)
        this.finished = performance.now()
      }
    }
  }

  async runSkills() {
    const world = this.world
    while (!this.cancelled) {
      if (!(await this.awake())) return
      if (this.cycles >= this.maxCycles) {
        this.status = 'exhausted'
        this.message = '已达到动作预算'
        this.finished = performance.now()
        return
      }
      const observation = world.observe()
      const phases = eligiblePhases(observation)
      this.stage = 'deciding'
      this.lastDecision = null
      this.lastIntent = null
      this.lastInputs = { phase: null, action: null }
      this.currentCandidates = []
      const intent = await this.decide(
        'phase',
        observation,
        'Choose the next flight phase that makes progress toward the mission. Use only the mission state in the observation.',
        phaseOptions(world, phases, observation),
        baselinePhase(observation)
      )
      if (!intent) return
      this.lastIntent = intent
      if (this.belowThreshold(intent) && !(await this.awake())) return
      const phase = intent.choice
      this.phase = phase
      if (phase === 'finish') {
        this.finish()
        return
      }
      this.stage = 'previewing'
      const options = candidates(world, phase, observation)
      await previewCandidates(world, options, phase, this.speed > 0 ? later : null)
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
            target_tcp: item.target.slice(0, 3).map((value) => Number(value.toFixed(4))),
            hook: item.gripper ?? 'unchanged',
            duration_seconds: item.seconds,
            preview: item.preview
          })
        ])
      )
      const decision = await this.decide(
        'action',
        observation,
        `Select the action that progresses the chosen phase. Hold only when moving is unjustified. Chosen phase: ${phase}. All offered actions passed the simulation checks.`,
        menu,
        progress[0].id
      )
      if (!decision) return
      if (this.belowThreshold(decision)) {
        this.lastDecision = decision
        if (!(await this.awake())) return
      }
      const selected = legal.find((item) => item.id === decision.choice)
      this.cycles += 1
      this.lastDecision = decision
      this.stage = 'executing'
      if (!(await this.execute(selected))) return
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
        this.message = '连续三次重复选择未带来位移变化，已停止推理；请查看历史决策后重置。'
        this.finished = performance.now()
        return
      }
      if (this.singleStep) this.pause()
    }
  }

  stalled() {
    if (this.history.length < 3) return false
    const recent = this.history.slice(-3)
    if (new Set(recent.map((item) => item.action.id)).size !== 1) return false
    for (const item of recent) if (dist(item.before.tcp, item.after.tcp) >= 0.05) return false
    return dist(recent[0].before.tcp, recent[2].after.tcp) < 0.05
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
      observation_mode: this.mode,
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

  async dispose() {
    this.stop()
    await this.loop
    this.world.dispose()
  }
}
