import { initSync, create_scene, decode_scene, apply_scene_patch } from '../.build/domain/scene.js'
import { bytes } from '../.build/domain/bytes.mjs'

initSync({ module: bytes })

export const createScene = (id) => JSON.parse(create_scene(id))
export const decodeScene = (content) => JSON.parse(decode_scene(content))
export const applyPatch = (content, patch) => JSON.parse(apply_scene_patch(content, JSON.stringify(patch)))
