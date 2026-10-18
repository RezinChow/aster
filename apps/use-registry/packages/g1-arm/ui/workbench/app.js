// 宇树 G1 人形机器人右臂仿真实验台。Ported from the EmbodiedJev workbench (MIT).
// The page keeps the original layout and interaction. The original /api server
// is replaced by an in-page router: MuJoCo WASM runs the episode, and each
// decision goes to this package's edge agent through aix.agent.invoke. When the
// agent cannot answer, the rule controller chooses and the panel says so.
import { loadMujoco } from './engine.js'
import { MAX_SEEDS, episodeResult, evaluationPlan, evaluationReport, reportState, storedReport } from './evaluation.js'
import { g1Pack } from './meshes.js'
import { IMAGE, Perception, externalCalibration, wristCalibration } from './perception.js'
import { RobotScene, g1Geometries, imageURL } from './robot-scene.js'
import { Session } from './session.js'
import { ICONS } from './vendor/lucide/icons.js'
import { VISUALS } from './vendor/g1/g1.js'
import { TASKS } from './world.js'

const AGENT = 'g1-arm'
const PROTOCOL = 1

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
  finish: '完成',
  incremental: '固定短步'
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
const taskLabel = (task) => TASKS[task]?.name ?? task
const MODES = {
  privileged: { label: '仿真真值', icon: 'database', help: '决策读取仿真器给出的物体与目标坐标。' },
  rgbd: { label: 'RGB-D 相机', icon: 'camera', help: '外部与腕部相机渲染 RGB-D 图像，按颜色与深度估计物体与目标坐标；看不到时不使用真值补齐。' },
  vision: {
    label: '视觉模型',
    icon: 'image',
    help: '两路相机的 RGB 图像与本体感知发给能看图的模型，模型每步从 21 个固定动作（18 个平移短步加张开、闭合、保持）里选一个。没有物体坐标，也不用规则或真值替代。'
  }
}
const MAX_CYCLES = { privileged: 30, rgbd: 30, vision: 80 }
const MODE_SHORT = { privileged: '真值', rgbd: 'RGB-D', vision: '视觉' }
const EVAL_SPEED = 4
const EVAL_DONE = new Set(['completed', 'stopped', 'error', 'exhausted', 'stalled', 'uncertain'])
const IMAGE_BYTES = 256 * 1024
const VIEW_NAMES = { external: '外部相机', wrist: '腕部相机' }

let config,
  state,
  currentTask = 'transfer',
  currentMode = 'privileged',
  camera = null,
  activeId = null,
  replayMode = false,
  replayTimer = null,
  replayIndex = 0,
  historySignature = '',
  candidateSignature = '',
  resetting = false,
  controlPending = false,
  selectedCycle = null,
  lastCompletedDecision = null,
  evaluation = null
