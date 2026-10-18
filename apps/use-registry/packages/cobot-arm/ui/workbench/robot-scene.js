// three.js view of the MuJoCo scene. Ported from EmbodiedJev robot-scene.js
// (MIT). Panda visual meshes come from the vendored pack and are drawn in
// their body frame; the task geometry is drawn from the MuJoCo geoms.
import * as THREE from './vendor/three/three.module.min.js'
import { OrbitControls } from './vendor/three/OrbitControls.js'
import { MESHES, VISUALS } from './vendor/panda/panda.js'

THREE.Object3D.DEFAULT_UP.set(0, 0, 1)

/** Decode the quantized Panda visual meshes into three.js geometries, keyed by mesh name. */
export function pandaGeometries(pack) {
  const geometries = new Map()
  for (const [name, mesh] of Object.entries(MESHES)) {
    const quantized = new Uint16Array(pack.buffer, pack.byteOffset + mesh.positions, mesh.vertices * 3)
    const positions = new Float32Array(mesh.vertices * 3)
    for (let i = 0; i < positions.length; i += 1) {
      const axis = i % 3
      positions[i] = mesh.min[axis] + quantized[i] * mesh.step[axis]
    }
    const Indices = mesh.wide ? Uint32Array : Uint16Array
    const indices = new Indices(pack.buffer, pack.byteOffset + mesh.faces, mesh.indices)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setIndex(new THREE.BufferAttribute(new Indices(indices), 1))
    // Flat shading ignores these, but the shadow pass offsets by the vertex normal.
    geometry.computeVertexNormals()
    geometries.set(name, geometry)
  }
  return geometries
}

const matrix = new THREE.Matrix4()

function place(object, pose) {
  object.position.set(pose[0], pose[1], pose[2])
  matrix.set(pose[3], pose[4], pose[5], 0, pose[6], pose[7], pose[8], 0, pose[9], pose[10], pose[11], 0, 0, 0, 0, 1)
  object.quaternion.setFromRotationMatrix(matrix)
}

function material([red, green, blue, alpha], roughness, flat) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(red, green, blue).convertSRGBToLinear(),
    roughness,
    metalness: 0.08,
    transparent: alpha < 1,
    opacity: alpha,
    flatShading: flat
  })
}

