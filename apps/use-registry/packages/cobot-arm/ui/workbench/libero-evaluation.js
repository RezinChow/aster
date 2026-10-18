// Batch evaluation of the LIBERO tasks over planners x tasks x runs. Run i
// starts from LIBERO init state i, as LIBERO's own evaluation does. Rows keep
// upstream's per-episode fields; per-plan latencies are summarised to fit the
// view state budget.
import { MAX_PLANS, MAX_STEPS, PROTOCOL } from './libero-plan.js'
import { LIBERO_INITS, LIBERO_TASKS, PLANNERS } from './libero-session.js'

export const FORMAT = 'cobot-arm-libero-batch-v1'
export const MAX_RUNS = LIBERO_INITS
// Same bounds as AIX_VIEW_STATE_BYTES and isAixViewState in Studio's aixViewBridge.ts.
export const STATE_BYTES = 64 * 1024
const STATE_NODES = 4096
const MESSAGE_CHARS = 160

const round = (value, digits) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null)
const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null)

/** Every planner, task and run in run order; an empty or unknown choice is refused. */
export function evaluationPlan({ tasks, planners, runs }) {
  if (!Array.isArray(tasks) || tasks.length === 0 || !tasks.every((task) => task in LIBERO_TASKS)) throw new Error('评测任务无效')
  if (!Array.isArray(planners) || planners.length === 0 || !planners.every((planner) => planner in PLANNERS)) throw new Error('评测规划方式无效')
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_RUNS) throw new Error(`每项局数应为 1 到 ${MAX_RUNS}`)
  const plan = []
  for (const planner of Object.keys(PLANNERS).filter((item) => planners.includes(item))) {
    for (const task of Object.keys(LIBERO_TASKS).filter((item) => tasks.includes(item))) {
      for (let run = 0; run < runs; run++) plan.push({ planner, task, run, init: run })
    }
  }
  return plan
}

/** One finished episode as a batch row. */
export function episodeResult(snapshot, run) {
  const calls = snapshot.history.filter((record) => record.model_call)
  const latencies = calls.map((record) => record.latency_ms).filter(Number.isFinite)
  const observation = snapshot.frame?.observation ?? {}
  return {
    task: snapshot.task,
    run,
    init: snapshot.init,
    planner: snapshot.planner,
    success: snapshot.status === 'completed',
    status: snapshot.status,
    steps: snapshot.steps,
    max_steps: snapshot.max_steps,
    plans: snapshot.cycles,
    max_plans: snapshot.max_cycles,
    pixel_targets: snapshot.history.filter((record) => record.plan?.target?.kind === 'pixel').length,
    goal_qpos: (observation.goal_qpos ?? []).map((value) => round(value, 4)),
    message: snapshot.message ? String(snapshot.message).slice(0, MESSAGE_CHARS) : null,
    model: calls.at(-1)?.model ?? null,
    model_calls: snapshot.model_calls,
    model_latency_ms_mean: round(mean(latencies), 0),
    model_latency_ms_max: latencies.length ? round(Math.max(...latencies), 0) : null,
    sim_seconds: round(observation.sim_seconds, 2),
    wall_seconds: snapshot.wall_seconds
  }
}

/** Success rate and cost per planner and task, in plan order. */
export function summarize(results) {
  const groups = new Map()
  for (const row of results) {
    const key = `${row.planner}/${row.task}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return [...groups.values()].map((rows) => {
    const successes = rows.filter((row) => row.success).length
    const latencies = rows.map((row) => row.model_latency_ms_mean).filter(Number.isFinite)
    return {
      planner: rows[0].planner,
      task: rows[0].task,
      episodes: rows.length,
      successes,
      success_rate: round(successes / rows.length, 3),
      mean_steps: round(mean(rows.map((row) => row.steps)), 1),
      mean_plans: round(mean(rows.map((row) => row.plans)), 1),
      model_calls: rows.reduce((sum, row) => sum + row.model_calls, 0),
      mean_model_latency_ms: round(mean(latencies), 0),
      mean_wall_seconds: round(mean(rows.map((row) => row.wall_seconds)), 2)
    }
  })
}

export function evaluationReport({ plan, results, complete }) {
  return {
    format: FORMAT,
    protocol: PROTOCOL,
    suite: 'libero_90',
    budget: { max_steps: MAX_STEPS, max_plans: MAX_PLANS },
    planned: plan.length,
    complete,
    results,
    summary: summarize(results)
  }
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
