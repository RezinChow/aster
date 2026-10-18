// 3DR Iris quadrotor in MuJoCo. Ported from EmbodiedJev IrisSpec (MIT):
// the same cascaded PID, waypoint visits, hook carry, and inspection dwell.
export const ROBOT = '3DR iris 四旋翼'
export const DT = 0.002
export const TASKS = {
  patrol: { name: '空中巡航', goal: '依次飞抵三个航点标记并悬停确认，最后返回起降坪平稳降落。' },
  delivery: { name: '外卖配送', goal: '飞到取件点正上方挂钩取件，把载荷送进投放区圆环内释放，再返回起降坪降落。' },
  inspect: { name: '设施巡检', goal: '依次飞到三个巡检抵近点、机头对准塔体停留观察，完成后返回起降坪降落。' }
}

const MARKS = [
  [1.2, 0],
  [1.2, 1.2],
  [0, 1.2]
]
const MARK_Z = 1.2
const PAD_R = 0.45
const REST = 0.079
const VISIT_R = 0.22
const ROTORS = [
  [0.13, -0.22, 1],
  [-0.13, 0.2, 1],
  [0.13, 0.22, -1],
  [-0.13, -0.2, -1]
]
const DELIV_A = [0.9, -0.9]
const DELIV_B = [-0.9, 0.9]
const DROP_R = 0.28
const PAY_HALF_Z = 0.07
const ATTACH_Z = 0.26
const HOOK = [0, 0, -0.16]
const PAY_MASS = 0.35
const TOWER = [1, 0.6]
const TOWER_HALF = [0.18, 0.18, 0.35]
const FACE_POINTS = [
  [1.215, 0.6, 0.45],
  [0.785, 0.6, 0.55],
  [1, 0.815, 0.3]
]
const INSPECT = [
  [1.79, 0.6, 0.95],
  [0.21, 0.6, 0.95],
  [1, 1.39, 0.95]
]
const DWELL_NEED = 1
const DWELL_POS_R = 0.3
const DWELL_YAW = 0.5
const KP_POS = 4
const KD_POS = 4
const TILT_MAX = 0.35
const KP_Z = 30
const KD_Z = 22
const KP_ATT = 9
const KD_ATT = 1.6
const KQ = 0.016
const THRUST_MAX = 14
const G = 9.81
const WORKSPACE = [
  [-2.5, -2.5, 0.05],
  [2.5, 2.5, 2.2]
]
const OBJ = { BODY: 1, JOINT: 3, GEOM: 5, SITE: 6, ACTUATOR: 19 }

const round = (value, digits) => Number(value.toFixed(digits))
const triple = (array, at) => [array[at * 3], array[at * 3 + 1], array[at * 3 + 2]]

function geom(name, type, extra) {
  return `<geom name="${name}" type="${type}" ${extra}/>`
}

