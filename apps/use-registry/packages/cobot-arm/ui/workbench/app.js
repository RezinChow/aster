// 七轴轻量化协作机器人仿真实验台。Ported from the EmbodiedJev workbench (MIT).
// The page keeps the original layout and interaction. The original /api server
// is replaced by an in-page router: MuJoCo WASM runs the episode, and each
// decision goes to this package's edge agent through aix.agent.invoke. When the
// agent cannot answer, the rule controller chooses and the panel says so.
// The LIBERO tasks run the visual-waypoint protocol instead: the agent's
// vision model sees two annotated camera images and names a waypoint; there is
// no rule fallback.
import { loadMujoco } from './engine.js'
import { MAX_RUNS, episodeResult, evaluationPlan, evaluationReport, reportState, storedReport } from './libero-evaluation.js'
import { CAMERAS, IMAGE_SIZE, PROTOCOL as LIBERO_PROTOCOL, VIEWS } from './libero-plan.js'
import { LiberoView, annotatedImage, loadRenderPack } from './libero-scene.js'
import { LIBERO_INITS, LIBERO_TASKS, LiberoSession, PLANNERS, liberoScene } from './libero-session.js'
import { RobotScene, pandaGeometries } from './robot-scene.js'
import { Session } from './session.js'
import { ICONS } from './vendor/lucide/icons.js'
import { VISUALS } from './vendor/panda/panda.js'
import { TASKS, pandaPack } from './world.js'

const AGENT = 'cobot-arm'
const PROTOCOL = 1
const IMAGE_BYTES = 256 * 1024
const VIEW_NAMES = { external: '外部相机', wrist: '腕部相机' }
const EVAL_DONE = new Set(['completed', 'stopped', 'error', 'exhausted'])
const isLibero = (task) => task in LIBERO_TASKS
const reasonNames = { initial: '首次规划', reached: '到达航点', expired: '航点到期', stalled: '运动停滞' }
const gripperNames = { open: '张开', close: '闭合', hold: '保持' }

const icon = (name) => ICONS[name] ?? ''
const $ = (s) => document.querySelector(s)
const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const phaseNames = {
  approach: '移至物体上方',
  descend: '下降对准',
  grasp: '闭合夹爪',
  lift: '抬升物体',
  carry: '移向目标',
  lower: '降低放置',
  release: '松开夹爪',
  withdraw: '向上撤离',
  recover: '张开重试',
  finish: '完成'
}
const stateNames = {
  idle: '待命',
  running: '运行中',
  paused: '已暂停',
  uncertain: '等待人工处理',
  completed: '验证通过',
  stopped: '已停止',
  error: '执行异常',
  exhausted: '预算耗尽',
  stalled: '决策停滞'
}
const stageNames = {
  ready: '就绪',
  deciding: '决策中',
  previewing: '动作预演',
  executing: '执行中',
  observing: '读取反馈',
  verified: '已验证'
}
const refusalNames = {
  standalone: '未在 Studio 中打开',
  busy: '代理正忙',
  capacity: '代理容量已满',
  not_found: '没有找到本包的 agent',
  invalid_request: '请求被拒绝',
  agent_failed: '代理运行失败',
  closed: '视图已关闭',
  invalid_choice: '代理返回了未提供的选项'
}
const RULE_MODEL = '规则控制器'
const FALLBACK_MODEL = '规则控制器（agent 不可用）'
const taskLabel = (task) => TASKS[task]?.name ?? LIBERO_TASKS[task]?.name ?? task

let config,
  state,
  currentTask = 'transfer',
  currentPlanner = 'vision',
  liveImages = null,
  evaluation = null,
  activeId = null,
  replayMode = false,
  replayTimer = null,
  replayIndex = 0,
  historySignature = '',
  candidateSignature = '',
  resetting = false,
  controlPending = false,
  selectedCycle = null,
  lastCompletedDecision = null
