/** Pick one offered action from one workbench observation. */

/** The gateway's decision model. It answers System One questions with probabilities. */
export const DECISION_MODEL = 'platform/apofasi'
export const DEFAULT_MODEL = DECISION_MODEL
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._/:-]{0,127}$/
const MAX_REPLY = 16 * 1024
const DEFAULT_QUESTION = 'Choose the next action that makes progress toward the goal.'

export function optionKeys(options) {
  if (Array.isArray(options)) {
    return options.filter((item) => typeof item === 'string' && item.length > 0)
  }
  if (options && typeof options === 'object') {
    return Object.keys(options).filter((key) => key.length > 0)
  }
  return []
}

export function observationInText(text) {
  if (typeof text !== 'string' || text.length === 0) return null
  let found = null
  let start = -1
  let depth = 0
  let inString = false
  let escape = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escape) escape = false
      else if (char === '\\') escape = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{') {
      if (depth === 0) start = index
      depth += 1
      continue
    }
    if (char !== '}' || depth === 0) continue
    depth -= 1
    if (depth !== 0 || start < 0) continue
    try {
      const value = JSON.parse(text.slice(start, index + 1))
      if (value && typeof value === 'object' && !Array.isArray(value) && value.options) found = value
    } catch {
      // A brace pair that is not JSON stays in the surrounding sentence.
    }
    start = -1
  }
  return found
}

export function observationFrom(prompt, parameters) {
  const supplied = parameters && typeof parameters === 'object' ? parameters.observation : null
  if (supplied && typeof supplied === 'object' && !Array.isArray(supplied) && supplied.options) {
    return supplied
  }
  return observationInText(prompt)
}

/** The deterministic rule: the only option, else an offered baseline, else the first key. */
export function ruleChoice(observation) {
  const keys = optionKeys(observation?.options)
  if (keys.length === 0) return null
  const baseline = typeof observation.baseline_choice === 'string' ? observation.baseline_choice : ''
  return keys.length === 1 || !keys.includes(baseline) ? keys[0] : baseline
}

export function choose(prompt, parameters) {
  const observation = observationFrom(prompt, parameters)
  if (!observation) return '请附上一次观测。观测里要有 options。'
  const choice = ruleChoice(observation)
  if (!choice) return '观测里没有可选动作。'
  return JSON.stringify({ choice })
}

export function modelId(parameters) {
  const requested = parameters && typeof parameters === 'object' ? parameters.model : undefined
  return typeof requested === 'string' && MODEL_ID.test(requested) ? requested : DEFAULT_MODEL
}

/** `systemone` for the decision model, `chat` for any other model. */
export function modelApi(model) {
  return model === DECISION_MODEL ? 'systemone' : 'chat'
}

/** One System One choice question over the offered keys. The host attaches the credential. */
export function decisionRequest(observation, model) {
  const keys = optionKeys(observation.options)
  const offered = observation.options && !Array.isArray(observation.options) ? observation.options : {}
  const criteria = Object.fromEntries(keys.map((key) => [key, typeof offered[key] === 'string' ? offered[key] : null]))
  const instructions =
    typeof observation.decision?.instructions === 'string' && observation.decision.instructions
      ? observation.decision.instructions
      : DEFAULT_QUESTION
  const { options: _options, baseline_choice: _baseline, decision: _decision, ...rest } = observation
  const state = observation.state && typeof observation.state === 'object' ? observation.state : rest
  return { model, state, questions: { action: { type: 'choice', instructions, criteria } } }
}

/**
 * The decision model's answer when it chose an offered key and published a
 * distribution over exactly the offered keys; otherwise null.
 */
export function decisionFromReply(status, body, keys) {
  if (status !== 200 || !body || typeof body !== 'object') return null
  const answer = body.answers?.action
  if (!answer || answer.type !== 'choice' || typeof answer.choice !== 'string' || !keys.includes(answer.choice)) return null
  const probabilities = answer.probabilities
  if (!probabilities || typeof probabilities !== 'object' || Array.isArray(probabilities)) return null
  const names = Object.keys(probabilities)
  if (names.length !== keys.length || !keys.every((key) => names.includes(key))) return null
  const values = keys.map((key) => probabilities[key])
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)) return null
  if (Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) > 0.02) return null
  const confidence = Number.isFinite(answer.confidence) && answer.confidence >= 0 && answer.confidence <= 1 ? answer.confidence : null
  const model = typeof body.model === 'string' && MODEL_ID.test(body.model) ? body.model : null
  return { choice: answer.choice, probabilities: Object.fromEntries(keys.map((key) => [key, probabilities[key]])), confidence, model }
}

/** One non-streaming chat completion. The host attaches the credential. */
export function modelRequest(observation, model, instructions) {
  return {
    model,
    stream: false,
    temperature: 0,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: instructions },
      { role: 'user', content: JSON.stringify(observation) }
    ]
  }
}

/** The model's choice when its reply names exactly one offered key; otherwise null. */
export function choiceFromReply(status, body, keys) {
  if (status !== 200 || !body || typeof body !== 'object') return null
  const content = body.choices?.[0]?.message?.content
  if (typeof content !== 'string' || content.length === 0 || content.length > MAX_REPLY) return null
  const reply = replyObject(content)
  const choice = reply && typeof reply.choice === 'string' ? reply.choice : null
  return choice && keys.includes(choice) ? choice : null
}

/** A chat model that reads images. The decision model does not. */
export const VISION_MODEL = 'bailian/deepseek-v4.1-flash'
export const LIBERO_PROTOCOL = 'libero-rgbd-waypoint-v1'
export const LIBERO_VIEWS = ['external', 'wrist']
const IMAGE_NAME = /^[a-z][a-z0-9_-]{0,31}$/
const PLAN_FIELDS = ['stage', 'intent', 'visual_evidence', 'target', 'rotation_delta', 'gripper', 'max_motor_steps']
const PLAN_TEXT = 500