$('#app').innerHTML = `
<div class="app-shell">
 <div class="body-grid">
 <div class="scrim" id="scrim"></div>
 <main class="workspace">
  <div class="viewport" id="viewport"><div class="scene-tools"><button class="icon-button mobile-settings" id="settings-open" title="实验任务" aria-label="实验任务">${icon('sliders-horizontal')}</button><button class="icon-button" id="camera-top" title="俯视" aria-label="俯视">${icon('scan')}</button><button class="icon-button" id="camera-home" title="复位视角" aria-label="复位视角">${icon('focus')}</button></div><div class="viewport-label"><h1>仿真画面</h1><p id="scene-task">搬运入盘</p></div><div class="scene-status" id="scene-status"><span class="dot"></span><span id="status-text">待命</span></div><div class="scene-axis"><span class="axis-x">X</span><span class="axis-y">Y</span><span class="axis-z">Z</span><span>坐标 · m</span></div><span class="scene-bottom-right" id="scene-time">t = 0.00 s</span><div class="success-stamp" id="success-stamp">${icon('circle-check')}物体稳定 · 夹爪已撤离</div><div class="loading" id="loading">加载机器人场景…</div>
  <aside class="sidebar hud" id="sidebar">
   <section><div class="section-topline"><h2>实验任务</h2><button class="icon-button close-settings" id="settings-close" aria-label="关闭参数">${icon('x')}</button></div>
    <div class="task-options"><button class="task-option active" data-task="transfer" aria-current="page">${icon('move-up-right')}<span>搬运入盘</span></button><button class="task-option" data-task="stack">${icon('layers-2')}<span>方块堆叠</span></button><button class="task-option" data-task="barrier">${icon('route')}<span>越障搬运</span></button></div>
    <p class="task-goal" id="task-goal"></p></section>
   <section><div class="section-topline"><h2>观测方式</h2></div>
    <div class="task-options">${Object.entries(MODES)
      .map(([mode, { label, icon: name }]) => `<button class="task-option mode-option${mode === 'privileged' ? ' active' : ''}" data-mode="${mode}"${mode === 'privileged' ? ' aria-current="true"' : ''}>${icon(name)}<span>${label}</span></button>`)
      .join('')}</div>
    <p class="task-goal" id="mode-help">${MODES.privileged.help}</p>
    <div class="camera-panel" id="camera-panel" hidden><div class="camera-views">${Object.entries(VIEW_NAMES)
      .map(([view, name]) => `<figure><img id="camera-${view}" alt="${name}画面" width="${IMAGE.width}" height="${IMAGE.height}"><figcaption>${name}</figcaption></figure>`)
      .join('')}</div><p class="camera-status" id="camera-status" role="status">开始实验后拍摄第一帧</p></div></section>
   <section class="threshold-block"><div class="settings-row"><label for="threshold">决策门槛</label><span class="range-label" id="threshold-value">0.55</span></div><input class="range" id="threshold" type="range" min="0" max="1" step="0.05" value="0.55" aria-describedby="threshold-help"><p class="field-help" id="threshold-help">低于这个概率时暂停，等你决定是否继续。</p></section>
   <details class="advanced-settings eval-block" id="eval-block"><summary>批量评测<span id="eval-progress">按观测方式、任务和种子依次运行</span></summary>
    <section><div class="eval-row"><span class="eval-name">任务</span><div class="eval-chips">${Object.entries(TASKS)
      .map(([task, { name }]) => `<button type="button" class="eval-chip" data-eval-task="${task}" aria-pressed="true">${escape(name)}</button>`)
      .join('')}</div></div>
    <div class="eval-row"><span class="eval-name">观测</span><div class="eval-chips">${Object.keys(MODES)
      .map((mode) => `<button type="button" class="eval-chip" data-eval-mode="${mode}" aria-pressed="${mode !== 'vision'}">${MODE_SHORT[mode]}</button>`)
      .join('')}</div></div>
    <div class="settings-row"><label for="eval-seeds">每项种子数</label><span class="range-label" id="eval-seeds-value">3</span></div><input class="range" id="eval-seeds" type="range" min="1" max="${MAX_SEEDS}" step="1" value="3">
    <div class="eval-actions"><button type="button" class="secondary" id="eval-run">${icon('chart-column')}<span id="eval-run-label">开始评测</span></button><button type="button" class="icon-button" id="eval-export-open" title="导出报告" aria-label="导出报告" disabled>${icon('download')}</button></div>
    <div id="eval-summary"></div>
    <p class="field-help" id="eval-help">视觉模型每步调用一次能看图的模型，只能在 Studio 中评测。低于决策门槛的局记为等待人工。</p></section>
   </details>
  </aside>
  <aside class="inspector hud" id="inspector" aria-label="当前动作">
   <section class="inspector-section decision-section" id="decision-section" tabindex="-1"><div class="section-topline"><h2 id="decision-heading">当前动作</h2><span class="eyebrow" id="stage">就绪</span></div><div class="decision-context"><span id="decision-context" role="status">等待开始</span><button type="button" class="text-button" id="decision-live" hidden>返回实时</button></div><div class="decision-title">${icon('git-branch')}<span id="decision-title">等待开始</span></div><div class="decision-meta"><span id="decision-provider">本包 agent</span><span id="latency">— ms</span></div><div id="intent-panel" hidden><div class="decision-meta"><span id="intent-heading">阶段</span><span id="intent-latency"></span></div><div class="probabilities" id="intent-probabilities"></div></div><div class="probabilities" id="probabilities"><div class="empty">尚无动作</div></div><p class="decision-note" id="decision-note" hidden></p></section>
   <section class="inspector-section grasp-section"><div class="sensors"><span class="name">夹爪</span><span class="sensor-value" id="gripper">张开</span><span class="name">手指接触</span><div class="contacts"><span class="contact" id="contact-l">左</span><span class="contact" id="contact-r">右</span></div><span class="name">目标支撑</span><span class="sensor-value" id="support">无</span></div></section>
   <div class="event-log"><div class="event-heading"><div class="section-topline"><h2>执行记录</h2><span class="eyebrow" id="event-count">0 步</span></div></div><div class="log-columns" aria-hidden="true"><span>时间</span><span>步</span><span>动作</span><span>结果</span></div><ol class="events" id="events"><li class="empty">暂无执行记录</li></ol></div>
  </aside>
  <div class="hud-dock">
   <div class="telemetry"><div class="metric"><div class="metric-label">末端 X</div><div class="metric-value"><span id="tcp-x">—</span><small>m</small></div></div><div class="metric"><div class="metric-label">末端 Y</div><div class="metric-value"><span id="tcp-y">—</span><small>m</small></div></div><div class="metric"><div class="metric-label">末端 Z</div><div class="metric-value"><span id="tcp-z">—</span><small>m</small></div></div><div class="metric"><div class="metric-label">物体抬升</div><div class="metric-value"><span id="lift">0</span><small>mm</small></div></div></div>
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

function invoke(observation, images) {
  const id = ++messageId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    port.postMessage({
      protocolVersion: PROTOCOL,
      type: 'aix.agent.invoke',
      id,
      agent: AGENT,
      prompt: '选择下一步。',
      parameters: { observation },
      ...(images ? { images } : {})
    })
  })
}

/** One named JPEG under the host's per-image limit. */
function turnImage(name, frame) {
  for (const quality of [0.85, 0.7, 0.55]) {
    const data = imageURL(frame, 'image/jpeg', quality)
    if (Math.floor(((data.length - data.indexOf(',') - 1) * 3) / 4) <= IMAGE_BYTES) return { name, data }
  }
  throw new Error('相机图像超过单张 256 KiB 上限')
}

/** A vision decision has no rule fallback: the model's offered choice, or an error that stops the episode. */
async function chooseByVision(request, started) {
  if (!port) throw new Error('视觉模式需要在 Studio 中打开，由能看图的模型决策；没有使用规则替代。')
  if (!camera?.frames) throw new Error('还没有相机图像')
  const images = Object.entries(camera.frames).map(([view, frame]) => turnImage(view, frame))
  let reply
  try {
    reply = JSON.parse(await invoke(request, images))
  } catch (failure) {
    const reason = failure?.reason ?? 'agent_failed'
    throw new Error(`视觉模型不可用（${refusalNames[reason] ?? reason}），已停止；没有使用规则替代。`)
  }
  if (reply?.error) throw new Error(`视觉模型没有给出可执行的动作（${reply.error}），已停止；没有使用规则替代。`)
  if (reply?.source !== 'model' || typeof reply.choice !== 'string' || !(reply.choice in request.options)) {
    throw new Error('视觉模型返回了未提供的选项，已停止。')
  }
  return {
    probabilities: {},
    selected_probability: null,
    provider: 'agent',
    choice: reply.choice,
    model: reply.model,
    model_call: true,
    latency_ms: performance.now() - started,
    readout: 'generated_json',
    image_count: images.length,
    image_views: images.map((image) => image.name),
    ...(typeof reply.intent === 'string' ? { intent: reply.intent } : {}),
    ...(typeof reply.visual_evidence === 'string' ? { visual_evidence: reply.visual_evidence } : {})
  }
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
  if (request.control === 'incremental') return chooseByVision(request, started)
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

/**
 * Camera observations for one episode. Each fresh capture renders both views
 * on the sensor rig and estimates the scene from pixels. The estimate error
 * against the simulator is kept for the panel only; the agent never sees it.
 */
function cameraObserver(task, mode) {
  const perception = new Perception(task, { geometry: mode === 'rgbd' })
  const observer = { perception, frames: null, urls: null, error: null, captures: 0 }
  let hand = null
  observer.observe = async (world) => {
    const sensors = world.sensors()
    if (perception.lastTime === sensors.simTime && perception.lastObservation) return structuredClone(perception.lastObservation)
    const frame = world.frame({})
    hand ??= world.bodyId('hand')
    const frames = sceneView.sensorRig(IMAGE).capture(frame, {
      external: externalCalibration(),
      wrist: wristCalibration(frame.bodies[hand])
    })
    observer.frames = frames
    observer.urls = null
    observer.captures += 1
    try {
      const observation = perception.observe(frames, sensors)
      if (observation.object) {
        const error = (a, b) => Math.hypot(...a.map((value, i) => value - b[i])) * 1000
        observer.error = { object_mm: error(observation.object, world.cube), destination_mm: error(observation.destination, world.target) }
        observer.worst = Math.max(observer.worst ?? 0, observer.error.object_mm, observer.error.destination_mm)      }
      return observation
    } finally {
      renderCamera()
    }
  }
  return observer
}

async function newSession(task, seed, threshold, mode = 'privileged', speed = undefined) {
  const observer = mode === 'privileged' ? null : cameraObserver(task, mode)
  const next = await Session.create(mujoco, { task, seed, threshold, choose, mode, speed, maxCycles: MAX_CYCLES[mode], observe: observer?.observe })
  const previous = session
  session = next
  camera = observer
  if (previous) previous.dispose()
}

function renderCamera() {
  $('#camera-panel').hidden = !camera
  if (!camera) return
  const metadata = camera.perception.history.at(-1)
  if (camera.frames && !camera.urls) camera.urls = Object.fromEntries(Object.entries(camera.frames).map(([view, frame]) => [view, imageURL(frame)]))
  for (const view of Object.keys(VIEW_NAMES)) {
    const image = $(`#camera-${view}`)
    const url = camera.urls?.[view]
    if (url && image.src !== url) image.src = url
    image.hidden = !url
  }
  if (!metadata) {
    $('#camera-status').textContent = '开始实验后拍摄第一帧'
    return
  }
  const statusNames = { ready: '定位就绪', partial: '部分沿用上次定位', unavailable: '缺少必需物体' }
  const error = camera.error
  const accuracy = error
    ? ` · 方块误差 ${error.object_mm.toFixed(1)} mm · 目标误差 ${error.destination_mm.toFixed(1)} mm · 本轮最大 ${camera.worst.toFixed(1)} mm`
    : ''
  const status = metadata.source === 'vision' ? '图像直接交给模型，不做定位' : (statusNames[metadata.status] ?? metadata.status)
  $('#camera-status').textContent = `第 ${metadata.capture_id} 帧 · ${status}${accuracy}`
  $('#camera-status').classList.toggle('failure', metadata.status === 'unavailable')
}