export function buildScene(task) {
  if (!TASKS[task]) throw new Error(`无人机构型不支持任务 ${task}`)
  const marks =
    task === 'patrol'
      ? MARKS.map(
          ([x, y], index) =>
            geom(`mark_${index}`, 'cylinder', `class="visual" size="0.25 0.004" pos="${x} ${y} 0.004" rgba="0.88 0.19 0.19 1"`) +
            geom(`mark_inner_${index}`, 'cylinder', `class="visual" size="0.18 0.005" pos="${x} ${y} 0.005" rgba="0.95 0.80 0.20 1"`)
        ).join('')
      : ''
  const delivery =
    task === 'delivery'
      ? geom('drop_ring', 'cylinder', `class="visual" size="${DROP_R} 0.004" pos="${DELIV_B[0]} ${DELIV_B[1]} 0.004" rgba="0.88 0.19 0.19 1"`) +
        geom('drop_inner', 'cylinder', `class="visual" size="${DROP_R - 0.07} 0.005" pos="${DELIV_B[0]} ${DELIV_B[1]} 0.005" rgba="0.95 0.80 0.20 1"`) +
        geom('pick_ring', 'cylinder', `class="visual" size="0.25 0.004" pos="${DELIV_A[0]} ${DELIV_A[1]} 0.004" rgba="0.20 0.50 0.85 1"`)
      : ''
  const tower =
    task === 'inspect'
      ? `<body name="tower">${geom('tower_body', 'box', `size="${TOWER_HALF.join(' ')}" pos="${TOWER[0]} ${TOWER[1]} ${TOWER_HALF[2]}" rgba="0.35 0.38 0.42 1" friction="1 0.01 0.001"`)}${geom(
          'tower_band',
          'box',
          `class="visual" size="${TOWER_HALF[0] + 0.005} ${TOWER_HALF[1] + 0.005} 0.03" pos="${TOWER[0]} ${TOWER[1]} ${2 * TOWER_HALF[2] - 0.08}" rgba="0.85 0.45 0.10 1"`
        )}</body>${FACE_POINTS.map(([x, y, z], index) => geom(`inspect_${index}`, 'sphere', `class="visual" size="0.045" pos="${x} ${y} ${z}" rgba="0.20 0.50 0.85 1"`)).join('')}${INSPECT.map(
          ([x, y], index) => geom(`standoff_${index}`, 'cylinder', `class="visual" size="0.22 0.004" pos="${x} ${y} 0.004" rgba="0.20 0.50 0.85 1"`)
        ).join('')}`
      : ''
  const payloadPos = task === 'delivery' ? '0.9 -0.9 0.07' : '6 6 0.07'
  const payloadGeom = task === 'delivery' ? '' : ' group="3" contype="0" conaffinity="0"'
  const rotors = ROTORS.map(
    ([x, y], index) => `<body name="rotor_${index + 1}_hub" pos="${x} ${y} 0.036">
      <joint name="spin_${index + 1}" type="hinge" axis="0 0 1" armature="0.00002" damping="0.0004"/>
      <inertial pos="0 0 0" mass="0.005" diaginertia="1e-05 1e-05 1e-05"/>
      <site name="rotor_${index + 1}" pos="0 0 0"/>
    </body>`
  ).join('')
  const xml = `<mujoco model="EmbodiedJev - Xingzhi - 3DR iris">
  <compiler angle="radian" autolimits="true"/>
  <option timestep="${DT}" integrator="implicitfast" density="0" viscosity="0.03"/>
  <default>
    <default class="iris">
      <geom friction="1 0.005 0.001"/>
      <default class="visual"><geom group="2" contype="0" conaffinity="0" density="0"/></default>
      <default class="collision"><geom group="3"/></default>
      <default class="thruster"><motor ctrllimited="true" ctrlrange="0 14"/></default>
      <default class="spin"><velocity ctrllimited="true" ctrlrange="-160 160" kv="0.004"/></default>
    </default>
  </default>
  <worldbody>
    ${geom('floor', 'plane', 'size="12 12 0.1" rgba="0.42 0.45 0.48 1" friction="1 0.005 0.001"')}
    ${geom('support', 'cylinder', `size="${PAD_R} 0.006" pos="0 0 0.006" rgba="0.10 0.44 0.72 1" friction="1.4 0.005 0.001"`)}
    ${marks}${delivery}${tower}
    <body name="base_link" childclass="iris" pos="0 0 0.09">
      <freejoint name="free_joint"/>
      <inertial pos="0 0 0" mass="1.5" diaginertia="0.029125 0.029125 0.055225"/>
      <geom class="collision" type="box" pos="-0.0065 0.002 -0.010" size="0.1495 0.239 0.057"/>
      <site name="imu" pos="0 0 0"/>
      <site name="tcp" pos="0 0 0" size="0.02" rgba="0 0 0 0"/>
      <site name="down_ranger" pos="0 0 -0.06" quat="0 1 0 0"/>
      ${rotors}
    </body>
    <body name="payload" pos="${payloadPos}">
      <freejoint name="payload_joint"/>
      <geom class="collision" type="box" size="0.09 0.09 0.07" mass="0.35" rgba="0.85 0.45 0.10 1"${payloadGeom}/>
      <geom class="visual" type="box" size="0.09 0.09 0.07" rgba="0.85 0.45 0.10 1"${payloadGeom}/>
      <geom class="visual" type="box" size="0.012 0.095 0.075" rgba="0.1 0.1 0.1 1"${payloadGeom}/>
    </body>
  </worldbody>
  <actuator>
    ${ROTORS.map((_, index) => `<motor class="thruster" name="rotor_${index + 1}" site="rotor_${index + 1}" gear="0 0 1 0 0 ${ROTORS[index][2] * KQ}"/>`).join('')}
    ${ROTORS.map((_, index) => `<velocity class="spin" name="spin_${index + 1}" joint="spin_${index + 1}"/>`).join('')}
  </actuator>
  <sensor>
    <gyro name="body_gyro" site="imu"/>
    <framequat name="body_quat" objtype="site" objname="imu"/>
    <framepos name="body_pos" objtype="site" objname="imu"/>
    <rangefinder name="agl" site="down_ranger" cutoff="10"/>
  </sensor>
</mujoco>`
  return { xml, target: [0, 0, 1], source: [0, 0, REST] }
}

