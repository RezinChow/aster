// 3DR iris 四旋翼仿真实验台。The page keeps the arm workbench layout.
// MuJoCo WASM flies the episode, and each decision goes to this package's
// edge agent through aix.agent.invoke. When the agent cannot answer, the rule
// controller chooses and the panel says so.
import { loadMujoco } from './engine.js'
import { AgentClient } from './agent-client.js'
import { irisPack } from './meshes.js'
import { PHASES } from './planning.js'
import { RobotScene, irisGeometries } from './robot-scene.js'
import { Session } from './session.js'
import { ICONS } from './vendor/lucide/icons.js'
import { VISUALS } from './vendor/iris/iris.js'
import { TASKS } from './world.js'

const PROTOCOL = 1
const icon = (name) => ICONS[name] ?? ''
const $ = (selector) => document.querySelector(selector)
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
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
const stageNames = { ready: '就绪', deciding: '决策中', previewing: '动作预演', executing: '执行中', observing: '读取反馈', verified: '已验证' }
const refusalNames = {
  standalone: '未在 Studio 中打开',
  busy: '代理正忙',
  capacity: '代理容量已满',
  not_found: '没有找到本包的 agent',
  invalid_request: '请求被拒绝',
  agent_failed: '代理运行失败',
  closed: '视图已关闭',
  invalid_choice: '代理返回了未提供的选项',
  agent_timeout: '代理回复超时'
}
const RULE_MODEL = '规则控制器'
const FALLBACK_MODEL = '规则控制器（agent 不可用）'
const taskLabel = (task) => TASKS[task]?.name ?? task

let state
let currentTask = 'patrol'
let activeId = null
let replayMode = false
let replayTimer = null
let replayIndex = 0
let replayRequest = 0
let historySignature = ''
let candidateSignature = ''
let resetting = false
let controlPending = false
let selectedCycle = null
let lastCompletedDecision = null

