import assert from 'node:assert/strict'
import test from 'node:test'

import { loadMujoco } from '../ui/workbench/engine.js'
import {
  FORMAT,
  MAX_SEEDS,
  MODES,
  STATE_BYTES,
  episodeResult,
  evaluationPlan,
  evaluationReport,
  reportState,
  storedReport,
  summarize
} from '../ui/workbench/evaluation.js'
import { Session } from '../ui/workbench/session.js'
import { TASKS } from '../ui/workbench/world.js'

const mujoco = await loadMujoco()

async function episode(task, seed, choose, mode = 'privileged') {
  const session = await Session.create(mujoco, { task, seed, speed: 0, choose, mode })
  session.start()
  await session.loop
  const snapshot = session.snapshot()
  await session.dispose()
  return snapshot
}

// Catch a batch that skips, repeats or invents a mode, task or seed.
test('the plan runs every chosen mode, task and seed once, in a fixed order', () => {
  assert.deepEqual(evaluationPlan({ tasks: ['stack', 'transfer'], modes: ['rgbd', 'privileged'], seeds: 2 }), [
    { mode: 'privileged', task: 'transfer', seed: 0 },
    { mode: 'privileged', task: 'transfer', seed: 1 },
    { mode: 'privileged', task: 'stack', seed: 0 },
    { mode: 'privileged', task: 'stack', seed: 1 },
    { mode: 'rgbd', task: 'transfer', seed: 0 },
    { mode: 'rgbd', task: 'transfer', seed: 1 },
    { mode: 'rgbd', task: 'stack', seed: 0 },
    { mode: 'rgbd', task: 'stack', seed: 1 }
  ])
  for (const choice of [
    { tasks: [], modes: ['rgbd'], seeds: 1 },
    { tasks: ['shelf'], modes: ['rgbd'], seeds: 1 },
    { tasks: ['stack'], modes: [], seeds: 1 },
    { tasks: ['stack'], modes: ['lidar'], seeds: 1 },
    { tasks: ['stack'], modes: ['rgbd'], seeds: 0 },
    { tasks: ['stack'], modes: ['rgbd'], seeds: MAX_SEEDS + 1 },
    { tasks: ['stack'], modes: ['rgbd'], seeds: 1.5 }
  ]) {
    assert.throws(() => evaluationPlan(choice), JSON.stringify(choice))
  }
})

// Catch a row that misreports success, cost or a stop message.
test('a batch row reports the finished episode and its decision cost', async () => {
  let calls = 0
  const modelled = async (_stage, request) => {
    calls += 1
    return { choice: request.baseline_choice, model: 'proof-model', model_call: true, latency_ms: 40 + (calls % 3) * 10 }
  }
  const done = episodeResult(await episode('transfer', 0, modelled))
  assert.equal(done.success, true)
  assert.equal(done.status, 'completed')
  assert.equal(done.control_mode, 'skills')
  assert.deepEqual(done.camera_views, [])
  assert.equal(done.model, 'proof-model')
  assert.equal(done.model_calls, calls)
  assert.ok(done.cycles > 0 && done.cycles <= done.max_cycles)
  assert.ok(done.max_lift_m > 0.1, `lift ${done.max_lift_m}`)
  assert.ok(done.model_latency_ms_mean >= 40 && done.model_latency_ms_max === 60)
  assert.equal(done.message, null)

  const failed = episodeResult(await episode('transfer', 0, async () => ({}), 'vision'))
  assert.equal(failed.success, false)
  assert.equal(failed.status, 'error')
  assert.equal(failed.control_mode, 'incremental')
  assert.equal(failed.model_calls, 0)
  assert.equal(failed.model_latency_ms_mean, null)
  assert.ok(failed.message.length > 0)
})

// Catch a summary that counts a failure as a success or mixes modes.
test('the summary gives success rate and cost per mode and task', () => {
  const row = (observation_mode, task, success, cycles, model_calls, model_latency_ms_mean) => ({
    observation_mode,
    task,
    success,
    cycles,
    model_calls,
    model_latency_ms_mean,
    wall_seconds: 2
  })
  assert.deepEqual(
    summarize([
      row('vision', 'stack', true, 60, 60, 5000),
      row('vision', 'stack', false, 80, 80, 7000),
      row('privileged', 'stack', true, 12, 0, null)
    ]),
    [
      { observation_mode: 'vision', task: 'stack', episodes: 2, successes: 1, success_rate: 0.5, mean_cycles: 70, model_calls: 140, mean_model_latency_ms: 6000, mean_wall_seconds: 2 },
      { observation_mode: 'privileged', task: 'stack', episodes: 1, successes: 1, success_rate: 1, mean_cycles: 12, model_calls: 0, mean_model_latency_ms: null, mean_wall_seconds: 2 }
    ]
  )
})

// Catch the largest batch overflowing the host's view state, which would close the view port.
test('the largest batch report fits the view state and reads back', () => {
  const plan = evaluationPlan({ tasks: Object.keys(TASKS), modes: MODES, seeds: MAX_SEEDS })
  assert.equal(plan.length, 90)
  const message = '视觉模型没有给出可执行的动作（model reply named no offered option），已停止；没有使用规则替代。'.repeat(3)
  const results = plan.map(({ mode, task, seed }) =>
    episodeResult({
      task,
      seed,
      status: 'error',
      observation_mode: mode,
      cycles: 80,
      max_cycles: 80,
      message,
      model_calls: 80,
      wall_seconds: 612.34,
      frame: { observation: { max_lift_m: 0.123456, sim_seconds: 61.234 } },
      history: [{ decision: { model_call: true, model: 'bailian/deepseek-v4.1-flash', latency_ms: 6123.4 }, after: { forbidden_contact: true } }]
    })
  )
  const report = evaluationReport({ threshold: 0.55, plan, results, complete: true })
  const state = reportState(report)
  assert.ok(state, 'the report fits')
  assert.ok(new TextEncoder().encode(state).length <= STATE_BYTES)
  assert.deepEqual(storedReport(state), report)
  assert.equal(storedReport(state).format, FORMAT)
  assert.equal(reportState({ results: [{ text: 'x'.repeat(STATE_BYTES) }] }), null)
  for (const other of [null, '', '{', '{"format":"other","results":[],"summary":[]}', '{"format":"g1-arm-batch-v1"}']) {
    assert.equal(storedReport(other), null, String(other))
  }
})