function sceneData() {
  const bodies = {}
  for (const { body } of VISUALS) bodies[body] ??= session.world.bodyId(body)
  return { primitives: session.world.primitives(), bodies, geometries, task: session.world.task }
}

async function api(path, body) {
  if (path === '/api/config') return { tasks: TASKS }
  if (path === '/api/scene') return sceneData()
  if (path === '/api/state') return session.snapshot()
  if (path === '/api/reset') {
    await newSession(body.task, body.seed, body.threshold, body.mode)
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
function renderFrame(frame) {
  if (!frame) return
  sceneView.render(frame)
  const o = frame.observation || {}
  ;['x', 'y', 'z'].forEach((k, i) => ($(`#tcp-${k}`).textContent = Number.isFinite(o.tcp?.[i]) ? o.tcp[i].toFixed(3) : '—'))
  $('#lift').textContent = Number.isFinite(o.max_lift_m) ? (o.max_lift_m * 1000).toFixed(0) : '—'
  $('#gripper').textContent = o.gripper === 'closed' ? '闭合' : '张开'
  $('#contact-l').classList.toggle('on', o.finger_contacts?.includes('left') || false)
  $('#contact-r').classList.toggle('on', o.finger_contacts?.includes('right') || false)
  $('#support').textContent = o.support_contact === undefined ? '—' : o.support_contact ? '有' : '无'
  $('#support').classList.toggle('on', o.support_contact)
  $('#scene-time').textContent = Number.isFinite(o.sim_seconds) ? 't = ' + o.sim_seconds.toFixed(2) + ' s' : '—'
}
async function loadScene() {
  $('#loading').classList.remove('hidden')
  const data = await api('/api/scene')
  sceneView.load(data)
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

function renderDecision(s) {
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
  const seen = [decision?.intent && `意图：${decision.intent}`, decision?.visual_evidence && `画面依据：${decision.visual_evidence}`].filter(Boolean).join(' ')
  if (seen && !(failure && s.message)) note = note ? `${seen} ${note}` : seen
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
  for (const el of document.querySelectorAll('.task-option,#threshold')) el.disabled = locked
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
    currentMode = s.observation_mode
    for (const button of document.querySelectorAll('[data-mode]')) {
      const on = button.dataset.mode === s.observation_mode
      button.classList.toggle('active', on)
      if (on) button.setAttribute('aria-current', 'true')
      else button.removeAttribute('aria-current')
    }
    $('#mode-help').textContent = MODES[s.observation_mode].help
    renderCamera()
    $('#timeline-label').textContent = '轨迹'
    $('#threshold').value = s.threshold
    $('#threshold-value').textContent = s.threshold.toFixed(2)
  }
  if (!replayMode) renderFrame(s.frame)
  $('#status-text').textContent = replayMode ? '轨迹回放' : stateNames[s.status]
  $('#scene-status').classList.toggle('error', ['error', 'exhausted', 'uncertain', 'stalled'].includes(s.status))
  $('#success-stamp').classList.toggle('visible', s.status === 'completed' && !replayMode)
  renderDecision(s)
  $('#run-budget').textContent = String(s.cycles).padStart(2, '0') + ' / ' + s.max_cycles + ' 步'
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
  const hsig = s.id + '-' + s.history.length + '-' + selectedCycle
  if (hsig !== historySignature) {
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
    mode: currentMode,
    seed: state?.seed ?? 0,
    threshold: Number($('#threshold').value)
  }
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
$('#camera-home').onclick = () => sceneView.cameraHome()
$('#camera-top').onclick = () => sceneView.cameraTop()
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
for (const button of document.querySelectorAll('[data-mode]'))
  button.onclick = async () => {
    if (controlPending || resetting || button.dataset.mode === currentMode) return
    currentMode = button.dataset.mode
    await reset()
  }

// ---- Batch evaluation ----

const chosen = (attribute) => [...document.querySelectorAll(`[data-${attribute}][aria-pressed="true"]`)].map((b) => b.getAttribute(`data-${attribute}`))
for (const chip of document.querySelectorAll('.eval-chip'))
  chip.onclick = () => {
    chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'))
    renderEvaluation()
  }
$('#eval-seeds').oninput = () => {
  $('#eval-seeds-value').textContent = $('#eval-seeds').value
  renderEvaluation()
}

function renderEvaluation() {
  const running = !!evaluation?.running
  let planned = 0
  try {
    planned = evaluationPlan({ tasks: chosen('eval-task'), modes: chosen('eval-mode'), seeds: Number($('#eval-seeds').value) }).length
  } catch {
    planned = 0
  }
  for (const el of document.querySelectorAll('.eval-chip,#eval-seeds')) el.disabled = running
  $('#eval-run').disabled = !running && planned === 0
  $('#eval-run-label').textContent = running ? '停止评测' : planned ? `开始评测（${planned} 局）` : '开始评测'
  $('#eval-export-open').disabled = !evaluation?.report
  const done = evaluation?.results.length ?? 0
  const current = evaluation?.current
  $('#eval-progress').textContent = running
    ? current
      ? `第 ${done + 1} / ${evaluation.plan.length} 局 · ${MODE_SHORT[current.mode]} · ${taskLabel(current.task)} · 种子 ${current.seed}`
      : `准备 ${evaluation.plan.length} 局`
    : evaluation?.report
      ? `${evaluation.report.complete ? '已完成' : '已停止'} ${done} / ${evaluation.report.planned} 局`
      : '按观测方式、任务和种子依次运行'
  const summary = evaluation?.report?.summary ?? (evaluation ? evaluationReport({ threshold: 0, plan: evaluation.plan, results: evaluation.results, complete: false }).summary : [])
  $('#eval-summary').innerHTML = summary.length
    ? `<table class="input-table eval-table"><thead><tr><th>观测 · 任务</th><th>成功</th><th>步数</th><th>调用</th><th>时延</th></tr></thead><tbody>${summary
        .map(
          (row) =>
            `<tr><th>${MODE_SHORT[row.observation_mode]} · ${escape(taskLabel(row.task))}</th><td>${row.successes}/${row.episodes}</td><td>${row.mean_cycles}</td><td>${row.model_calls}</td><td>${row.mean_model_latency_ms === null ? '—' : `${(row.mean_model_latency_ms / 1000).toFixed(1)}s`}</td></tr>`
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
  const threshold = Number($('#threshold').value)
  const plan = evaluationPlan({ tasks: chosen('eval-task'), modes: chosen('eval-mode'), seeds: Number($('#eval-seeds').value) })
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
        await newSession(item.task, item.seed, threshold, item.mode, EVAL_SPEED)
        await loadScene()
        renderState(session.snapshot())
      } finally {
        resetting = false
      }
      const running = session
      running.start(false, threshold)
      await waitForEpisode(running)
      if (evaluation.cancelled) break
      evaluation.results.push(episodeResult(running.snapshot()))
      renderEvaluation()
    }
  } catch (e) {
    toast(e.message)
  } finally {
    evaluation.running = false
    evaluation.current = null
    evaluation.report = evaluationReport({ threshold, plan, results: evaluation.results, complete: evaluation.results.length === plan.length })
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
async function boot() {
  connect()
  try {
    performance.mark('g1:boot')
    const [engine, pack] = await Promise.all([loadMujoco(), g1Pack()])
    mujoco = engine
    geometries = g1Geometries(pack)
    performance.mark('g1:assets')
    config = await api('/api/config')
    $('#task-goal').textContent = config.tasks.transfer.goal
    await newSession('transfer', 0, Number($('#threshold').value))
    performance.mark('g1:world')
    await loadScene()
    renderState(await api('/api/state'))
    performance.mark('g1:ready')
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
