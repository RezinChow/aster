import { applyPatch, createScene, decodeScene } from './domain.mjs'

/** Local previews commit through the Rust domain; failed edits never advance history. */
export class SceneModel extends EventTarget {
  constructor(id = crypto.randomUUID()) {
    super()
    this.document = createScene(id)
    this.past = []
    this.future = []
    this.savedContent = this.document.content
    this.version = 0
  }

  get scene() {
    return this.document.scene
  }
  get dirty() {
    return this.document.content !== this.savedContent
  }

  load(content) {
    const document = decodeScene(content)
    this.document = document
    this.savedContent = document.content
    this.past = []
    this.future = []
    this.changed()
  }

  restore(content, savedContent) {
    const document = decodeScene(content)
    const saved = decodeScene(savedContent)
    this.document = document
    this.savedContent = saved.content
    this.past = []
    this.future = []
    this.changed()
  }

  reset() {
    this.load(createScene(crypto.randomUUID()).content)
  }

  edit(edits, expectedRevision = this.scene.revision) {
    const outcome = this.apply(edits, expectedRevision)
    this.past.push({ edits, inverse: outcome.inverse })
    if (this.past.length > 64) this.past.shift()
    this.future = []
    this.changed()
  }

  apply(edits, expectedRevision = this.scene.revision) {
    const next = applyPatch(this.document.content, {
      operationId: crypto.randomUUID(),
      expectedRevision,
      edits
    })
    this.document = next
    return next
  }

  undo() {
    const action = this.past.at(-1)
    if (!action) return
    const outcome = this.apply(action.inverse)
    this.past.pop()
    this.future.push({ edits: outcome.inverse, inverse: action.inverse })
    this.changed()
  }

  redo() {
    const action = this.future.at(-1)
    if (!action) return
    const outcome = this.apply(action.edits)
    this.future.pop()
    this.past.push({ edits: action.edits, inverse: outcome.inverse })
    this.changed()
  }

  saved(content) {
    this.savedContent = content
    this.changed()
  }

  changed() {
    this.version += 1
    this.dispatchEvent(new Event('change'))
  }
}

export function primitiveEntity(name, kind = 'box') {
  return {
    name,
    parent: null,
    transform: { position: [0, 0, 0.5], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
    visual: null,
    joint: null,
    sensor: null,
    bindings: [],
    body: {
      motion: 'static',
      mass: 0,
      friction: 0.8,
      collider: kind === 'sphere' ? { kind, radius: 0.5 } : { kind, halfExtents: [0.5, 0.5, 0.5] }
    }
  }
}
