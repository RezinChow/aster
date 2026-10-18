// Replay the robosuite expert in the browser port (MuJoCo WASM + the JS OSC) on
// the exported physics and report divergence from robosuite step by step.
//
//   LIBERO_EXPORT_OUT=<export output> node tools/libero/js-parity.mjs
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadMujoco } from '../../ui/workbench/engine.js'
import { LiberoWorld } from '../../ui/workbench/libero-world.js'

const out = process.env.LIBERO_EXPORT_OUT || join(tmpdir(), 'libero-export')
const mujoco = await loadMujoco()
for (const task of ['drawer', 'microwave']) {
  const dir = join(out, task)
  const episode = JSON.parse(readFileSync(join(dir, 'episode.json'), 'utf8'))
  const world = LiberoWorld.create(mujoco, { physics: readFileSync(join(dir, 'physics.xml'), 'utf8'), episode })
  const { actions, steps } = episode.reference
  let eef = 0
  let arm = 0
  let firstJs = null
  const marks = {}
  const started = performance.now()
  let finalGoal
  try {
    actions.forEach((action, k) => {
      world.step(action)
      const ref = steps[k]
      const e = Math.max(...world.tcp.map((value, i) => Math.abs(value - ref.eef[i])))
      for (const t of [1e-4, 1e-3, 1e-2]) if (e > t && !(t in marks)) marks[t] = { step: k + 1, goal_js: world.goalQpos()[0], goal_ref: ref.goal_qpos[0] }
      eef = Math.max(eef, e)
      const q = episode.controller.qpos_index.map((i) => world.data.qpos[i])
      arm = Math.max(arm, ...q.map((value, i) => Math.abs(value - ref.arm_qpos[i])))
      if (firstJs === null && world.success()) firstJs = k + 1
    })
    finalGoal = world.goalQpos()
  } finally {
    world.dispose()
  }
  const firstRef = steps.findIndex((s) => s.success) + 1
  const ms = performance.now() - started
  console.log(JSON.stringify({ task, steps: actions.length, eef_max_err_m: eef, arm_qpos_max_err: arm, success_step: { reference: firstRef, js: firstJs }, final_goal_qpos: finalGoal, ms_per_step: +(ms / actions.length).toFixed(2), marks }))
}