$('#app').innerHTML = `
<div class="app-shell">
 <div class="body-grid">
 <div class="scrim" id="scrim"></div>
 <main class="workspace">
  <div class="viewport" id="viewport"><div class="scene-tools"><button class="icon-button mobile-settings" id="settings-open" title="实验任务" aria-label="实验任务">${icon('sliders-horizontal')}</button><button class="icon-button" id="camera-top" title="俯视" aria-label="俯视">${icon('scan')}</button><button class="icon-button" id="camera-home" title="复位视角" aria-label="复位视角">${icon('focus')}</button></div><div class="viewport-label"><h1>仿真画面</h1><p id="scene-task">搬运入盘</p></div><div class="scene-status" id="scene-status"><span class="dot"></span><span id="status-text">待命</span></div><div class="scene-axis"><span class="axis-x">X</span><span class="axis-y">Y</span><span class="axis-z">Z</span><span>坐标 · m</span></div><span class="scene-bottom-right" id="scene-time">t = 0.00 s</span><div class="success-stamp" id="success-stamp">${icon('circle-check')}<span id="success-text">物体稳定 · 夹爪已撤离</span></div><div class="loading" id="loading">加载机器人场景…</div>
  <aside class="sidebar hud" id="sidebar">
   <section><div class="section-topline"><h2>实验任务</h2><button class="icon-button close-settings" id="settings-close" aria-label="关闭参数">${icon('x')}</button></div>
    <div class="task-options"><button class="task-option active" data-task="transfer" aria-current="page">${icon('move-up-right')}<span>搬运入盘</span></button><button class="task-option" data-task="stack">${icon('layers-2')}<span>方块堆叠</span></button><button class="task-option" data-task="barrier">${icon('route')}<span>越障搬运</span></button></div>
    <p class="task-goal" id="task-goal"></p></section>
   <section><div class="section-topline"><h2>LIBERO 基准</h2></div>
    <div class="task-options"><button class="task-option" data-task="libero-drawer">${icon('archive')}<span>${LIBERO_TASKS['libero-drawer'].name}</span></button><button class="task-option" data-task="libero-microwave">${icon('microwave')}<span>${LIBERO_TASKS['libero-microwave'].name}</span></button></div>
    <div id="libero-settings" hidden>
     <div class="task-options planner-options">${Object.entries(PLANNERS)
       .map(([planner, { name }]) => `<button class="task-option${planner === 'vision' ? ' active' : ''}" data-planner="${planner}"${planner === 'vision' ? ' aria-current="true"' : ''}>${icon(planner === 'vision' ? 'eye' : 'route')}<span>${name}</span></button>`)
       .join('')}</div>
     <p class="task-goal" id="planner-help">${PLANNERS.vision.note}</p>
     <div class="settings-row"><label for="libero-init">初始状态</label><span class="range-label" id="libero-init-value">0</span></div><input class="range" id="libero-init" type="range" min="0" max="${LIBERO_INITS - 1}" step="1" value="0" aria-describedby="libero-init-help"><p class="field-help" id="libero-init-help">LIBERO 为该任务提供的第几号初始状态，物体摆放和机械臂起始姿态随之不同。</p>
     <div class="camera-panel" id="camera-panel"><div class="camera-views square">${Object.entries(VIEW_NAMES)
       .map(([view, name]) => `<figure><img id="camera-${view}" alt="${name}画面" width="${IMAGE_SIZE}" height="${IMAGE_SIZE}" hidden><figcaption>${name}</figcaption></figure>`)
       .join('')}</div><p class="camera-status" id="camera-status" role="status">开始实验后拍摄第一帧</p></div>
    </div>
    <details class="advanced-settings eval-block" id="eval-block"><summary>批量评测<span id="eval-progress">按规划方式、任务和局数依次运行</span></summary>
     <section><div class="eval-row"><span class="eval-name">任务</span><div class="eval-chips">${Object.entries(LIBERO_TASKS)
       .map(([task, { name }]) => `<button type="button" class="eval-chip" data-eval-task="${task}" aria-pressed="true">${escape(name)}</button>`)
       .join('')}</div></div>
     <div class="eval-row"><span class="eval-name">规划</span><div class="eval-chips">${Object.entries(PLANNERS)
       .map(([planner, { name }]) => `<button type="button" class="eval-chip" data-eval-planner="${planner}" aria-pressed="true">${escape(name)}</button>`)
       .join('')}</div></div>
     <div class="settings-row"><label for="eval-runs">每项局数</label><span class="range-label" id="eval-runs-value">1</span></div><input class="range" id="eval-runs" type="range" min="1" max="${MAX_RUNS}" step="1" value="1">
     <div class="eval-actions"><button type="button" class="secondary" id="eval-run">${icon('chart-column')}<span id="eval-run-label">开始评测</span></button><button type="button" class="icon-button" id="eval-export-open" title="导出报告" aria-label="导出报告" disabled>${icon('download')}</button></div>
     <div id="eval-summary"></div>
     <p class="field-help" id="eval-help">第 i 局从 LIBERO 第 i 号初始状态开始，与 LIBERO 自己的评测一致。视觉模型每次规划调用一次能看图的模型，只能在 Studio 中评测。</p></section>
    </details>
   </section>
   <section class="threshold-block" id="threshold-block"><div class="settings-row"><label for="threshold">决策门槛</label><span class="range-label" id="threshold-value">0.55</span></div><input class="range" id="threshold" type="range" min="0" max="1" step="0.05" value="0.55" aria-describedby="threshold-help"><p class="field-help" id="threshold-help">低于这个概率时暂停，等你决定是否继续。</p></section>
  </aside>
  <aside class="inspector hud" id="inspector" aria-label="当前动作">
   <section class="inspector-section decision-section" id="decision-section" tabindex="-1"><div class="section-topline"><h2 id="decision-heading">当前动作</h2><span class="eyebrow" id="stage">就绪</span></div><div class="decision-context"><span id="decision-context" role="status">等待开始</span><button type="button" class="text-button" id="decision-live" hidden>返回实时</button></div><div class="decision-title">${icon('git-branch')}<span id="decision-title">等待开始</span></div><div class="decision-meta"><span id="decision-provider">本包 agent</span><span id="latency">— ms</span></div><div id="intent-panel" hidden><div class="decision-meta"><span id="intent-heading">阶段</span><span id="intent-latency"></span></div><div class="probabilities" id="intent-probabilities"></div></div><div class="probabilities" id="probabilities"><div class="empty">尚无动作</div></div><p class="decision-note" id="decision-note" hidden></p></section>
   <section class="inspector-section grasp-section"><div class="sensors"><span class="name">夹爪</span><span class="sensor-value" id="gripper">张开</span><span class="name">手指接触</span><div class="contacts"><span class="contact" id="contact-l">左</span><span class="contact" id="contact-r">右</span></div><span class="name" id="support-label">目标支撑</span><span class="sensor-value" id="support">无</span></div></section>
   <div class="event-log"><div class="event-heading"><div class="section-topline"><h2>执行记录</h2><span class="eyebrow" id="event-count">0 步</span></div></div><div class="log-columns" aria-hidden="true"><span>时间</span><span>步</span><span>动作</span><span>结果</span></div><ol class="events" id="events"><li class="empty">暂无执行记录</li></ol></div>
  </aside>
  <div class="hud-dock">
   <div class="telemetry"><div class="metric"><div class="metric-label">末端 X</div><div class="metric-value"><span id="tcp-x">—</span><small>m</small></div></div><div class="metric"><div class="metric-label">末端 Y</div><div class="metric-value"><span id="tcp-y">—</span><small>m</small></div></div><div class="metric"><div class="metric-label">末端 Z</div><div class="metric-value"><span id="tcp-z">—</span><small>m</small></div></div><div class="metric"><div class="metric-label" id="lift-label">物体抬升</div><div class="metric-value"><span id="lift">0</span><small id="lift-unit">mm</small></div></div></div>
   <div class="timeline"><button class="icon-button" id="replay-play" aria-label="播放轨迹" title="播放轨迹">${icon('play')}</button><div class="timeline-track"><div class="timeline-caption"><span id="timeline-label">轨迹</span><span id="frame-label">0000 / 0000</span></div><input id="timeline" type="range" min="0" max="0" value="0" aria-label="轨迹时间轴"></div><button class="live-link" id="live">实时</button></div>
   <div class="controls"><button class="primary" id="run">${icon('play')}<span id="run-label">运行实验</span></button><button class="icon-button" id="step" title="单步执行" aria-label="单步执行">${icon('step-forward')}</button><button class="icon-button stop" id="stop" title="停止实验" aria-label="停止实验">${icon('square')}</button><button class="icon-button" id="reset" title="重置实验" aria-label="重置实验">${icon('rotate-ccw')}</button><span class="run-budget" id="run-budget">00 / 30 步</span></div>
  </div>
  </div>
 </main>
</div>
</div><div class="toast" id="toast" role="status"></div>
<div class="eval-export" id="eval-export" role="dialog" aria-modal="true" aria-labelledby="eval-export-title" hidden><div class="eval-export-card"><div class="section-topline"><h2 id="eval-export-title">评测报告 JSON</h2><button type="button" class="icon-button" id="eval-export-close" aria-label="关闭">${icon('x')}</button></div><textarea id="eval-json" readonly spellcheck="false" aria-label="评测报告 JSON"></textarea><div class="eval-export-actions"><span class="field-help" id="eval-copy-status">报告也保存在本视图的状态里，重新打开后仍可查看。</span><button type="button" class="secondary" id="eval-copy">复制</button></div></div></div>
`