// EmbodiedJev libero_policy.py PLANNER_SYSTEM (MIT), unchanged.
export const LIBERO_PLANNER_SYSTEM = `You control a real simulated Franka Panda in LIBERO from calibrated
external and wrist RGB-D cameras. Use only the supplied images, language task and
robot proprioception. Images have a top-left origin, labelled pixel grid, and a
cyan cross at the projected TCP (not an object detection). There are no object
ground-truth poses, privileged success signals, scripted task stages or experts.
Plan ONE short stage, not the full task. The local controller follows your TCP
waypoint and gripper command. It cannot see images or decide what object to use.
Prefer target.kind=pixel: choose a visible surface pixel in an image; its real
depth and calibration back-project to world coordinates, then your offset_m is
added. The selected pixel may be an occluder: use the other camera if necessary.
Use an upward offset for approach clearance, align horizontally before descending,
then close, lift, transport, lower, release, and verify when the task requires it.
These are suggestions, not fixed stages. For drawer or door tasks, establish the
appropriate contact before applying motion. Gripper +1 closes, -1 opens.
Target.kind=relative moves by delta_m from the current TCP. Target.kind=world
may reuse a previously grounded waypoint. All XYZ are world metres. Do not infer
object coordinates from task names. rotation_delta is a WORLD axis-angle rotation
in radians relative to the current wrist; [0,0,0] retains its current orientation.
World Z is up. Decide rotations from the images, not a fixed task script.
The first six normalized OSC action channels map to +/-0.05 m and +/-0.5 rad per
environment step. A short action lasts 5 steps at 20 Hz; feedback follows it.
Task success is checked by the environment; do not declare success yourself.
Return only JSON with exactly these fields:
{"stage":"short stage label", "intent":"one short public action description",
 "visual_evidence":"one short visible observation",
 "target":{"kind":"pixel", "camera":"external", "pixel":[u,v], "offset_m":[dx,dy,dz]},
 "rotation_delta":[0,0,0], "gripper":"open", "max_motor_steps":6}
Alternative target schemas: {"kind":"relative","delta_m":[dx,dy,dz]} or
{"kind":"world","xyz_m":[x,y,z]}. camera is external or wrist; gripper is open,
close or hold. max_motor_steps is 1..8, each being one short action. Each relative
translation or pixel offset axis is limited to +/-0.20 m. Each rotation_delta
axis is limited to +/-0.5 rad. Re-observe after a waypoint, a stall or 8 actions.
`

/** The image names the host attached to this turn, or null when the manifest is malformed. */
export function turnImages(manifest) {
  if (manifest === undefined) return []
  if (!Array.isArray(manifest) || manifest.length > 2) return null
  const names = manifest.map((image) => image?.name)
  if (!names.every((name) => typeof name === 'string' && IMAGE_NAME.test(name)) || new Set(names).size !== names.length) return null
  return names
}

/** Images go to a chat model: the requested one when it can take them, else the vision model. */
export function visionModel(parameters) {
  const model = modelId(parameters)
  return model === DECISION_MODEL ? VISION_MODEL : model
}

/** A LIBERO planning turn's state, or null when the parameters carry none. */
export function liberoState(parameters) {
  const observation = parameters && typeof parameters === 'object' ? parameters.observation : null
  if (!observation || typeof observation !== 'object' || observation.protocol !== LIBERO_PROTOCOL) return null
  const state = observation.state
  return state && typeof state === 'object' && !Array.isArray(state) ? state : null
}

/**
 * Upstream's vision_plan request: the state as JSON text, then each camera
 * labelled as upstream labels it. Images are host references; the host puts
 * the bytes in. Hidden reasoning is off so the answer is not starved of tokens.
 */
export function liberoRequest(state, model, images) {
  const content = [{ type: 'text', text: JSON.stringify(state) }]
  for (const name of images) {
    content.push(
      { type: 'text', text: `Camera: ${name}; grid coordinates are original pixels.` },
      { type: 'image_url', image_url: { url: `aix-image:${name}` } }
    )
  }
  return {
    model,
    stream: false,
    temperature: 0,
    max_tokens: 2048,
    reasoning_effort: 'none',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: LIBERO_PLANNER_SYSTEM },
      { role: 'user', content }
    ]
  }
}

/**
 * The waypoint answer from one finished message with exactly the plan fields
 * and short public text; otherwise null. The view checks the numbers and
 * grounds the target against its own depth before anything moves.
 */
export function liberoPlanFromReply(status, body) {
  if (status !== 200 || !body || typeof body !== 'object') return null
  if (!Array.isArray(body.choices) || body.choices.length !== 1 || body.choices[0]?.finish_reason !== 'stop') return null
  const content = body.choices[0].message?.content
  if (typeof content !== 'string' || content.length === 0 || content.length > MAX_REPLY) return null
  const plan = replyObject(content)
  if (!plan) return null
  const keys = Object.keys(plan)
  if (keys.length !== PLAN_FIELDS.length || !PLAN_FIELDS.every((key) => keys.includes(key))) return null
  for (const key of ['stage', 'intent', 'visual_evidence']) {
    const text = plan[key]
    if (typeof text !== 'string' || text.length === 0 || text.length > PLAN_TEXT || text.includes('data:image/')) return null
  }
  if (!plan.target || typeof plan.target !== 'object' || Array.isArray(plan.target)) return null
  return plan
}

function replyObject(content) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  try {
    const value = JSON.parse(trimmed)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}
