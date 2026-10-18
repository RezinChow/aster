// Load MuJoCo from bytes this package carries. Nothing is fetched.
import load from './vendor/mujoco/mujoco.js'
import packed from './vendor/mujoco/wasm.js'

function decode(base64) {
  if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(base64)
  const text = atob(base64)
  const bytes = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index++) bytes[index] = text.charCodeAt(index)
  return bytes
}

/** The bytes of a gzip payload this package carries as base64. */
export async function inflate(base64) {
  const stream = new Blob([decode(base64)]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export function wasmBinary() {
  return inflate(packed)
}

export async function loadMujoco() {
  return load({ wasmBinary: await wasmBinary() })
}