$('#app').innerHTML = `
<div class="app-shell">
 <div class="body-grid">
 <div class="scrim" id="scrim"></div>
 <main class="workspace">
  <div class="viewport" id="viewport"><div class="scene-tools"><button class="icon-button mobile-settings" id="settings-open" title="实验任务" aria-label="实验任务">${icon('sliders-horizontal')}</button><button class="icon-button" id="camera-top" title="俯视" aria-label="俯视">${icon('scan')}</button><button class="icon-button" id="camera-home" title="复位视角" aria-label="复位视角">${icon('focus')}</button></div><div class="viewport-label"><h1>仿真画面</h1><p id="scene-task">空中巡航</p></div><div class="scene-status" id="scene-status"><span class="dot"></span><span id="status-text">待命</span></div><div class="scene-axis"><span class="axis-x">X</span><span class="axis-y">Y</span><span class="axis-z">Z</span><span>坐标 · m</span></div><span class="scene-bottom-right" id="scene-time">t = 0.00 s</span><div class="success-stamp" id="success-stamp">${icon('circle-check')}任务完成 · 已降落</div><div class="loading" id="loading">加载飞行场景…</div>
  <aside class="sidebar hud" id="sidebar">
   <section><div class="section-topline"><h2>实验任务</h2><button class="icon-button close-settings" id="settings-close" aria-label="关闭参数">${icon('x')}</button></div>
    <div class="task-options"><button class="task-option active" data-task="patrol" aria-current="page">${icon('route')}<span>空中巡航</span></button><button class="task-option" data-task="delivery">${icon('layers-2')}<span>外卖配送</span></button><button class="task-option" data-task="inspect">${icon('camera')}<span>设施巡检</span></button></div>
    <p class="task-goal" id="task-goal"></p></section>
   <section class="threshold-block"><div class="settings-row"><label for="threshold">决策门槛</label><span class="range-label" id="threshold-value">0.55</span></div><input class="range" id="threshold" type="range" min="0" max="1" step="0.05" value="0.55" aria-describedby="threshold-help"><p class="field-help" id="threshold-help">低于这个概率时暂停，等你决定是否继续。规则选择没有概率，不会因此暂停。</p></section>
  </aside>
  <aside class="inspector hud" id="inspector" aria-label="当前动作">
   <section class="inspector-section decision-section" id="decision-section" tabindex="-1"><div class="section-topline"><h2 id="decision-heading">当前动作</h2><span class="eyebrow" id="stage">就绪</span></div><div class="decision-context"><span id="decision-context" role="status">等待开始</span><button type="button" class="text-button" id="decision-live" hidden>返回实时</button></div><div class="decision-title">${icon('git-branch')}<span id="decision-title">等待开始</span></div><div class="decision-meta"><span id="decision-provider">本包 agent</span><span id="latency">— ms</span></div><div id="intent-panel" hidden><div class="decision-meta"><span id="intent-heading">阶段</span><span id="intent-latency"></span></div><div class="probabilities" id="intent-probabilities"></div></div><div class="probabilities" id="probabilities"><div class="empty">尚无动作</div></div><p class="decision-note" id="decision-note" hidden></p></section>
   <section class="inspector-section grasp-section"><div class="sensors"><span class="name">高度</span><span class="sensor-value" id="altitude">—</span><span class="name">航向</span><span class="sensor-value" id="heading">—</span><span class="name">任务</span><span class="sensor-value" id="mission">待命</span></div></section>
   <div class="event-log"><div class="event-heading"><div class="section-topline"><h2>执行记录</h2><span class="eyebrow" id="event-count">0 步</span></div></div><div class="log-columns" aria-hidden="true"><span>时间</span><span>步</span><span>动作</span><span>结果</span></div><ol class="events" id="events"><li class="empty">暂无执行记录</li></ol></div>
  </aside>
  <div class="hud-dock">
   <div class="telemetry"><div class="metric"><div class="metric-label">机位 X</div><div class="metric-value"><span id="tcp-x">—</span><small>m</small></div></div><div class="metric"><div class="metric-label">机位 Y</div><div class="metric-value"><span id="tcp-y">—</span><small>m</small></div></div><div class="metric"><div class="metric-label">机位 Z</div><div class="metric-value"><span id="tcp-z">—</span><small>m</small></div></div><div class="metric"><div class="metric-label">最高高度</div><div class="metric-value"><span id="lift">0</span><small>m</small></div></div></div>
   <div class="timeline"><button class="icon-button" id="replay-play" aria-label="播放轨迹" title="播放轨迹">${icon('play')}</button><div class="timeline-track"><div class="timeline-caption"><span id="timeline-label">轨迹</span><span id="frame-label">0000 / 0000</span></div><input id="timeline" type="range" min="0" max="0" value="0" aria-label="轨迹时间轴"></div><button class="live-link" id="live">实时</button></div>
   <div class="controls"><button class="primary" id="run">${icon('play')}<span id="run-label">运行实验</span></button><button class="icon-button" id="step" title="单步执行" aria-label="单步执行">${icon('step-forward')}</button><button class="icon-button stop" id="stop" title="停止实验" aria-label="停止实验">${icon('square')}</button><button class="icon-button" id="reset" title="重置实验" aria-label="重置实验">${icon('rotate-ccw')}</button><span class="run-budget" id="run-budget">00 / 30 步</span></div>
  </div>
  </div>
 </main>
</div>
</div><div class="toast" id="toast" role="status"></div>`