let toastTimer
function toast(message) {
  $('#toast').textContent = message
  $('#toast').classList.add('visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 6000)
}

// ---- Package agent over the AIX view port ----

let port = null
let messageId = 0
let storeId = 0
const pending = new Map()

function documentId() {
  const match = /(?:^|[#&])aix-document=([a-f0-9]{64})(?:&|$)/.exec(location.hash)
  return match ? match[1] : null
}

function connect() {
  const id = documentId()
  if (!id || window.parent === window) return
  const channel = new MessageChannel()
  port = channel.port1
  port.onmessage = ({ data }) => {
    if (!data || data.protocolVersion !== PROTOCOL) return
    if (data.type === 'aix.view.connect') {
      const report = storedReport(data.stateJSON)
      if (report && !evaluation) {
        evaluation = { report, results: report.results, plan: [], running: false, stored: true }
        renderEvaluation()
      }
      return
    }
    if (data.type === 'aix.view.stored') {
      if (data.id === storeId && evaluation) evaluation.stored = true
      return
    }
    if (data.type !== 'aix.agent.result' && data.type !== 'aix.agent.refused') return
    const waiter = pending.get(data.id)
    if (!waiter) return
    pending.delete(data.id)
    if (data.type === 'aix.agent.result') waiter.resolve(data.text)
    else waiter.reject(Object.assign(new Error(data.reason), { reason: data.reason }))
  }
  port.start()
  window.parent.postMessage({ protocolVersion: PROTOCOL, type: 'aix.document.ready', documentId: id }, '*', [channel.port2])
}

function invoke(observation, images, prompt = '选择下一步。') {
  const id = ++messageId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    port.postMessage({
      protocolVersion: PROTOCOL,
      type: 'aix.agent.invoke',
      id,
      agent: AGENT,
      prompt,
      parameters: { observation },
      ...(images ? { images } : {})
    })
  })
}

/** The agent's own rule: the only option, else an offered baseline, else the first key. */
function ruleChoice(request) {
  const keys = Object.keys(request.options)
  return keys.length === 1 || !keys.includes(request.baseline_choice) ? keys[0] : request.baseline_choice
}

/** A distribution over exactly the offered keys, or null. */
function publishedProbabilities(probabilities, options) {
  if (!probabilities || typeof probabilities !== 'object') return null
  const keys = Object.keys(options)
  if (Object.keys(probabilities).length !== keys.length) return null
  for (const key of keys) {
    const value = probabilities[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return null
  }
  return Object.fromEntries(keys.map((key) => [key, probabilities[key]]))
}

async function choose(_stage, request) {
  const started = performance.now()
  const base = { probabilities: {}, selected_probability: null, provider: 'agent' }
  if (Object.keys(request.options).length === 1) {
    return { ...base, choice: ruleChoice(request), latency_ms: 0, model_call: false, reason: 'only_eligible_action' }
  }
  let reason = 'standalone'
  if (port) {
    try {
      const reply = JSON.parse(await invoke(request))
      if (!reply || typeof reply.choice !== 'string' || !(reply.choice in request.options)) {
        throw Object.assign(new Error('invalid_choice'), { reason: 'invalid_choice' })
      }
      const latency_ms = performance.now() - started
      if (reply.source === 'model') {
        const probabilities = publishedProbabilities(reply.probabilities, request.options)
        return {
          ...base,
          choice: reply.choice,
          model: reply.model,
          model_call: true,
          latency_ms,
          ...(probabilities
            ? { probabilities, selected_probability: probabilities[reply.choice], provider_confidence: reply.confidence ?? null, readout: 'systemone' }
            : { readout: 'generated_json' })
        }
      }
      return { ...base, choice: reply.choice, model: RULE_MODEL, model_call: false, latency_ms, reason: 'agent_rule', note: reply.note ?? '' }
    } catch (failure) {
      reason = failure?.reason ?? 'agent_failed'
    }
  }
  return { ...base, choice: ruleChoice(request), model: FALLBACK_MODEL, model_call: false, latency_ms: performance.now() - started, reason: 'agent_unavailable', agent_error: reason }
}

// ---- In-page replacement for the original /api server ----

let mujoco = null
let session = null
let geometries = null
let liberoView = null
let liberoRig = null
const renderPacks = new Map()

/** One annotated planner image under the host's per-image limit. */
function turnImage(packet, tcp) {
  for (const quality of [0.9, 0.75, 0.6]) {
    const data = annotatedImage(packet, tcp, 'image/jpeg', quality)
    if (Math.floor(((data.length - data.indexOf(',') - 1) * 3) / 4) <= IMAGE_BYTES) return data
  }
  throw new Error('相机图像超过单张 256 KiB 上限')
}

/** Both calibrated RGB-D cameras of the live LIBERO state, each with its annotated planner image. */
function captureLibero(world) {
  if (!liberoRig) throw new Error('LIBERO 相机尚未就绪')
  const poses = Object.fromEntries(VIEWS.map((view) => [view, world.cameraPose(CAMERAS[view])]))
  const packets = liberoRig.capture(world.poses(), poses)
  const tcp = world.tcp
  for (const view of VIEWS) packets[view].image = turnImage(packets[view], tcp)
  liveImages = { step: world.steps, images: Object.fromEntries(VIEWS.map((view) => [view, packets[view].image])) }
  return packets
}

/**
 * A vision waypoint has no rule fallback: the model's plan, or an error that
 * stops the episode. The state is upstream's planner state; the images are the
 * two annotated cameras.
 */
async function proposeLibero({ observation, packets, previous, recent }) {
  if (!port) return { error: '视觉规划需要在 Studio 中打开，由能看图的模型规划；没有使用规则替代。' }
  const state = {
    task: observation.task,
    robot: observation,
    cameras: Object.fromEntries(VIEWS.map((view) => [view, { width: packets[view].width, height: packets[view].height }])),
    previous_plan: previous,
    recent_motion: recent
  }
  const images = VIEWS.map((view) => ({ name: view, data: packets[view].image }))
  const started = performance.now()
  let reply
  try {
    reply = JSON.parse(await invoke({ protocol: LIBERO_PROTOCOL, state }, images, '规划下一个航点。'))
  } catch (failure) {
    const reason = failure?.reason ?? 'agent_failed'
    return { error: `视觉模型不可用（${refusalNames[reason] ?? reason}），已停止；没有使用规则替代。` }
  }
  if (reply?.error) return { error: `视觉模型没有给出可执行的航点（${reply.error}），已停止；没有使用规则替代。` }
  if (reply?.source !== 'model' || !reply.plan) return { error: '视觉模型的回复不是航点规划，已停止。' }
  return {
    answer: reply.plan,
    model: reply.model,
    model_call: true,
    latency_ms: performance.now() - started,
    images: Object.fromEntries(VIEWS.map((view) => [view, packets[view].image]))
  }
}

async function newSession(task, seed, threshold, planner = currentPlanner, speed = 1, init = 0) {
  const next = isLibero(task)
    ? await LiberoSession.create(mujoco, { task, planner, init, propose: proposeLibero, capture: captureLibero, speed })
    : await Session.create(mujoco, { task, seed, threshold, choose })
  const previous = session
  session = next
  liveImages = null
  if (previous) previous.dispose()
}

async function liberoRenderPack(task) {
  const { scene } = LIBERO_TASKS[task]
  if (!renderPacks.has(scene)) {
    renderPacks.set(
      scene,
      liberoScene(task).then((module) => loadRenderPack(module.RENDER, module.RENDER_BIN))
    )
  }
  return renderPacks.get(scene)
}

function sceneData() {
  const bodies = {}
  for (const { body } of VISUALS) bodies[body] ??= session.world.bodyId(body)
  return { primitives: session.world.primitives(), bodies, geometries, task: session.world.task }
}

async function api(path, body) {
  if (path === '/api/config') return { tasks: { ...TASKS, ...LIBERO_TASKS } }
  if (path === '/api/scene') return isLibero(session.task) ? { task: session.task, libero: true } : sceneData()
  if (path === '/api/state') return session.snapshot()
  if (path === '/api/reset') {
    await newSession(body.task, body.seed, body.threshold, body.planner, 1, body.init)
    return session.snapshot()
  }
  const control = /^\/api\/control\/(start|step|pause|stop)$/.exec(path)
  if (control) {
    if (body.episode_id !== session.id) throw new Error('实验已重置，请重试')
    const action = control[1]
    if (action === 'start') session.start(false, body.threshold)
    else if (action === 'step') session.start(true, body.threshold)
    else if (action === 'pause') session.pause()
    else session.stop()
    return session.snapshot()
  }
  const replay = /^\/api\/replay\/(\d+)$/.exec(path)
  if (replay) return session.replayFrame(Number(replay[1]))
  throw new Error('参数或服务异常')
}

// ---- Workbench, as in the original ----

const sceneView = new RobotScene($('#viewport'), { onError: toast })
const activeView = () => (isLibero(state?.task ?? currentTask) && liberoView ? liberoView : sceneView)
function renderFrame(frame) {
  if (!frame) return
  const o = frame.observation || {}
  const libero = !!frame.poses
  if (libero) liberoView?.render(frame.poses)
  else sceneView.render(frame)
  ;['x', 'y', 'z'].forEach((k, i) => ($(`#tcp-${k}`).textContent = Number.isFinite(o.tcp?.[i]) ? o.tcp[i].toFixed(3) : '—'))
  if (libero) {
    const metric = LIBERO_TASKS[state?.task ?? currentTask]?.metric
    const value = o.goal_qpos?.[0]
    $('#lift').textContent = metric && Number.isFinite(value) ? (value * metric.scale).toFixed(metric.digits) : '—'
  } else {
    $('#lift').textContent = Number.isFinite(o.max_lift_m) ? (o.max_lift_m * 1000).toFixed(0) : '—'
  }
  $('#gripper').textContent = o.gripper === 'closed' ? '闭合' : '张开'
  $('#contact-l').classList.toggle('on', o.finger_contacts?.includes('left') || false)
  $('#contact-r').classList.toggle('on', o.finger_contacts?.includes('right') || false)
  const support = libero ? o.success : o.support_contact
  $('#support').textContent = support === undefined ? '—' : libero ? (support ? '满足' : '未满足') : support ? '有' : '无'
  $('#support').classList.toggle('on', !!support)
  $('#scene-time').textContent = Number.isFinite(o.sim_seconds) ? 't = ' + o.sim_seconds.toFixed(2) + ' s' : '—'
}

/** Labels that differ between the cobot tasks and the LIBERO tasks. */
function showBenchmark(task) {
  const libero = isLibero(task)
  const metric = LIBERO_TASKS[task]?.metric
  $('#lift-label').textContent = libero ? metric.label : '物体抬升'
  $('#lift-unit').textContent = libero ? metric.unit : 'mm'
  $('#support-label').textContent = libero ? '成功谓词' : '目标支撑'
  $('#success-text').textContent = libero ? 'LIBERO 成功谓词已满足' : '物体稳定 · 夹爪已撤离'
  $('#libero-settings').hidden = !libero
  $('#threshold-block').hidden = libero
  $('.grasp-section .contacts').hidden = libero
  $('.grasp-section .contacts').previousElementSibling.hidden = libero
}

async function loadScene() {
  $('#loading').classList.remove('hidden')
  const data = await api('/api/scene')
  const libero = !!data.libero
  showBenchmark(data.task)
  if (libero) {
    const owner = session
    const pack = await liberoRenderPack(data.task)
    if (session !== owner) return
    liberoView ??= new LiberoView($('#viewport'), { onError: toast })
    const bodyIds = session.world.bodyIds(pack.render.geoms.map((geom) => geom.body))
    liberoView.load(pack, bodyIds, session.world.cameraPose(CAMERAS.external))
    liberoRig = liberoView.sensorRig(pack, bodyIds)
  } else {
    sceneView.load(data)
  }
  sceneView.renderer.domElement.hidden = libero
  if (liberoView) liberoView.renderer.domElement.hidden = !libero
  $('#scene-task').textContent = taskLabel(data.task)
  $('#loading').classList.add('hidden')
}

function decisionSnapshot(s) {
  return {
    cycle: s.cycles,
    phase: s.phase,
    intent: s.last_intent,
    decision: s.last_decision,
    candidates: s.candidates || [],
    decision_inputs: s.last_decision_inputs
  }
}

function agentNote(decision, intent) {
  const fallback = [decision, intent].find((item) => item?.reason === 'agent_unavailable')
  if (fallback) return `本包 agent 不可用（${refusalNames[fallback.agent_error] ?? fallback.agent_error}），这一步由规则控制器选择。`
  const rule = [decision, intent].find((item) => item?.reason === 'agent_rule')
  if (rule) return `agent 没有拿到模型回复${rule.note ? `（${rule.note}）` : ''}，这一步按规则选择。`
  return ''
}

const fixed = (values, digits = 3) => `[${values.map((value) => Number(value).toFixed(digits)).join(', ')}]`

function targetText(plan) {
  const target = plan.target
  const grounding = plan.grounding
  if (target.kind === 'pixel') {
    return `${VIEW_NAMES[target.camera]}像素 (${grounding.camera_pixel.join(', ')}) · 深度 ${grounding.depth_m.toFixed(3)} m · 偏移 ${fixed(target.offset_m)}`
  }
  if (target.kind === 'relative') return `相对当前末端 ${fixed(target.delta_m)} m`
  return `世界坐标 ${fixed(target.xyz_m)} m`
}

/** The camera images behind the shown plan, else the latest capture. */
function renderCamera(record) {
  const shown = record?.images ? { images: record.images, step: record.start_step } : liveImages
  for (const view of VIEWS) {
    const image = $(`#camera-${view}`)
    const url = shown?.images?.[view]
    if (url && image.src !== url) image.src = url
    image.hidden = !url
  }
  $('#camera-status').textContent = shown
    ? `第 ${shown.step} 步的标注输入图 · 网格 64 px · 青色十字为末端投影`
    : state?.planner === 'reference'
      ? '参考航点不需要相机；开始后仍会拍摄，便于对照'
      : '开始实验后拍摄第一帧'
}

function renderLiberoDecision(s) {
  const record = s.history.find((h) => h.cycle === selectedCycle) ?? null
  if (selectedCycle !== null && !record) selectedCycle = null
  const shown = record ?? s.last_decision
  const pending = s.status === 'running' && s.stage === 'deciding'
  const failure = ['error', 'exhausted'].includes(s.status)
  $('#intent-panel').hidden = true
  $('#decision-heading').textContent = record ? `第 ${record.cycle} 次规划` : '当前航点'
  $('#decision-live').hidden = !record
  $('#decision-section').classList.toggle('viewing-history', !!record)
  $('#stage').textContent = record ? '历史' : stageNames[s.stage] || s.stage
  $('#decision-context').textContent = record
    ? `第 ${record.cycle} 次规划 · 步 ${record.start_step}–${record.end_step}`
    : pending
      ? s.planner === 'vision'
        ? '正在请视觉模型规划航点'
        : '正在生成参考航点'
      : stateNames[s.status] || s.status
  $('#decision-title').textContent = shown?.label ?? (pending ? '规划中…' : '等待开始')
  $('#decision-provider').textContent = shown?.model ?? PLANNERS[s.planner].name
  $('#latency').textContent = shown?.model_call ? Number(shown.latency_ms).toFixed(0) + ' ms' : shown ? '无模型调用' : '— ms'
  let note = s.planner === 'reference' ? PLANNERS.reference.note + '。' : ''
  if (!record && failure && s.message) note = `${note}${s.message}`
  else if (!record && pending) note = `${note}正在计算下一个航点。`
  $('#decision-note').textContent = note
  $('#decision-note').hidden = !note
  $('#decision-note').classList.toggle('failure', !record && failure && !!s.message)
  const signature = JSON.stringify([s.id, selectedCycle, shown?.cycle, shown?.blocks, !!liveImages, liveImages?.step])
  if (signature === candidateSignature) return
  candidateSignature = signature
  renderCamera(record ?? shown)
  if (!shown) {
    $('#probabilities').innerHTML = `<div class="empty">${pending ? '正在规划航点…' : '尚无航点'}</div>`
    return
  }
  const plan = shown.plan
  const facts = [
    ['意图', plan.intent],
    ['视觉依据', plan.visual_evidence],
    ['目标', targetText(plan)],
    ['航点', `${fixed(plan.target_xyz)} m`],
    ['旋转', `${fixed(plan.rotation_delta, 2)} rad`],
    ['夹爪', gripperNames[plan.gripper] ?? plan.gripper],
    ['有效动作', `${shown.blocks} / ${plan.max_motor_steps} 次 · 每次 5 步`],
    ['触发', reasonNames[shown.reason] ?? shown.reason]
  ]
  $('#probabilities').innerHTML = `<dl class="plan-facts">${facts.map(([name, value]) => `<dt>${name}</dt><dd>${escape(value)}</dd>`).join('')}</dl>`
}

function renderDecision(s) {
  if (s.benchmark === 'libero') return renderLiberoDecision(s)
  const history = s.history.find((h) => h.cycle === selectedCycle)
  if (selectedCycle !== null && !history) selectedCycle = null
  if (s.last_decision && s.candidates?.length) {
    lastCompletedDecision = decisionSnapshot(s)
  } else if (!lastCompletedDecision && s.history.length) {
    lastCompletedDecision = s.history.at(-1)
  }
  const previous = !s.last_decision && !!lastCompletedDecision
  const shown = history || (previous ? lastCompletedDecision : decisionSnapshot(s))
  const intent = shown.intent
  const decision = shown.decision
  const candidates = shown.candidates || (shown.action ? [shown.action] : [])
  const pending = s.status === 'running' && ['deciding', 'previewing'].includes(s.stage)
  $('#intent-heading').textContent = history ? '该步阶段' : '阶段'
  $('#decision-heading').textContent = history ? `第 ${history.cycle} 步` : '当前动作'
  $('#decision-live').hidden = !history
  $('#decision-section').classList.toggle('viewing-history', !!history)
  $('#stage').textContent = history ? '历史' : stageNames[s.stage] || s.stage
  $('#decision-context').textContent = history
    ? `第 ${history.cycle} 步 · ${history.after.sim_seconds.toFixed(2)} s`
    : pending
      ? '正在选择动作'
      : stateNames[s.status] || s.status
  $('#decision-title').textContent = candidates.find((candidate) => candidate.id === decision?.choice)?.label || '等待开始'
  $('#decision-provider').textContent = decision?.model || intent?.model || '本包 agent'
  $('#latency').textContent = decision?.model_call ? Number(decision.latency_ms).toFixed(0) + ' ms' : decision ? '无模型调用' : '— ms'
  const failure = ['error', 'uncertain', 'exhausted', 'stalled'].includes(s.status)
  let note = ''
  if (history) note = '正在查看这一步的选择。'
  else if (failure && s.message) note = s.message
  else if (pending) note = '正在计算下一步。'
  const fallback = agentNote(decision, intent)
  if (fallback) note = note ? `${fallback} ${note}` : fallback
  $('#decision-note').textContent = note
  $('#decision-note').hidden = !note
  $('#decision-note').classList.toggle('failure', !history && failure && !!s.message)
  const signature = JSON.stringify([selectedCycle, candidates, decision, intent])
  if (signature === candidateSignature) return
  candidateSignature = signature
  $('#intent-panel').hidden = !intent
  $('#intent-latency').textContent = intent?.model_call
    ? Number(intent.latency_ms).toFixed(0) + ' ms'
    : intent?.reason === 'only_eligible_action'
      ? '单一可行阶段 · 无模型调用'
      : '规则选择'
  $('#intent-probabilities').innerHTML = intent
    ? (Object.entries(intent.probabilities || {}).length ? Object.entries(intent.probabilities) : [[intent.choice, null]])
        .map(
          ([choice, probability]) =>
            `<div class="prob-row ${choice === intent.choice ? 'selected' : ''}"><div class="prob-top"><span>${escape(phaseNames[choice] || choice)}</span><span>${probability === null ? '已选择' : (probability * 100).toFixed(1) + '%'}</span></div>${probability === null ? '' : `<div class="bar"><div class="bar-fill" style="width:${probability * 100}%"></div></div>`}</div>`
        )
        .join('')
    : ''
  const probabilities = decision?.probabilities || {}
  $('#probabilities').innerHTML = candidates.length
    ? candidates
        .map((candidate) => {
          const selected = decision?.choice === candidate.id
          const rejected = candidate.admitted === false
          const probability = probabilities[candidate.id]
          const label = rejected
            ? '已拦截'
            : probability !== undefined
              ? (probability * 100).toFixed(1) + '%'
              : selected
                ? '已选择'
                : decision
                  ? '未选择'
                  : '等待决策'
          const width = probability !== undefined ? probability * 100 : selected ? 100 : 0
          return `<div class="prob-row ${selected ? 'selected' : ''} ${rejected ? 'rejected' : ''}" title="${escape(candidate.rejection || '')}"><div class="prob-top"><span>${escape(candidate.label || candidate.id)}</span><span>${label}</span></div><div class="bar"><div class="bar-fill" style="width:${width}%"></div></div></div>`
        })
        .join('')
    : `<div class="empty">${pending ? '正在选择动作…' : '尚无动作'}</div>`
}

function updateControlAvailability() {
  if (!state) return
  const pending = controlPending || resetting || !!evaluation?.running
  $('#run').disabled = pending || ['completed', 'stopped', 'error', 'exhausted', 'stalled'].includes(state.status)
  $('#step').disabled = pending || ['running', 'completed', 'stopped', 'error', 'exhausted', 'stalled'].includes(state.status)
  $('#stop').disabled = pending || ['idle', 'completed', 'stopped'].includes(state.status)
  $('#reset').disabled = pending
  $('.controls').setAttribute('aria-busy', String(pending))
  const locked = pending || ['running', 'paused'].includes(state.status)
  for (const el of document.querySelectorAll('.task-option,#threshold,#libero-init')) el.disabled = locked
}

function renderState(s) {
  state = s
  if (activeId !== s.id) {
    activeId = s.id
    historySignature = ''
    candidateSignature = ''
    selectedCycle = null
    lastCompletedDecision = null
    replayMode = false
    replayRequest++
    clearInterval(replayTimer)
    replayTimer = null
    currentTask = s.task
    for (const button of document.querySelectorAll('[data-task]')) {
      const on = button.dataset.task === s.task
      button.classList.toggle('active', on)
      if (on) button.setAttribute('aria-current', 'page')
      else button.removeAttribute('aria-current')
    }
    $('#task-goal').textContent = config.tasks[s.task].goal
    $('#timeline-label').textContent = '轨迹'
    if (Number.isFinite(s.threshold)) {
      $('#threshold').value = s.threshold
      $('#threshold-value').textContent = s.threshold.toFixed(2)
    }
    if (s.planner) selectPlanner(s.planner)
    if (Number.isInteger(s.init)) {
      $('#libero-init').value = s.init
      $('#libero-init-value').textContent = s.init
    }
    showBenchmark(s.task)
  }
  if (!replayMode) renderFrame(s.frame)
  $('#status-text').textContent = replayMode ? '轨迹回放' : stateNames[s.status]
  $('#scene-status').classList.toggle('error', ['error', 'exhausted', 'uncertain', 'stalled'].includes(s.status))
  $('#success-stamp').classList.toggle('visible', s.status === 'completed' && !replayMode)
  renderDecision(s)
  $('#run-budget').textContent =
    s.benchmark === 'libero'
      ? `${String(s.steps).padStart(3, '0')} / ${s.max_steps} 步 · ${s.cycles} / ${s.max_cycles} 规划`
      : String(s.cycles).padStart(2, '0') + ' / ' + s.max_cycles + ' 步'
  $('#run-label').textContent = s.status === 'running' ? '暂停实验' : ['paused', 'uncertain'].includes(s.status) ? '继续实验' : '运行实验'
  const runIcon = s.status === 'running' ? 'pause' : 'play'
  if ($('#run').dataset.icon !== runIcon) {
    $('#run').dataset.icon = runIcon
    $('#run svg').outerHTML = icon(runIcon)
  }
  updateControlAvailability()
  $('#timeline').max = Math.max(0, s.frame_count - 1)
  if (!replayMode) {
    $('#timeline').value = s.frame_count - 1
    $('#frame-label').textContent = String(s.frame_count).padStart(4, '0') + ' / ' + String(s.frame_count).padStart(4, '0')
  }
  $('#replay-play').disabled = s.frame_count < 2 || s.status === 'running'
  const hsig = s.id + '-' + s.history.length + '-' + selectedCycle + '-' + (s.history.at(-1)?.blocks ?? 0) + '-' + s.status
  if (s.benchmark === 'libero' && hsig !== historySignature) {
    historySignature = hsig
    $('#event-count').textContent = s.history.length + ' 次规划'
    $('#events').innerHTML = s.history.length
      ? s.history
          .map((h, index) => {
            const last = index === s.history.length - 1
            const outcome = last && s.status === 'completed' ? '成功' : `${h.blocks} 次动作 · ${h.plan.target.kind === 'pixel' ? '像素' : h.plan.target.kind === 'relative' ? '相对' : '世界'}目标`
            const active = h.cycle === selectedCycle
            return `<li class="event${active ? ' active' : ''}"><button type="button" class="event-button" data-cycle="${h.cycle}" aria-pressed="${active}" aria-label="查看第 ${h.cycle} 次规划：${escape(h.label)}"><span class="log-time">${h.after.sim_seconds.toFixed(1)} s</span><span class="log-step">${h.cycle}</span><span class="log-action">${escape(h.label)}</span><span class="log-result">${outcome}</span></button></li>`
          })
          .join('')
      : '<li class="empty">暂无规划记录</li>'
    if (selectedCycle === null) $('#events').scrollTop = $('#events').scrollHeight
  } else if (hsig !== historySignature) {
    historySignature = hsig
    $('#event-count').textContent = s.history.length + ' 步'
    $('#events').innerHTML = s.history.length
      ? s.history
          .map((h) => {
            const outcome = h.after.held ? '双侧接触' : h.after.support_contact ? '目标支撑' : '位置已更新'
            const extra = h.rejected_count ? ' · 拦截 ' + h.rejected_count + ' 个候选' : ''
            const active = h.cycle === selectedCycle
            return `<li class="event${active ? ' active' : ''}"><button type="button" class="event-button" data-cycle="${h.cycle}" aria-pressed="${active}" aria-label="查看第 ${h.cycle} 步决策：${escape(h.label)}"><span class="log-time">${h.after.sim_seconds.toFixed(1)} s</span><span class="log-step">${h.cycle}</span><span class="log-action">${escape(h.label)}</span><span class="log-result">${outcome}${extra}</span></button></li>`
          })
          .join('')
      : '<li class="empty">暂无执行记录</li>'
    if (selectedCycle === null) $('#events').scrollTop = $('#events').scrollHeight
  }
  if (s.message && s.message !== renderState.lastMessage) {
    toast(s.message)
    renderState.lastMessage = s.message
  }
}

function setup() {
  return {
    expected_episode_id: state?.id,
    task: currentTask,
    seed: state?.seed ?? 0,
    threshold: Number($('#threshold').value),
    planner: currentPlanner,
    init: Number($('#libero-init').value)
  }
}
function selectPlanner(planner) {
  currentPlanner = planner
  for (const button of document.querySelectorAll('[data-planner]')) {
    const on = button.dataset.planner === planner
    button.classList.toggle('active', on)
    if (on) button.setAttribute('aria-current', 'true')
    else button.removeAttribute('aria-current')
  }
  $('#planner-help').textContent = PLANNERS[planner].note
}
async function reset(fromControl = false) {
  if (resetting || (controlPending && !fromControl)) return false
  resetting = true
  updateControlAvailability()
  clearInterval(replayTimer)
  replayTimer = null
  replayRequest++
  replayMode = false
  try {
    const s = await api('/api/reset', setup())
    await loadScene()
    renderState(s)
    return true
  } catch (e) {
    toast(e.message)
    return false
  } finally {
    resetting = false
    updateControlAvailability()
  }
}
async function control(action) {
  if (controlPending || resetting) return
  controlPending = true
  updateControlAvailability()
  try {
    replayRequest++
    replayMode = false
    clearInterval(replayTimer)
    replayTimer = null
    $('#timeline-label').textContent = '轨迹'
    renderState(await api('/api/control/' + action, { episode_id: state.id, threshold: Number($('#threshold').value) }))
  } catch (e) {
    toast(e.message)
  } finally {
    controlPending = false
    updateControlAvailability()
  }
}
$('#run').onclick = () => control(state.status === 'running' ? 'pause' : 'start')
$('#step').onclick = () => control('step')
$('#stop').onclick = () => control('stop')
$('#reset').onclick = () => reset()
$('#camera-home').onclick = () => activeView().cameraHome()
$('#camera-top').onclick = () => activeView().cameraTop()
for (const button of document.querySelectorAll('[data-planner]'))
  button.onclick = async () => {
    if (controlPending || resetting || button.dataset.planner === currentPlanner) return
    selectPlanner(button.dataset.planner)
    await reset()
  }
for (const button of document.querySelectorAll('[data-task]'))
  button.onclick = async () => {
    if (controlPending || resetting) return
    currentTask = button.dataset.task
    for (const b of document.querySelectorAll('[data-task]')) {
      const on = b === button
      b.classList.toggle('active', on)
      if (on) b.setAttribute('aria-current', 'page')
      else b.removeAttribute('aria-current')
    }
    $('#task-goal').textContent = config.tasks[currentTask].goal
    await reset()
  }
function focusDecision() {
  $('#decision-section').scrollIntoView({ block: 'start', behavior: 'auto' })
  $('#decision-section').focus({ preventScroll: true })
}
$('#events').onclick = (event) => {
  const button = event.target.closest('[data-cycle]')
  if (!button) return
  selectedCycle = Number(button.dataset.cycle)
  renderState(state)
  focusDecision()
}
$('#decision-live').onclick = () => {
  selectedCycle = null
  renderState(state)
}
function drawer(open) {
  $('#sidebar').classList.toggle('open', open)
  $('#scrim').classList.toggle('visible', open)
}
$('#libero-init').oninput = () => ($('#libero-init-value').textContent = $('#libero-init').value)
$('#libero-init').onchange = async () => {
  if (controlPending || resetting) return
  await reset()
}
$('#threshold').oninput = () => ($('#threshold-value').textContent = Number($('#threshold').value).toFixed(2))
$('#settings-open').onclick = () => drawer(true)
$('#settings-close').onclick = () => drawer(false)
$('#scrim').onclick = () => drawer(false)
let replayRequest = 0
async function showReplay(index) {
  const request = ++replayRequest
  replayMode = true
  replayIndex = index
  const frame = await api('/api/replay/' + index)
  if (request !== replayRequest) return
  renderFrame(frame)
  $('#timeline').value = index
  $('#frame-label').textContent = String(index + 1).padStart(4, '0') + ' / ' + String(state.frame_count).padStart(4, '0')
  $('#timeline-label').textContent = '轨迹回放'
  $('#status-text').textContent = '轨迹回放'
  $('#success-stamp').classList.remove('visible')
}
$('#timeline').oninput = async () => {
  if (state.status === 'running') await control('pause')
  try {
    await showReplay(Number($('#timeline').value))
  } catch (e) {
    toast(e.message)
  }
}
$('#live').onclick = () => {
  clearInterval(replayTimer)
  replayTimer = null
  replayRequest++
  replayMode = false
  $('#timeline-label').textContent = '轨迹'
  renderState(state)
}
$('#replay-play').onclick = () => {
  if (replayTimer) {
    clearInterval(replayTimer)
    replayTimer = null
    return
  }
  replayIndex = replayMode && replayIndex < state.frame_count - 1 ? replayIndex : 0
  let busy = false
  replayTimer = setInterval(async () => {
    if (busy) return
    if (replayIndex >= state.frame_count - 1) {
      clearInterval(replayTimer)
      replayTimer = null
      return
    }
    busy = true
    try {
      await showReplay(replayIndex + 1)
    } catch (e) {
      clearInterval(replayTimer)
      replayTimer = null
      toast(e.message)
    } finally {
      busy = false
    }
  }, 80)
}
// ---- LIBERO batch evaluation ----

const chosen = (attribute) => [...document.querySelectorAll(`[data-${attribute}][aria-pressed="true"]`)].map((b) => b.getAttribute(`data-${attribute}`))
const evalChoice = () => ({ tasks: chosen('eval-task'), planners: chosen('eval-planner'), runs: Number($('#eval-runs').value) })
for (const chip of document.querySelectorAll('.eval-chip'))
  chip.onclick = () => {
    chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'))
    renderEvaluation()
  }
$('#eval-runs').oninput = () => {
  $('#eval-runs-value').textContent = $('#eval-runs').value
  renderEvaluation()
}

function renderEvaluation() {
  const running = !!evaluation?.running
  let planned = 0
  try {
    planned = evaluationPlan(evalChoice()).length
  } catch {
    planned = 0
  }
  for (const el of document.querySelectorAll('.eval-chip,#eval-runs')) el.disabled = running
  $('#eval-run').disabled = !running && planned === 0
  $('#eval-run-label').textContent = running ? '停止评测' : planned ? `开始评测（${planned} 局）` : '开始评测'
  $('#eval-export-open').disabled = !evaluation?.report
  const done = evaluation?.results.length ?? 0
  const current = evaluation?.current
  $('#eval-progress').textContent = running
    ? current
      ? `第 ${done + 1} / ${evaluation.plan.length} 局 · ${PLANNERS[current.planner].name} · ${taskLabel(current.task)}`
      : `准备 ${evaluation.plan.length} 局`
    : evaluation?.report
      ? `${evaluation.report.complete ? '已完成' : '已停止'} ${done} / ${evaluation.report.planned} 局`
      : '按规划方式、任务和局数依次运行'
  const summary = evaluation?.report?.summary ?? (evaluation ? evaluationReport({ plan: evaluation.plan, results: evaluation.results, complete: false }).summary : [])
  $('#eval-summary').innerHTML = summary.length
    ? `<table class="input-table eval-table"><thead><tr><th>规划 · 任务</th><th>成功</th><th>步数</th><th>调用</th><th>时延</th></tr></thead><tbody>${summary
        .map(
          (row) =>
            `<tr><th>${escape(PLANNERS[row.planner]?.name ?? row.planner)} · ${escape(taskLabel(row.task))}</th><td>${row.successes}/${row.episodes}</td><td>${row.mean_steps}</td><td>${row.model_calls}</td><td>${row.mean_model_latency_ms === null ? '—' : `${(row.mean_model_latency_ms / 1000).toFixed(1)}s`}</td></tr>`
        )
        .join('')}</tbody></table>`
    : ''
}

function waitForEpisode(running) {
  return new Promise((resolve) => {
    const tick = () => (evaluation.cancelled || EVAL_DONE.has(running.status) ? resolve() : setTimeout(tick, 150))
    tick()
  })
}

function storeReport(report) {
  const text = reportState(report)
  if (!port || text === null) return false
  port.postMessage({ protocolVersion: PROTOCOL, type: 'aix.view.store', id: ++storeId, stateJSON: text })
  return true
}

async function runEvaluation() {
  const plan = evaluationPlan(evalChoice())
  evaluation = { plan, results: [], current: null, running: true, cancelled: false, report: null, stored: false }
  renderEvaluation()
  updateControlAvailability()
  try {
    for (const item of plan) {
      if (evaluation.cancelled) break
      evaluation.current = item
      renderEvaluation()
      resetting = true
      try {
        currentTask = item.task
        selectPlanner(item.planner)
        await newSession(item.task, 0, null, item.planner, 0, item.init)
        await loadScene()
        renderState(session.snapshot())
      } finally {
        resetting = false
      }
      const running = session
      running.start(false)
      await waitForEpisode(running)
      if (evaluation.cancelled) break
      evaluation.results.push(episodeResult(running.snapshot(), item.run))
      renderEvaluation()
    }
  } catch (e) {
    toast(e.message)
  } finally {
    evaluation.running = false
    evaluation.current = null
    evaluation.report = evaluationReport({ plan, results: evaluation.results, complete: evaluation.results.length === plan.length })
    if (!storeReport(evaluation.report) && port) toast('评测报告超过视图状态上限，未保存；仍可导出')
    renderEvaluation()
    renderState(session.snapshot())
  }
}

$('#eval-run').onclick = () => {
  if (evaluation?.running) {
    evaluation.cancelled = true
    session.stop()
    return
  }
  if (controlPending || resetting || ['running', 'paused'].includes(state?.status)) {
    toast('请先停止当前实验')
    return
  }
  runEvaluation().catch((e) => toast(e.message))
}
$('#eval-export-open').onclick = () => {
  $('#eval-json').value = JSON.stringify(evaluation.report, null, 2)
  $('#eval-copy-status').textContent = port ? '报告也保存在本视图的状态里，重新打开后仍可查看。' : '未在 Studio 中打开，报告只保留在本页。'
  $('#eval-export').hidden = false
  $('#eval-json').focus()
}
$('#eval-export-close').onclick = () => {
  $('#eval-export').hidden = true
  $('#eval-export-open').focus()
}
$('#eval-export').onkeydown = (event) => {
  if (event.key === 'Escape') $('#eval-export-close').click()
}
$('#eval-copy').onclick = async () => {
  const text = $('#eval-json')
  text.select()
  let copied = false
  try {
    await navigator.clipboard.writeText(text.value)
    copied = true
  } catch {
    copied = document.execCommand('copy')
  }
  $('#eval-copy-status').textContent = copied ? '已复制到剪贴板' : '已选中全部内容，按 ⌘C 或 Ctrl+C 复制'
}
renderEvaluation()

async function boot() {
  connect()
  try {
    performance.mark('cobot:boot')
    const [engine, pack] = await Promise.all([loadMujoco(), pandaPack()])
    mujoco = engine
    geometries = pandaGeometries(pack)
    performance.mark('cobot:assets')
    config = await api('/api/config')
    $('#task-goal').textContent = config.tasks.transfer.goal
    await newSession('transfer', 0, Number($('#threshold').value))
    performance.mark('cobot:world')
    await loadScene()
    renderState(await api('/api/state'))
    performance.mark('cobot:ready')
    const poll = async () => {
      try {
        if (!resetting && !controlPending) {
          const next = await api('/api/state')
          if (!resetting && !controlPending) {
            if (activeId !== next.id) await loadScene()
            renderState(next)
          }
        }
      } catch {
        // A failed poll retries on the next tick.
      }
      setTimeout(poll, document.hidden ? 3000 : state?.status === 'running' ? 180 : 900)
    }
    poll()
  } catch (e) {
    $('#loading').textContent = '场景加载失败'
    toast(e.message)
  }
}
boot()