function solve4(matrix, values) {
  const rows = matrix.map((row, index) => [...row, values[index]])
  for (let column = 0; column < 4; column += 1) {
    let pivot = column
    for (let row = column + 1; row < 4; row += 1) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row
    ;[rows[column], rows[pivot]] = [rows[pivot], rows[column]]
    const scale = rows[column][column]
    if (Math.abs(scale) < 1e-12) throw new Error('rotor mix is singular')
    for (let k = column; k < 5; k += 1) rows[column][k] /= scale
    for (let row = 0; row < 4; row += 1) {
      if (row === column) continue
      const factor = rows[row][column]
      for (let k = column; k < 5; k += 1) rows[row][k] -= factor * rows[column][k]
    }
  }
  return rows.map((row) => Math.max(0, Math.min(THRUST_MAX, row[4])))
}

const MIX = [
  [1, 1, 1, 1],
  ROTORS.map((rotor) => rotor[1]),
  ROTORS.map((rotor) => -rotor[0]),
  ROTORS.map((rotor) => rotor[2] * KQ)
]

function yawTo(index) {
  const [px, py] = INSPECT[index]
  return Math.atan2(TOWER[1] - py, TOWER[0] - px)
}

function poses(xpos, xmat, count) {
  const out = new Array(count)
  for (let i = 0; i < count; i += 1) {
    out[i] = [
      xpos[i * 3],
      xpos[i * 3 + 1],
      xpos[i * 3 + 2],
      xmat[i * 9],
      xmat[i * 9 + 1],
      xmat[i * 9 + 2],
      xmat[i * 9 + 3],
      xmat[i * 9 + 4],
      xmat[i * 9 + 5],
      xmat[i * 9 + 6],
      xmat[i * 9 + 7],
      xmat[i * 9 + 8]
    ]
  }
  return out
}

export class RobotWorld {
  static create(mujoco, task = 'patrol', seed = 0) {
    const { xml, target, source } = buildScene(task)
    const model = mujoco.MjModel.from_xml_string(xml)
    const world = new RobotWorld(mujoco, model, new mujoco.MjData(model), { task, seed, target, source })
    world.settle()
    return world
  }

  constructor(mujoco, model, data, { task, seed, target, source, shared }) {
    this.mujoco = mujoco
    this.model = model
    this.data = data
    this.task = task
    this.seed = seed
    this.target = target
    this.source = source
    this.shared = shared ?? this.index()
    this.visited = MARKS.map(() => false)
    this.grounded = true
    this.crashed = false
    this.attached = false
    this.inspected = INSPECT.map(() => false)
    this.dwell = INSPECT.map(() => 0)
    this.yawD = 0
    this.closed = false
    this.stableSeconds = 0
    this.maxLift = 0
    this.unsafeContacts = 0
    this.steps = 0
    this.startTime = 0
  }