let toastTimer
function toast(message) {
  $('#toast').textContent = message
  $('#toast').classList.add('visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 6000)
}

let agentClient = null

function documentId() {
  const match = /(?:^|[#&])aix-document=([a-f0-9]{64})(?:&|$)/.exec(location.hash)
  return match ? match[1] : null
}

function connect() {
  const id = documentId()
  if (!id || window.parent === window) return
  const channel = new MessageChannel()
  agentClient = new AgentClient(channel.port1)
  window.addEventListener('pagehide', () => agentClient.close(), { once: true })
  window.parent.postMessage({ protocolVersion: PROTOCOL, type: 'aix.document.ready', documentId: id }, '*', [channel.port2])
}

function ruleChoice(request) {
  const keys = Object.keys(request.options)
  return keys.length === 1 || !keys.includes(request.baseline_choice) ? keys[0] : request.baseline_choice
}

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

async function choose(_stage, request, signal) {
  const started = performance.now()
  const base = { probabilities: {}, selected_probability: null, provider: 'agent' }
  if (Object.keys(request.options).length === 1) {
    return { ...base, choice: ruleChoice(request), latency_ms: 0, model_call: false, reason: 'only_eligible_action' }
  }
  let reason = 'standalone'
  if (agentClient) {
    try {
      const reply = JSON.parse(await agentClient.invoke(request, signal))
      if (!reply || typeof reply.choice !== 'string' || !(reply.choice in request.options)) {
        throw Object.assign(new Error('invalid_choice'), { reason: 'invalid_choice' })
      }
      const latency = performance.now() - started
      if (reply.source === 'model') {
        const probabilities = publishedProbabilities(reply.probabilities, request.options)
        return {
          ...base,
          choice: reply.choice,
          model: reply.model,
          model_call: true,
          latency_ms: latency,
          ...(probabilities
            ? { probabilities, selected_probability: probabilities[reply.choice], provider_confidence: reply.confidence ?? null, readout: 'systemone' }
            : { readout: 'generated_json' })
        }
      }
      return { ...base, choice: reply.choice, model: RULE_MODEL, model_call: false, latency_ms: latency, reason: 'agent_rule', note: reply.note ?? '' }
    } catch (failure) {
      reason = failure?.reason ?? 'agent_failed'
    }
  }
  return { ...base, choice: ruleChoice(request), model: FALLBACK_MODEL, model_call: false, latency_ms: performance.now() - started, reason: 'agent_unavailable', agent_error: reason }
}

let mujoco = null
let session = null
let geometries = null

function sceneData() {
  const bodies = {}
  for (const { body } of VISUALS) bodies[body] ??= session.world.bodyId(body)
  return { primitives: session.world.primitives(), bodies, geometries, task: session.world.task }
}

async function api(path, body) {
  if (path === '/api/scene') return sceneData()
  if (path === '/api/state') return session.snapshot()
  if (path === '/api/reset') {
    const next = Session.create(mujoco, { task: body.task, seed: 0, threshold: body.threshold, choose, speed: 1.5 })
    const previous = session
    session = next
    if (previous) await previous.dispose()
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

const sceneView = new RobotScene($('#viewport'), { onError: toast })

function missionLabel(observation) {
  const mission = observation?.mission
  if (!mission) return '待命'
  if (mission.task === 'patrol') return `航点 ${mission.visited.filter(Boolean).length}/3`
  if (mission.task === 'delivery') return mission.held ? '载荷已挂上' : '载荷未挂'
  return `巡检 ${mission.inspected.filter(Boolean).length}/3`
}

function renderFrame(frame) {
  if (!frame) return
  sceneView.render(frame)
  const observation = frame.observation || {}
  ;['x', 'y', 'z'].forEach((axis, index) => {
    $(`#tcp-${axis}`).textContent = Number.isFinite(observation.tcp?.[index]) ? observation.tcp[index].toFixed(3) : '—'
  })
  $('#lift').textContent = Number.isFinite(observation.max_lift_m) ? observation.max_lift_m.toFixed(2) : '—'
  $('#altitude').textContent = Number.isFinite(observation.tcp?.[2]) ? `${observation.tcp[2].toFixed(2)} m` : '—'
  $('#heading').textContent = Number.isFinite(observation.mission?.yaw_deg) ? `${observation.mission.yaw_deg.toFixed(0)}°` : '—'
  $('#mission').textContent = missionLabel(observation)
  $('#scene-time').textContent = Number.isFinite(observation.sim_seconds) ? `t = ${observation.sim_seconds.toFixed(2)} s` : '—'
}

async function loadScene() {
  $('#loading').classList.remove('hidden')
  const data = await api('/api/scene')
  sceneView.load(data)
  $('#scene-task').textContent = taskLabel(data.task)
  $('#loading').classList.add('hidden')
}

function agentNote(decision, intent) {
  const fallback = [decision, intent].find((item) => item?.reason === 'agent_unavailable')
  if (fallback) return `本包 agent 不可用（${refusalNames[fallback.agent_error] ?? fallback.agent_error}），这一步由规则控制器选择。`
  const rule = [decision, intent].find((item) => item?.reason === 'agent_rule')
  if (rule?.note === 'lexical_decision_engine') return '当前决策服务是词法排序引擎，不能做飞行规划。这一步由规则控制器选择。'
  if (rule) return `agent 没有拿到模型回复${rule.note ? `（${rule.note}）` : ''}，这一步按规则选择。`
  return ''
}

function renderDecision(snapshot) {
  const history = snapshot.history.find((item) => item.cycle === selectedCycle)
  if (selectedCycle !== null && !history) selectedCycle = null
  if (snapshot.last_decision && snapshot.candidates?.length) lastCompletedDecision = snapshot
  else if (!lastCompletedDecision && snapshot.history.length) lastCompletedDecision = snapshot.history.at(-1)
  const shown = history || snapshot.last_decision ? snapshot : lastCompletedDecision || snapshot
  const intent = history ? history.intent : shown.last_intent || shown.intent
  const decision = history ? history.decision : shown.last_decision || shown.decision
  const candidates = history?.candidates || snapshot.candidates || []
  const pending = snapshot.status === 'running' && ['deciding', 'previewing'].includes(snapshot.stage)
  $('#intent-heading').textContent = history ? '该步阶段' : '阶段'
  $('#decision-heading').textContent = history ? `第 ${history.cycle} 步` : '当前动作'
  $('#decision-live').hidden = !history
  $('#stage').textContent = history ? '历史' : stageNames[snapshot.stage] || snapshot.stage
  $('#decision-context').textContent = history ? `第 ${history.cycle} 步 · ${history.after.sim_seconds.toFixed(2)} s` : pending ? '正在选择动作' : stateNames[snapshot.status] || snapshot.status
  $('#decision-title').textContent = candidates.find((candidate) => candidate.id === decision?.choice)?.label || PHASES[intent?.choice] || '等待开始'
  $('#decision-provider').textContent = decision?.model || intent?.model || '本包 agent'
  $('#latency').textContent = decision?.model_call ? `${Number(decision.latency_ms).toFixed(0)} ms` : decision ? '无模型调用' : '— ms'
  const failure = ['error', 'uncertain', 'exhausted', 'stalled'].includes(snapshot.status)
  let note = history ? '正在查看这一步的选择。' : failure && snapshot.message ? snapshot.message : pending ? '正在计算下一步。' : ''
  const fallback = agentNote(decision, intent)
  if (fallback) note = note ? `${fallback} ${note}` : fallback
  $('#decision-note').textContent = note
  $('#decision-note').hidden = !note
  $('#decision-note').classList.toggle('failure', !history && failure && !!snapshot.message)
  const signature = JSON.stringify([selectedCycle, candidates, decision, intent])
  if (signature === candidateSignature) return
  candidateSignature = signature
  $('#intent-panel').hidden = !intent
  $('#intent-latency').textContent = intent?.model_call ? `${Number(intent.latency_ms).toFixed(0)} ms` : intent?.reason === 'only_eligible_action' ? '单一可行阶段 · 无模型调用' : '规则选择'
  $('#intent-probabilities').innerHTML = intent
    ? (Object.entries(intent.probabilities || {}).length ? Object.entries(intent.probabilities) : [[intent.choice, null]])
        .map(([choice, probability]) => `<div class="prob-row ${choice === intent.choice ? 'selected' : ''}"><div class="prob-top"><span>${escape(PHASES[choice] || choice)}</span><span>${probability === null ? '已选择' : `${(probability * 100).toFixed(1)}%`}</span></div></div>`)
        .join('')
    : ''
  const probabilities = decision?.probabilities || {}
  $('#probabilities').innerHTML = candidates.length
    ? candidates
        .map((candidate) => {
          const selected = decision?.choice === candidate.id
          const rejected = candidate.admitted === false
          const probability = probabilities[candidate.id]
          const label = rejected ? '已拦截' : probability !== undefined ? `${(probability * 100).toFixed(1)}%` : selected ? '已选择' : '等待决策'
          return `<div class="prob-row ${selected ? 'selected' : ''} ${rejected ? 'rejected' : ''}" title="${escape(candidate.rejection || '')}"><div class="prob-top"><span>${escape(candidate.label || candidate.id)}</span><span>${label}</span></div><div class="bar"><div class="bar-fill" style="width:${probability !== undefined ? probability * 100 : selected ? 100 : 0}%"></div></div></div>`
        })
        .join('')
    : `<div class="empty">${pending ? '正在选择动作…' : '尚无动作'}</div>`
}

function updateControlAvailability() {
  const pending = !state || controlPending || resetting
  $('#run').disabled = pending || ['completed', 'stopped', 'error', 'exhausted', 'stalled'].includes(state.status)
  $('#step').disabled = pending || ['running', 'completed', 'stopped', 'error', 'exhausted', 'stalled'].includes(state.status)
  $('#stop').disabled = pending || ['idle', 'completed', 'stopped'].includes(state.status)
  $('#reset').disabled = pending
  $('#replay-play').disabled = pending || state.frame_count < 2 || state.status === 'running'
  $('#timeline').disabled = pending
  $('#live').disabled = pending
  const locked = pending || ['running', 'paused'].includes(state.status)
  for (const element of document.querySelectorAll('.task-option,#threshold')) element.disabled = locked
}

function renderState(snapshot) {
  state = snapshot
  if (activeId !== snapshot.id) {
    activeId = snapshot.id
    historySignature = ''
    candidateSignature = ''
    selectedCycle = null
    lastCompletedDecision = null
    replayMode = false
    replayRequest += 1
    clearInterval(replayTimer)
    replayTimer = null
    currentTask = snapshot.task
    for (const button of document.querySelectorAll('[data-task]')) {
      const on = button.dataset.task === snapshot.task
      button.classList.toggle('active', on)
      if (on) button.setAttribute('aria-current', 'page')
      else button.removeAttribute('aria-current')
    }
    $('#task-goal').textContent = TASKS[snapshot.task].goal
    $('#timeline-label').textContent = '轨迹'
    $('#threshold').value = snapshot.threshold
    $('#threshold-value').textContent = snapshot.threshold.toFixed(2)
  }
  if (!replayMode) renderFrame(snapshot.frame)
  $('#status-text').textContent = replayMode ? '轨迹回放' : stateNames[snapshot.status]
  $('#scene-status').classList.toggle('error', ['error', 'exhausted', 'uncertain', 'stalled'].includes(snapshot.status))
  $('#success-stamp').classList.toggle('visible', snapshot.status === 'completed' && !replayMode)
  renderDecision(snapshot)
  $('#run-budget').textContent = `${String(snapshot.cycles).padStart(2, '0')} / ${snapshot.max_cycles} 步`
  $('#run-label').textContent = snapshot.status === 'running' ? '暂停实验' : snapshot.status === 'uncertain' ? '确认并继续' : snapshot.status === 'paused' ? '继续实验' : '运行实验'
  const runIcon = snapshot.status === 'running' ? 'pause' : 'play'
  if ($('#run').dataset.icon !== runIcon) {
    $('#run').dataset.icon = runIcon
    $('#run svg').outerHTML = icon(runIcon)
  }
  updateControlAvailability()
  $('#timeline').max = Math.max(0, snapshot.frame_count - 1)
  if (!replayMode) {
    $('#timeline').value = snapshot.frame_count - 1
    $('#frame-label').textContent = `${String(snapshot.frame_count).padStart(4, '0')} / ${String(snapshot.frame_count).padStart(4, '0')}`
  }
  const signature = `${snapshot.id}-${snapshot.history.length}-${selectedCycle}`
  if (signature !== historySignature) {
    historySignature = signature
    $('#event-count').textContent = `${snapshot.history.length} 步`
    $('#events').innerHTML = snapshot.history.length
      ? snapshot.history
          .map((item) => {
            const outcome = item.after.success ? '任务完成' : item.after.mission?.held ? '载荷在钩上' : '位置已更新'
            const active = item.cycle === selectedCycle
            return `<li class="event${active ? ' active' : ''}"><button type="button" class="event-button" data-cycle="${item.cycle}" aria-pressed="${active}"><span class="log-time">${item.after.sim_seconds.toFixed(1)} s</span><span class="log-step">${item.cycle}</span><span class="log-action">${escape(item.label)}</span><span class="log-result">${outcome}</span></button></li>`
          })
          .join('')
      : '<li class="empty">暂无执行记录</li>'
    if (selectedCycle === null) $('#events').scrollTop = $('#events').scrollHeight
  }
  if (snapshot.message && snapshot.message !== renderState.lastMessage) {
    toast(snapshot.message)
    renderState.lastMessage = snapshot.message
  }
}

function drawer(open) {
  $('#sidebar').classList.toggle('open', open)
  $('#scrim').classList.toggle('visible', open)
}

async function reset() {
  if (!mujoco || !geometries || resetting || controlPending) return
  resetting = true
  updateControlAvailability()
  clearInterval(replayTimer)
  replayTimer = null
  replayRequest += 1
  replayMode = false
  try {
    const snapshot = await api('/api/reset', { task: currentTask, threshold: Number($('#threshold').value) })
    await loadScene()
    renderState(snapshot)
  } catch (failure) {
    toast(failure.message)
  } finally {
    resetting = false
    updateControlAvailability()
  }
}

async function control(action) {
  if (!state || controlPending || resetting) return
  controlPending = true
  updateControlAvailability()
  try {
    replayRequest += 1
    replayMode = false
    clearInterval(replayTimer)
    replayTimer = null
    renderState(await api(`/api/control/${action}`, { episode_id: state.id, threshold: Number($('#threshold').value) }))
  } catch (failure) {
    toast(failure.message)
  } finally {
    controlPending = false
    updateControlAvailability()
  }
}

$('#run').onclick = () => control(state?.status === 'running' ? 'pause' : 'start')
$('#step').onclick = () => control('step')
$('#stop').onclick = () => control('stop')
$('#reset').onclick = () => reset()
$('#camera-home').onclick = () => sceneView.cameraHome()
$('#camera-top').onclick = () => sceneView.cameraTop()
$('#settings-open').onclick = () => drawer(true)
$('#settings-close').onclick = () => drawer(false)
$('#scrim').onclick = () => drawer(false)
$('#threshold').oninput = () => { $('#threshold-value').textContent = Number($('#threshold').value).toFixed(2) }
$('#decision-live').onclick = () => { selectedCycle = null; renderState(state) }
$('#events').onclick = (event) => {
  const button = event.target.closest('[data-cycle]')
  if (!button) return
  selectedCycle = Number(button.dataset.cycle)
  renderState(state)
}
for (const button of document.querySelectorAll('[data-task]')) {
  button.onclick = async () => {
    if (!mujoco || !geometries || controlPending || resetting) return
    currentTask = button.dataset.task
    await reset()
  }
}
$('#timeline').oninput = async () => {
  replayMode = true
  replayIndex = Number($('#timeline').value)
  const request = ++replayRequest
  const frame = await api(`/api/replay/${replayIndex}`)
  if (request !== replayRequest) return
  renderFrame(frame)
  $('#frame-label').textContent = `${String(replayIndex + 1).padStart(4, '0')} / ${String(state.frame_count).padStart(4, '0')}`
  $('#status-text').textContent = '轨迹回放'
}
$('#live').onclick = () => {
  replayMode = false
  clearInterval(replayTimer)
  replayTimer = null
  renderState(state)
}
$('#replay-play').onclick = () => {
  if (replayTimer) {
    clearInterval(replayTimer)
    replayTimer = null
    return
  }
  replayMode = true
  replayTimer = setInterval(async () => {
    replayIndex = Math.min(state.frame_count - 1, replayIndex + 1)
    $('#timeline').value = replayIndex
    renderFrame(await api(`/api/replay/${replayIndex}`))
    if (replayIndex >= state.frame_count - 1) {
      clearInterval(replayTimer)
      replayTimer = null
    }
  }, 80)
}

async function boot() {
  connect()
  updateControlAvailability()
  try {
    const [engine, pack] = await Promise.all([loadMujoco(), irisPack()])
    mujoco = engine
    geometries = irisGeometries(pack)
    $('#task-goal').textContent = TASKS.patrol.goal
    await reset()
  } catch (failure) {
    toast(failure.message)
    $('#loading').textContent = '场景加载失败'
    return
  }
  const poll = async () => {
    try {
      if (session && !replayMode && !resetting) renderState(await api('/api/state'))
    } catch {
      // The next tick retries.
    }
    setTimeout(poll, document.hidden ? 3000 : state?.status === 'running' ? 180 : 900)
  }
  poll()
}

boot()
