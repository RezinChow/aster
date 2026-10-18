import assert from 'node:assert/strict'
import test from 'node:test'

import * as THREE from '../../g1-arm/ui/workbench/vendor/three/three.module.min.js'
import { primitiveEntity, SceneModel } from '../src/scene-model.mjs'
import { TwinViewport } from '../src/viewport.mjs'

test('removing valid prototype-named IDs removes their rendered objects', () => {
  const model = new SceneModel('scene-1')
  const ids = ['constructor', '__proto__', 'toString']
  model.edit(ids.map((id) => ({ kind: 'add', id, entity: primitiveEntity(id) })))
  const viewport = Object.create(TwinViewport.prototype)
  Object.assign(viewport, {
    transform: { dragging: false }, objects: new Map(), scene: new THREE.Scene(), select() {}, render() {}
  })
  viewport.update(model.scene)
  assert.equal(viewport.scene.children.length, 3)
  model.edit(ids.map((id) => ({ kind: 'remove', id })))
  viewport.update(model.scene)
  assert.equal(viewport.scene.children.length, 0)
  assert.equal(viewport.objects.size, 0)
})