  index() {
    const { mujoco, model } = this
    const id = (type, name) => {
      const found = mujoco.mj_name2id(model, type, name)
      if (found < 0) throw new Error(`scene has no ${name}`)
      return found
    }
    const joint = id(OBJ.JOINT, 'free_joint')
    const payload = id(OBJ.JOINT, 'payload_joint')
    return {
      tcp: id(OBJ.SITE, 'tcp'),
      qadr: model.jnt_qposadr[joint],
      vadr: model.jnt_dofadr[joint],
      payloadQ: model.jnt_qposadr[payload],
      payloadD: model.jnt_dofadr[payload],
      payload: id(OBJ.BODY, 'payload'),
      drone: id(OBJ.BODY, 'base_link'),
      act: [1, 2, 3, 4].map((index) => id(OBJ.ACTUATOR, `rotor_${index}`)),
      spin: [1, 2, 3, 4].map((index) => id(OBJ.ACTUATOR, `spin_${index}`)),
      spinSign: ROTORS.map((rotor) => rotor[2]),
      mass: model.body_subtreemass[id(OBJ.BODY, 'base_link')]
    }
  }

  settle() {
    const { mujoco, model, data } = this
    mujoco.mj_forward(model, data)
    for (let i = 0; i < 250; i += 1) this.tick()
    this.steps = 0
    this.startTime = data.time
    this.maxLift = 0
  }

  get position() {
    return triple(this.data.site_xpos, this.shared.tcp)
  }

  pose() {
    const { data, shared } = this
    const q = shared.qadr
    const v = shared.vadr
    const w = data.qpos[q + 3]
    const x = data.qpos[q + 4]
    const y = data.qpos[q + 5]
    const z = data.qpos[q + 6]
    return {
      p: [data.qpos[q], data.qpos[q + 1], data.qpos[q + 2]],
      v: [data.qvel[v], data.qvel[v + 1], data.qvel[v + 2]],
      om: [data.qvel[v + 3], data.qvel[v + 4], data.qvel[v + 5]],
      quat: [w, x, y, z],
      up: 1 - 2 * (x * x + y * y)
    }
  }

