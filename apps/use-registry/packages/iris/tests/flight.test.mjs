import assert from 'node:assert/strict'
import test from 'node:test'

import { candidates, eligiblePhases } from '../ui/workbench/planning.js'
import { Session } from '../ui/workbench/session.js'
import { loadMujoco } from '../ui/workbench/engine.js'
import { RobotWorld } from '../ui/workbench/world.js'

const mujoco = await loadMujoco()

function rule(_stage, request) {
  const keys = Object.keys(request.options)
  const baseline = request.baseline_choice
  const choice = keys.length === 1 || !keys.includes(baseline) ? keys[0] : baseline
  return { choice, probabilities: {}, selected_probability: null, provider: 'baseline', model_call: false, reason: 'baseline' }
}

async function fly(task) {
  const session = Session.create(mujoco, { task, seed: 0, choose: rule, speed: 0, maxCycles: 30 })
  session.start()
  await session.loop
  return session
}

test('continuing a low-probability decision executes that reviewed action once', async () => {
  let actionCalls = 0;
  const choose = (stage, request) => {
    const decision = rule(stage, request);
    if (stage === 'action') {
      actionCalls += 1;
      decision.selected_probability = 0.4;
    }
    return decision;
  };
  const session = Session.create(mujoco, { task: 'patrol', choose, threshold: 0.55, speed: 0 });
  const until = async (condition) => {
    const deadline = performance.now() + 3000;
    while (!condition()) {
      if (performance.now() > deadline) throw new Error('session did not reach expected state');
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  try {
    session.start();
    await until(() => session.status === 'uncertain');
    assert.equal(session.cycles, 0);
    session.start(true);
    await until(() => session.status === 'paused' || session.status === 'uncertain');
    assert.equal(session.cycles, 1, 'continue must execute the action already shown for review');
    assert.equal(actionCalls, 1, 'continue must not ask the model to choose again');
    session.start();
    await until(() => session.status === 'uncertain');
    assert.equal(session.cycles, 1, 'the next low-probability action needs another confirmation');
    session.stop();
    await session.loop;
    assert.equal(session.status, 'stopped');
    assert.equal(session.cycles, 1, 'stop must not approve the pending action');
  } finally {
    await session.dispose();
  }
});

test('the iris rests on the pad and names the first waypoint', () => {
  const world = RobotWorld.create(mujoco, 'patrol', 0)
  try {
    assert.equal(world.model.nq, 18)
    assert.equal(world.model.nv, 16)
    assert.equal(world.model.nu, 8)
    assert.ok(Math.abs(world.shared.mass - 1.52) < 1e-6, world.shared.mass)
    assert.equal(world.grounded, true)
    assert.equal(world.unsafeContacts, 0)
    assert.deepEqual(world.objectPoint().map((value) => Number(value.toFixed(4))), [1.2, 0, 1.2])
    const position = world.position
    assert.ok(position[2] > 0.07 && position[2] < 0.1, position[2])
    assert.ok(Math.hypot(position[0], position[1]) < 0.05, position)
  } finally {
    world.dispose()
  }
})

test('a visit preview does not record progress on the live world', () => {
  const world = RobotWorld.create(mujoco, 'patrol', 0)
  try {
    for (const _ of world.motion([0, 0, 1.2], null, 3, false));
    const observation = world.observe()
    assert.deepEqual(eligiblePhases(observation), ['visit'])
    const offered = candidates(world, 'visit', observation).filter((item) => item.id.startsWith('mark'))
    assert.deepEqual(offered.map((item) => item.id), ['mark_1', 'mark_2', 'mark_3'])
    world.visited[0] = true
    const remaining = candidates(world, 'visit', world.observe()).filter((item) => item.id.startsWith('mark'))
    assert.deepEqual(remaining.map((item) => item.id), ['mark_2', 'mark_3'])
    world.visited[0] = false
    const shadow = world.clone()
    try {
      for (const _ of shadow.motion([1.2, 0, 1.2], null, 4, false));
      assert.equal(shadow.visited[0], true)
    } finally {
      shadow.dispose()
    }
    assert.deepEqual(world.visited, [false, false, false])
  } finally {
    world.dispose()
  }
})

test('a hard impact is a crash', () => {
  const world = RobotWorld.create(mujoco, 'patrol', 0)
  try {
    const { qadr, vadr } = world.shared
    world.data.qpos[qadr] = 0
    world.data.qpos[qadr + 1] = 0
    world.data.qpos[qadr + 2] = 1.5
    world.data.qvel[vadr + 2] = -4
    for (let i = 0; i < 200; i += 1) world.tick()
    assert.ok(world.crashed || world.unsafeContacts > 0)
  } finally {
    world.dispose()
  }
})

test('the hook carries the payload and a release lets it fall', () => {
  const world = RobotWorld.create(mujoco, 'delivery', 0)
  try {
    assert.equal(world.attached, false)
    for (const _ of world.motion([0, 0, 1], null, 3, false));
    for (const _ of world.motion([0.9, -0.9, 0.26], 'close', 5, false));
    assert.equal(world.attached, true)
    for (let i = 0; i < 50; i += 1) world.tick()
    const payload = [world.data.xpos[world.shared.payload * 3 + 2]]
    assert.ok(Math.abs(payload[0] - (world.position[2] - 0.16)) < 0.02, payload[0])
    for (const _ of world.motion(null, 'open', 1, false));
    assert.equal(world.attached, false)
  } finally {
    world.dispose()
  }
})

test('an arm task and a position nudge are refused', () => {
  assert.throws(() => RobotWorld.create(mujoco, 'transfer', 0), /不支持任务/)
  const world = RobotWorld.create(mujoco, 'patrol', 0)
  try {
    assert.throws(() => world.perturb(), /位置扰动/)
  } finally {
    world.dispose()
  }
})

for (const task of ['patrol', 'delivery', 'inspect']) {
  test(`the rule baseline completes ${task}`, async () => {
    const session = await fly(task)
    try {
      assert.equal(session.status, 'completed', session.message)
      assert.equal(session.world.success(), true)
      assert.equal(session.world.unsafeContacts, 0)
      assert.equal(session.modelCalls, 0)
      assert.ok(session.cycles > 0 && session.cycles <= 30, session.cycles)
      if (task === 'patrol') {
        assert.equal(session.cycles, 6)
        assert.deepEqual(session.world.visited, [true, true, true])
      }
    } finally {
      await session.dispose()
    }
  })
}