export class RobotScene {
  constructor(container, { label = 'MuJoCo 机械臂三维场景', pixelRatio = 2, onError = () => {} } = {}) {
    this.container = container
    this.objects = new Map()
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#eef2f1')
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.01, 20)
    this.camera.up.set(0, 0, 1)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, pixelRatio))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1
    this.renderer.domElement.setAttribute('aria-label', label)
    container.prepend(this.renderer.domElement)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 0.65
    this.controls.maxDistance = 3.2
    this.controls.maxPolarAngle = Math.PI * 0.49
    const hemisphere = new THREE.HemisphereLight(0xffffff, 0xa6b9ad, 1.3)
    hemisphere.position.set(0, 0, 3)
    this.scene.add(hemisphere)
    const light = new THREE.DirectionalLight(0xffffff, 2.2)
    light.position.set(-0.8, -1.1, 2.5)
    light.castShadow = true
    light.shadow.mapSize.set(pixelRatio < 2 ? 512 : 1024, pixelRatio < 2 ? 512 : 1024)
    Object.assign(light.shadow.camera, { left: -1.2, right: 1.2, top: 1.2, bottom: -1.2 })
    light.shadow.normalBias = 0.001
    light.shadow.bias = -0.0001
    this.scene.add(light)
    const fill = new THREE.DirectionalLight(0xdce9ff, 0.6)
    fill.position.set(1, 1, 1.4)
    this.scene.add(fill)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0xeef2f1, roughness: 0.93 })
    )
    floor.position.z = -0.075
    floor.receiveShadow = true
    this.scene.add(floor)
    this.robot = new THREE.Group()
    this.scene.add(this.robot)
    this.controls.addEventListener('change', () => this.requestRender())
    this.renderer.domElement.addEventListener('webglcontextlost', () => {
      if (!this.disposed) onError('三维渲染上下文已丢失，请刷新页面')
    })
    this.observer = new ResizeObserver(() => {
      if (!container.clientWidth || !container.clientHeight) return
      this.renderer.setSize(container.clientWidth, container.clientHeight, false)
      this.camera.aspect = container.clientWidth / container.clientHeight
      this.camera.updateProjectionMatrix()
      this.requestRender()
    })
    this.observer.observe(container)
    this.cameraHome()
  }

  cameraHome() {
    this.camera.position.set(1.4, -1.65, 1.27)
    this.controls.target.set(0.32, 0, 0.24)
    this.controls.update()
    this.requestRender()
  }

  cameraTop() {
    this.camera.position.set(0.42, -0.001, 1.85)
    this.controls.target.set(0.4, 0, 0.05)
    this.controls.update()
    this.requestRender()
  }

  clearRobot() {
    this.robot.traverse((object) => object.material?.dispose())
    for (const child of [...this.robot.children]) {
      if (child.isMesh) child.geometry.dispose()
      this.robot.remove(child)
    }
    this.objects.clear()
  }

  /**
   * data.primitives: MuJoCo geoms drawn as boxes, spheres or cylinders.
   * data.bodies: body name to id. data.geometries: decoded Panda meshes (shared, not disposed here).
   */
  load(data) {
    this.clearRobot()
    this.lastFrame = null
    for (const item of data.primitives) {
      let geometry
      if (item.type === 6) geometry = new THREE.BoxGeometry(...item.size.map((size) => size * 2))
      else if (item.type === 2) geometry = new THREE.SphereGeometry(item.size[0], 24, 16)
      else if (item.type === 5) {
        geometry = new THREE.CylinderGeometry(item.size[0], item.size[0], item.size[1] * 2, 32)
        geometry.rotateX(Math.PI / 2)
      } else continue
      const mesh = new THREE.Mesh(geometry, material(item.color, item.name === 'cube_geom' ? 0.35 : 0.56, false))
      mesh.castShadow = mesh.receiveShadow = true
      this.robot.add(mesh)
      this.objects.set(`g${item.id}`, mesh)
    }
    const groups = new Map()
    for (const visual of VISUALS) {
      const id = data.bodies[visual.body]
      if (!(id >= 0)) continue
      let group = groups.get(id)
      if (!group) {
        group = new THREE.Group()
        groups.set(id, group)
        this.robot.add(group)
        this.objects.set(`b${id}`, group)
      }
      const mesh = new THREE.Mesh(data.geometries.get(visual.mesh), material(visual.rgba, 0.56, true))
      mesh.castShadow = mesh.receiveShadow = true
      group.add(mesh)
    }
    this.requestRender()
  }

  render(frame) {
    if (!frame || (this.lastFrame?.time === frame.time && this.lastFrame.qpos === frame.qpos)) return
    this.lastFrame = frame
    for (const [key, object] of this.objects) {
      const pose = key[0] === 'b' ? frame.bodies?.[Number(key.slice(1))] : frame.geoms?.[Number(key.slice(1))]
      if (pose) place(object, pose)
    }
    this.requestRender()
  }

  requestRender() {
    // Until the robot loads, the canvas sits under the loading overlay; a frame
    // then would only compile shaders on the main thread while MuJoCo starts.
    if (this.renderRequested || this.disposed || !this.objects.size) return
    this.renderRequested = true
    requestAnimationFrame(() => {
      this.renderRequested = false
      if (this.disposed || !this.container.clientWidth || !this.container.clientHeight) return
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
      if (!this.drawn) {
        this.drawn = true
        performance.mark('cobot:drawn')
      }
    })
  }

  dispose() {
    this.disposed = true
    this.observer.disconnect()
    this.controls.dispose()
    this.clearRobot()
    this.scene.traverse((object) => {
      object.geometry?.dispose()
      object.material?.dispose()
      object.shadow?.map?.dispose()
    })
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }
}