  euler() {
    const [w, x, y, z] = this.pose().quat
    return [
      Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)),
      Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x)))),
      Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))
    ]
  }

  objectPoint() {
    if (this.task === 'delivery') {
      if (!this.attached) return [DELIV_A[0], DELIV_A[1], ATTACH_Z]
      return [DELIV_B[0], DELIV_B[1], 1.2]
    }
    if (this.task === 'inspect') {
      const next = this.inspected.findIndex((done) => !done)
      if (next >= 0) return INSPECT[next].slice(0, 3)
      return [0, 0, 1]
    }
    const next = this.visited.findIndex((done) => !done)
    if (next >= 0) return [MARKS[next][0], MARKS[next][1], MARK_Z]
    return [0, 0, 1]
  }

  get cube() {
    return this.objectPoint()
  }

  contacts() {
    const { p, v } = this.pose()
    const onPad = p[2] <= REST + 0.01 && Math.hypot(p[0], p[1]) < PAD_R && Math.abs(v[2]) < 0.15
    return { fingers: new Set(), support: onPad, forbidden: this.crashed }
  }

  tick() {
    const { data, mujoco, model } = this
    mujoco.mj_step(model, data)
    this.steps += 1
    const { forbidden } = this.contacts()
    this.unsafeContacts += forbidden ? 1 : 0
    this.tickExtra()
    for (const value of data.qpos) if (!Number.isFinite(value)) throw new Error('MuJoCo state became non-finite')
  }

  tickExtra() {
    const { data, shared } = this
    const { p, v, om, up, quat } = this.pose()
    data.qfrc_applied[shared.vadr + 2] = this.attached ? -PAY_MASS * G : 0
    if (this.attached) {
      const rotation = data.xmat.subarray(shared.drone * 9, shared.drone * 9 + 9)
      const hooked = [
        p[0] + rotation[0] * HOOK[0] + rotation[1] * HOOK[1] + rotation[2] * HOOK[2],
        p[1] + rotation[3] * HOOK[0] + rotation[4] * HOOK[1] + rotation[5] * HOOK[2],
        p[2] + rotation[6] * HOOK[0] + rotation[7] * HOOK[1] + rotation[8] * HOOK[2]
      ]
      const qpos = data.qpos
      const qvel = data.qvel
      qpos[shared.payloadQ] = hooked[0]
      qpos[shared.payloadQ + 1] = hooked[1]
      qpos[shared.payloadQ + 2] = hooked[2]
      qpos[shared.payloadQ + 3] = quat[0]
      qpos[shared.payloadQ + 4] = quat[1]
      qpos[shared.payloadQ + 5] = quat[2]
      qpos[shared.payloadQ + 6] = quat[3]
      const r = [hooked[0] - p[0], hooked[1] - p[1], hooked[2] - p[2]]
      const carried = [
        v[0] + om[1] * r[2] - om[2] * r[1],
        v[1] + om[2] * r[0] - om[0] * r[2],
        v[2] + om[0] * r[1] - om[1] * r[0]
      ]
      for (let axis = 0; axis < 3; axis += 1) {
        qvel[shared.payloadD + axis] = carried[axis]
        qvel[shared.payloadD + 3 + axis] = om[axis]
      }
    }
    if (this.task === 'inspect' && !this.grounded) {
      const yaw = this.euler()[2]
      INSPECT.forEach((point, index) => {
        if (this.inspected[index]) return
        const near = Math.hypot(p[0] - point[0], p[1] - point[1], p[2] - point[2]) < DWELL_POS_R
        const wanted = yawTo(index)
        const facing = Math.abs(Math.atan2(Math.sin(wanted - yaw), Math.cos(wanted - yaw))) < DWELL_YAW
        if (near && facing) {
          this.dwell[index] += DT
          if (this.dwell[index] >= DWELL_NEED) this.inspected[index] = true
        }
      })
    }
    if (this.task === 'patrol') {
      MARKS.forEach(([x, y], index) => {
        if (!this.visited[index] && Math.hypot(p[0] - x, p[1] - y) < VISIT_R && Math.abs(p[2] - MARK_Z) < 0.25) this.visited[index] = true
      })
    }
    this.maxLift = Math.max(this.maxLift, p[2])
    const airborne = p[2] > REST + 0.03
    if (airborne && (up < 0.86 || data.qvel[shared.vadr + 2] < -2.5)) this.crashed = true
    if (this.crashed || (!airborne && this.grounded)) {
      for (const actuator of shared.act) data.ctrl[actuator] = 0
      for (const actuator of shared.spin) data.ctrl[actuator] = 0
    }
    this.grounded = p[2] <= REST + 0.012 && Math.abs(v[2]) < 0.15
    if (this.success()) this.stableSeconds += DT
    else this.stableSeconds = 0
  }

  success() {
    const { p, up } = this.pose()
    if (!(this.grounded && up > 0.98 && Math.hypot(p[0], p[1]) < PAD_R)) return false
    if (this.task === 'patrol') return this.visited.every(Boolean)
    if (this.task === 'delivery') {
      const payload = triple(this.data.xpos, this.shared.payload)
      return !this.attached && payload[2] < PAY_HALF_Z + 0.03 && Math.hypot(payload[0] - DELIV_B[0], payload[1] - DELIV_B[1]) < DROP_R
    }
    return this.inspected.every(Boolean)
  }

  missionState() {
    const base = {
      task: this.task,
      grounded: this.grounded,
      yaw_deg: round(this.euler()[2] * (180 / Math.PI), 1),
      pad_hover: [0, 0, 1],
      rest_z: REST
    }
    if (this.task === 'patrol') {
      base.visited = this.visited.map(Boolean)
      base.marks = MARKS.map(([x, y]) => [x, y, MARK_Z])
    } else if (this.task === 'delivery') {
      const payload = triple(this.data.xpos, this.shared.payload)
      base.held = this.attached
      base.payload = payload.map((value) => round(value, 4))
      base.pickup = [...DELIV_A, ATTACH_Z]
      base.drop = [...DELIV_B, 0.24]
      base.drop_zone = [...DELIV_B, DROP_R]
    } else {
      base.inspected = this.inspected.map(Boolean)
      base.dwell_s = this.dwell.map((value) => round(value, 2))
      base.points = INSPECT.map((point, index) => [...point, yawTo(index)])
      base.face_points = FACE_POINTS.map((point) => [...point])
      base.tower = [...TOWER]
    }
    return base
  }

  *fly(target, gripper, seconds, emit) {
    const goal = target.length === 4 ? target.slice(0, 3) : target
    if (target.length === 4) this.yawD = Math.atan2(Math.sin(target[3]), Math.cos(target[3]))
    const { data, shared } = this
    const count = Math.max(1, Math.floor(seconds / DT))
    let descend = null
    let finished = false
    for (let i = 1; i <= count; i += 1) {
      const { p, v, om, up, quat } = this.pose()
      if (goal[2] <= 0.35) descend = descend === null ? p[2] : Math.max(goal[2], descend - 0.45 * DT)
      const [w, x, y, z] = quat
      const roll = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y))
      const pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x))))
      const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))
      const zSet = descend === null ? goal[2] : descend
      const mass = shared.mass + (this.attached ? PAY_MASS : 0)
      const thrust = (mass * (G + KP_Z * (zSet - p[2]) + KD_Z * -v[2])) / Math.max(up, 0.6)
      const ax = KP_POS * (goal[0] - p[0]) + KD_POS * -v[0]
      const ay = KP_POS * (goal[1] - p[1]) + KD_POS * -v[1]
      const cy = Math.cos(yaw)
      const sy = Math.sin(yaw)
      const axb = cy * ax + sy * ay
      const ayb = -sy * ax + cy * ay
      const pitchD = Math.max(-TILT_MAX, Math.min(TILT_MAX, axb / G))
      const rollD = Math.max(-TILT_MAX, Math.min(TILT_MAX, -ayb / G))
      const yawError = Math.atan2(Math.sin(this.yawD - yaw), Math.cos(this.yawD - yaw))
      const rate = Math.max(-1.5, Math.min(1.5, 2 * yawError))
      const forces = solve4(MIX, [thrust, KP_ATT * (rollD - roll) - KD_ATT * om[0], KP_ATT * (pitchD - pitch) - KD_ATT * om[1], 0.9 * (rate - om[2])])
      shared.act.forEach((actuator, index) => {
        data.ctrl[actuator] = forces[index]
      })
      shared.spin.forEach((actuator, index) => {
        const thrustNow = Math.max(0, Math.min(12, forces[index]))
        data.ctrl[actuator] = shared.spinSign[index] * (20 + 100 * Math.sqrt(thrustNow / 12))
      })
      this.tick()
      if (goal[2] <= REST + 0.05 && p[2] <= REST + 0.02) {
        for (const actuator of shared.act) data.ctrl[actuator] = 0
        for (const actuator of shared.spin) data.ctrl[actuator] = 0
        for (let extra = 0; extra < 60; extra += 1) this.tick()
        finished = true
        break
      }
      if (i % 20 === 0 || i === count) yield emit ? this.frame() : null
    }
    if (finished && emit) yield this.frame()
    if (gripper === 'close') {
      const payload = triple(data.xpos, shared.payload)
      const here = this.position
      if (Math.hypot(payload[0] - here[0], payload[1] - here[1]) < 0.22 && Math.abs(here[2] - ATTACH_Z) < 0.12) this.attached = true
      else throw new Error('挂钩未进入取件窗口：请先飞到载荷正上方的取件高度')
    } else if (gripper === 'open') this.attached = false
  }

  *motion(target, gripper, seconds = 0.6, emit = true) {
    const goal = target ?? this.position
    if (![3, 4].includes(goal.length) || !goal.every(Number.isFinite)) throw new Error('Target must contain three finite coordinates (four with yaw for flight)')
    if (![null, undefined, 'open', 'close'].includes(gripper) || !Number.isFinite(seconds) || !(seconds > 0 && seconds <= 10)) {
      throw new Error('Invalid gripper command or motion duration')
    }
    if (goal.slice(0, 3).some((value, index) => value < WORKSPACE[0][index] || value > WORKSPACE[1][index])) throw new Error('Target outside workspace')
    yield* this.fly(goal, gripper, seconds, emit)
  }

  observe() {
    const { support, forbidden } = this.contacts()
    const tcp = this.position
    const cube = this.cube
    return {
      task: TASKS[this.task].goal,
      robot: ROBOT,
      source: 'MuJoCo geometry and flight state',
      units: 'metres',
      scene_name: TASKS[this.task].name,
      tcp: tcp.map((value) => round(value, 5)),
      object: cube.map((value) => round(value, 5)),
      relative_geometry: {
        tcp_object_xy_distance_m: round(Math.hypot(tcp[0] - cube[0], tcp[1] - cube[1]), 4),
        tcp_above_object_m: round(tcp[2] - cube[2], 4),
        object_destination_xy_distance_m: round(Math.hypot(cube[0] - this.target[0], cube[1] - this.target[1]), 4),
        object_above_destination_m: round(cube[2] - this.target[2], 4),
        travel_tcp_height_m: MARK_Z
      },
      destination: [...this.target],
      gripper: 'open',
      finger_contacts: [],
      held: false,
      grasp_secured: false,
      support_contact: support,
      stable_seconds: round(this.stableSeconds, 3),
      success: this.success(),
      forbidden_contact: forbidden,
      max_lift_m: round(this.maxLift, 4),
      sim_seconds: round(this.data.time - this.startTime, 3),
      mission: this.missionState()
    }
  }

  frame(observation) {
    const { data, mujoco, model } = this
    mujoco.mj_forward(model, data)
    return {
      time: data.time,
      qpos: Array.from(data.qpos),
      bodies: poses(data.xpos, data.xmat, model.nbody),
      geoms: poses(data.geom_xpos, data.geom_xmat, model.ngeom),
      observation: observation ?? this.observe()
    }
  }

  replayFrame(qpos) {
    const shadow = new this.mujoco.MjData(this.model)
    try {
      shadow.qpos.set(qpos)
      this.mujoco.mj_kinematics(this.model, shadow)
      return { bodies: poses(shadow.xpos, shadow.xmat, this.model.nbody), geoms: poses(shadow.geom_xpos, shadow.geom_xmat, this.model.ngeom) }
    } finally {
      shadow.delete()
    }
  }

  primitives() {
    const { mujoco, model } = this
    const items = []
    for (let i = 0; i < model.ngeom; i += 1) {
      if (model.geom_group[i] === 3) continue
      items.push({
        id: i,
        name: mujoco.mj_id2name(model, OBJ.GEOM, i) ?? '',
        type: model.geom_type[i],
        size: Array.from(model.geom_size.subarray(i * 3, i * 3 + 3)),
        color: Array.from(model.geom_rgba.subarray(i * 4, i * 4 + 4))
      })
    }
    return items
  }

  bodyId(name) {
    return this.mujoco.mj_name2id(this.model, OBJ.BODY, name)
  }

  clone() {
    const other = new RobotWorld(this.mujoco, this.model, new this.mujoco.MjData(this.model, this.data), {
      task: this.task,
      seed: this.seed,
      target: [...this.target],
      source: [...this.source],
      shared: this.shared
    })
    other.visited = this.visited.slice()
    other.inspected = this.inspected.slice()
    other.dwell = this.dwell.slice()
    other.grounded = this.grounded
    other.crashed = this.crashed
    other.attached = this.attached
    other.yawD = this.yawD
    other.stableSeconds = this.stableSeconds
    other.maxLift = this.maxLift
    other.unsafeContacts = this.unsafeContacts
    other.steps = this.steps
    other.startTime = this.startTime
    other.ownsModel = false
    return other
  }

  perturb() {
    throw new Error('无人机任务不支持位置扰动')
  }

  dispose() {
    this.data.delete()
    if (this.ownsModel !== false) this.model.delete()
  }
}

export { MARKS, REST }
