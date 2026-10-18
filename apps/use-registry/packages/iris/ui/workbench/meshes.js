// The vendored Iris pack, decoded once per page.
import { inflate } from './engine.js'
import { MESHES, PACK } from './vendor/iris/iris.js'

let packBytes = null
const decoded = new Map()

export function irisPack() {
  packBytes ??= inflate(PACK)
  return packBytes
}

/** Positions (metres, mesh frame) and triangle indices of one packed mesh. */
export function decodeMesh(pack, name) {
  let mesh = decoded.get(name)
  if (mesh) return mesh
  const entry = MESHES[name]
  if (!entry) throw new Error(`pack has no mesh ${name}`)
  const quantized = new Uint16Array(pack.buffer, pack.byteOffset + entry.positions, entry.vertices * 3)
  const positions = new Float32Array(entry.vertices * 3)
  for (let i = 0; i < positions.length; i += 1) {
    const axis = i % 3
    positions[i] = entry.min[axis] + quantized[i] * entry.step[axis]
  }
  const Indices = entry.wide ? Uint32Array : Uint16Array
  const indices = new Indices(new Indices(pack.buffer, pack.byteOffset + entry.faces, entry.indices))
  mesh = { positions, indices }
  decoded.set(name, mesh)
  return mesh
}
