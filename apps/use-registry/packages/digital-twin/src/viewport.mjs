import { OrbitControls } from '../../g1-arm/ui/workbench/vendor/three/OrbitControls.js'
import * as THREE from '../../g1-arm/ui/workbench/vendor/three/three.module.min.js'
import { TransformControls } from './vendor/TransformControls.js'

export class TwinViewport {
  constructor(element, { onSelect, onTransform, onError }) {
    this.element = element
    this.onSelect = onSelect
    this.onTransform = onTransform
    this.onError = onError
    this.objects = new Map()
    this.abort = new AbortController()
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#f5f5f5')
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000)
    this.camera.up.set(0, 0, 1)
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    element.append(this.renderer.domElement)
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement)
    this.orbit.addEventListener('change', () => this.render())
    this.orbit.listenToKeyEvents(element)
    this.transform = new TransformControls(this.camera, this.renderer.domElement)
    this.scene.add(this.transform.getHelper())
    this.transform.addEventListener('dragging-changed', ({ value }) => {
      this.orbit.enabled = !value
    })
    this.transform.addEventListener('mouseDown', () => {
      this.cancelledDrag = false
      this.reviewedRevision = this.revision
      const object = this.transform.object
      this.startTransform = JSON.stringify([
        object.position.toArray(),
        object.quaternion.toArray(),
        object.scale.toArray()
      ])
    })
    this.transform.addEventListener('objectChange', () => this.render())
    this.transform.addEventListener('mouseUp', () => {
      const object = this.transform.object
      if (this.cancelledDrag || !object) return
      if (
        this.startTransform ===
        JSON.stringify([object.position.toArray(), object.quaternion.toArray(), object.scale.toArray()])
      )
        return
      const revision = this.reviewedRevision
      this.reviewedRevision = null
      this.onTransform(
        object.userData.entityId,
        {
          position: object.position.toArray(),
          rotation: object.quaternion.toArray(),
          scale: object.scale.toArray()
        },
        revision
      )
    })
    this.transform.addEventListener('change', () => this.render())
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 2))
    const light = new THREE.DirectionalLight(0xffffff, 3)
    light.position.set(4, -6, 10)
    this.scene.add(light)
    const grid = new THREE.GridHelper(40, 80, 0x8a8a8a, 0xe6e6e6)
    grid.rotateX(Math.PI / 2)
    this.scene.add(grid)
    this.grid = grid
    this.outline = new THREE.BoxHelper(undefined, 0x171717)
    this.outline.visible = false
    this.scene.add(this.outline)
    const signal = this.abort.signal
    this.renderer.domElement.addEventListener(
      'pointerdown',
      (event) => {
        this.pointerStart = [event.clientX, event.clientY]
        this.gizmoHit = this.transform.axis !== null
      },
      { signal }
    )
    this.renderer.domElement.addEventListener(
      'pointerup',
      (event) => {
        if (
          !this.pointerStart ||
          this.gizmoHit ||
          event.button !== 0 ||
          Math.hypot(event.clientX - this.pointerStart[0], event.clientY - this.pointerStart[1]) > 3
        )
          return
        const bounds = this.renderer.domElement.getBoundingClientRect()
        const point = new THREE.Vector2(
          (2 * (event.clientX - bounds.left)) / bounds.width - 1,
          1 - (2 * (event.clientY - bounds.top)) / bounds.height
        )
        const ray = new THREE.Raycaster()
        ray.setFromCamera(point, this.camera)
        const hit = ray.intersectObjects([...this.objects.values()], true).find((item) => item.object.userData.entityId)
        this.onSelect(hit?.object.userData.entityId ?? null)
        element.focus({ preventScroll: true })
      },
      { signal }
    )
    element.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape' && this.transform.dragging) {
          event.preventDefault()
          this.cancelledDrag = true
          this.transform.reset()
          this.render()
        }
      },
      { signal }
    )
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault()
        this.onError('render_unavailable')
      },
      { signal }
    )
    this.resize = new ResizeObserver(() => {
      if (!element.clientWidth || !element.clientHeight) return
      this.renderer.setSize(element.clientWidth, element.clientHeight)
      this.camera.aspect = element.clientWidth / element.clientHeight
      this.camera.updateProjectionMatrix()
      this.render()
    })
    this.resize.observe(element)
    this.home()
  }

  update(scene) {
    if (this.transform.dragging && this.reviewedRevision !== null && this.revision !== scene.revision) {
      this.cancelledDrag = true
      this.transform.reset()
      this.transform.dragging = false
      this.transform.detach()
      this.onError('stale_transform')
    }
    this.revision = scene.revision
    for (const [id, object] of this.objects) {
      if (Object.hasOwn(scene.entities, id)) continue
      object.removeFromParent()
      this.disposeObject(object)
      this.objects.delete(id)
    }
    for (const [id, entity] of Object.entries(scene.entities)) {
      const shape = JSON.stringify(entity.body?.collider ?? null)
      let object = this.objects.get(id)
      if (!object || object.userData.shape !== shape) {
        if (object) {
          object.removeFromParent()
          this.disposeObject(object)
        }
        const collider = entity.body?.collider
        const geometry =
          collider?.kind === 'sphere'
            ? new THREE.SphereGeometry(collider.radius, 32, 16)
            : new THREE.BoxGeometry(
                ...(collider?.kind === 'box' ? collider.halfExtents.map((value) => value * 2) : [0.2, 0.2, 0.2])
              )
        object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xd4d4d4, roughness: 0.65 }))
        object.userData = { entityId: id, shape }
        this.objects.set(id, object)
      }
      object.position.fromArray(entity.transform.position)
      object.quaternion.fromArray(entity.transform.rotation)
      object.scale.fromArray(entity.transform.scale)
    }
    for (const [id, entity] of Object.entries(scene.entities)) {
      const object = this.objects.get(id)
      const parent = entity.parent ? this.objects.get(entity.parent) : this.scene
      if (object.parent !== parent) parent.add(object)
    }
    this.select(this.selected)
    this.render()
  }

  select(id) {
    this.selected = id
    const object = this.objects.get(id)
    if (object) {
      this.transform.attach(object)
      this.outline.setFromObject(object)
    } else this.transform.detach()
    this.outline.visible = !!object
    this.render()
  }

  mode(mode) {
    this.transform.setMode(mode)
    this.render()
  }
  space(space) {
    this.transform.setSpace(space)
    this.render()
  }

  home() {
    this.camera.position.set(6, -8, 5)
    this.orbit.target.set(0, 0, 0.5)
    this.orbit.update()
    this.render()
  }

  focus() {
    const object = this.objects.get(this.selected)
    if (!object) return
    const sphere = new THREE.Box3().setFromObject(object).getBoundingSphere(new THREE.Sphere())
    this.orbit.target.copy(sphere.center)
    this.camera.position
      .copy(sphere.center)
      .add(new THREE.Vector3(1, -1.5, 1).normalize().multiplyScalar(Math.max(2, sphere.radius * 4)))
    this.orbit.update()
    this.render()
  }

  render() {
    if (this.disposed) return
    const selected = this.objects.get(this.selected)
    if (selected) this.outline.setFromObject(selected)
    this.renderer.render(this.scene, this.camera)
    if (!this.drawn) {
      this.drawn = true
      performance.mark('digital-twin:first-frame')
    }
  }

  disposeObject(object) {
    object.geometry?.dispose()
    for (const material of [object.material].flat().filter(Boolean)) material.dispose()
  }

  dispose() {
    this.disposed = true
    this.abort.abort()
    this.resize.disconnect()
    this.orbit.dispose()
    this.transform.dispose()
    this.scene.traverse((object) => this.disposeObject(object))
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
