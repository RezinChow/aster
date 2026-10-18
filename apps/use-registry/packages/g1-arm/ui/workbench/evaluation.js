// Batch evaluation over observation modes x tasks x seeds. Each row keeps the
// fields of an EmbodiedJev batch result so the two can be compared row by row;
// per-step model latencies are summarised to fit the view state budget.
import { TASKS } from './world.js'

export const FORMAT = 'g1-arm-batch-v1'
export const MODES = ['privileged', 'rgbd', 'vision']
export const MAX_SEEDS = 10
// Same bounds as AIX_VIEW_STATE_BYTES and isAixViewState in Studio's aixViewBridge.ts.
export const STATE_BYTES = 64 * 1024
const STATE_NODES = 4096
const MESSAGE_CHARS = 160

const round = (value, digits) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null)
const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null)

/** Every mode, task and seed in run order; an empty or unknown choice is refused. */
export function evaluationPlan({ tasks, modes, seeds }) {
  if (!Array.isArray(tasks) || tasks.length === 0 || !tasks.every((task) => task in TASKS)) throw new Error('评测任务无效')
  if (!Array.isArray(modes) || modes.length === 0 || !modes.every((mode) => MODES.includes(mode))) throw new Error('评测观测方式无效')
  if (!Number.isInteger(seeds) || seeds < 1 || seeds > MAX_SEEDS) throw new Error(`种子数应为 1 到 ${MAX_SEEDS}`)
  const plan = []
  for (const mode of MODES.filter((item) => modes.includes(item))) {
    for (const task of Object.keys(TASKS).filter((item) => tasks.includes(item))) {
      for (let seed = 0; seed < seeds; seed++) plan.push({ mode, task, seed })
    }
  }
  return plan
}

/** One finished episode as a batch row. */
export function episodeResult(snapshot) {
  const decisions = snapshot.history.flatMap((record) => [record.intent, record.decision]).filter((item) => item?.model_call)
  const latencies = decisions.map((item) => item.latency_ms).filter(Number.isFinite)
  const observation = snapshot.frame?.observation ?? {}
  return {
    task: snapshot.task,
    seed: snapshot.seed,
    success: snapshot.status === 'completed',
    status: snapshot.status,
    observation_mode: snapshot.observation_mode,
    camera_views: snapshot.observation_mode === 'privileged' ? [] : ['external', 'wrist'],
    control_mode: snapshot.observation_mode === 'vision' ? 'incremental' : 'skills',
    cycles: snapshot.cycles,
    max_cycles: snapshot.max_cycles,
    max_lift_m: round(observation.max_lift_m, 4),
    forbidden_contact_steps: snapshot.history.filter((record) => record.after?.forbidden_contact).length,
    message: snapshot.message ? String(snapshot.message).slice(0, MESSAGE_CHARS) : null,
    model: decisions.at(-1)?.model ?? null,
    model_calls: snapshot.model_calls,
    model_latency_ms_mean: round(mean(latencies), 0),
    model_latency_ms_max: latencies.length ? round(Math.max(...latencies), 0) : null,
    sim_seconds: round(observation.sim_seconds, 2),
    wall_seconds: snapshot.wall_seconds
  }
}

/** Success rate and cost per observation mode and task, in plan order. */
export function summarize(results) {
  const groups = new Map()
  for (const row of results) {
    const key = `${row.observation_mode}/${row.task}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return [...groups.values()].map((rows) => {
    const successes = rows.filter((row) => row.success).length
    const latencies = rows.map((row) => row.model_latency_ms_mean).filter(Number.isFinite)
    return {
      observation_mode: rows[0].observation_mode,
      task: rows[0].task,
      episodes: rows.length,
      successes,
      success_rate: round(successes / rows.length, 3),
      mean_cycles: round(mean(rows.map((row) => row.cycles)), 1),
      model_calls: rows.reduce((sum, row) => sum + row.model_calls, 0),
      mean_model_latency_ms: round(mean(latencies), 0),
      mean_wall_seconds: round(mean(rows.map((row) => row.wall_seconds)), 2)
    }
  })
}

export function evaluationReport({ threshold, plan, results, complete }) {
  return { format: FORMAT, threshold, planned: plan.length, complete, results, summary: summarize(results) }
}

/** The report as view state, or null when it would exceed the host's state limits. */
export function reportState(report) {
  const text = JSON.stringify(report)
  if (new TextEncoder().encode(text).length > STATE_BYTES) return null
  const pending = [{ value: report, depth: 0 }]
  let nodes = 0
  while (pending.length) {
    const { value, depth } = pending.pop()
    if (++nodes > STATE_NODES || depth > 16) return null
    if (value && typeof value === 'object') for (const child of Object.values(value)) pending.push({ value: child, depth: depth + 1 })
  }
  return text
}

/** A stored report, or null when the state is anything else. */
export function storedReport(stateJSON) {
  try {
    const value = JSON.parse(stateJSON)
    return value?.format === FORMAT && Array.isArray(value.results) && Array.isArray(value.summary) ? value : null
  } catch {
    return null
  }
}
