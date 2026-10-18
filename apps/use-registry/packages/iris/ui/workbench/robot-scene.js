// three.js view of the Iris scene. The airframe and rotors come from the
// vendored PX4 meshes; the pad, markers, payload, and tower are MuJoCo geoms.
import * as THREE from './vendor/three/three.module.min.js'
import { OrbitControls } from './vendor/three/OrbitControls.js'
import { decodeMesh } from './meshes.js'
import { MESHES, VISUALS } from './vendor/iris/iris.js'

THREE.Object3D.DEFAULT_UP.set(0, 0, 1)

export function irisGeometries(pack) {
  const geometries = new Map()
  for (const name of Object.keys(MESHES)) {
    const { positions, indices } = decodeMesh(pack, name)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
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

function material([red, green, blue, alpha], roughness) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(red, green, blue).convertSRGBToLinear(),
    roughness,
    metalness: 0.12,
    transparent: alpha < 1,
    opacity: alpha
  })
}

function buildRobot(parent, objects, data) {
  for (const item of data.primitives) {
    let geometry
    if (item.type === 6) geometry = new THREE.BoxGeometry(...item.size.map((size) => size * 2))
    else if (item.type === 2) geometry = new THREE.SphereGeometry(item.size[0], 24, 16)
    else if (item.type === 5) {
      geometry = new THREE.CylinderGeometry(item.size[0], item.size[0], item.size[1] * 2, 40)
      geometry.rotateX(Math.PI / 2)
    } else continue
    const mesh = new THREE.Mesh(geometry, material(item.color, 0.6))
    mesh.castShadow = mesh.receiveShadow = true
    parent.add(mesh)
    objects.set(`g${item.id}`, mesh)
  }
  const groups = new Map()
  for (const visual of VISUALS) {
    const id = data.bodies[visual.body]
    if (!(id >= 0)) continue
    let group = groups.get(id)
    if (!group) {
      group = new THREE.Group()
      groups.set(id, group)
      parent.add(group)
      objects.set(`b${id}`, group)
    }
    const geometry = data.geometries?.get(visual.mesh)
    if (!geometry) throw new Error(`缺少网格 ${visual.mesh}`)
    const mesh = new THREE.Mesh(geometry, material(visual.rgba, 0.45))
    mesh.castShadow = mesh.receiveShadow = true
    group.add(mesh)
  }
}

function poseRobot(objects, frame) {
  for (const [key, object] of objects) {
    const pose = key[0] === 'b' ? frame.bodies?.[Number(key.slice(1))] : frame.geoms?.[Number(key.slice(1))]
    if (pose) place(object, pose)
  }
}

export class RobotScene {
  constructor(container, { onError = () => {} } = {}) {
    this.container = container
    this.objects = new Map()
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#d7e4ef')
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 80)
    this.camera.up.set(0, 0, 1)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.domElement.setAttribute('aria-label', 'MuJoCo iris 四旋翼三维场景')
    container.prepend(this.renderer.domElement)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 1.2
    this.controls.maxDistance = 14
    this.controls.maxPolarAngle = Math.PI * 0.49
    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x9eb0be, 1.15)
    hemisphere.position.set(0, 0, 8)
    this.scene.add(hemisphere)
    const sun = new THREE.DirectionalLight(0xffffff, 2.1)
    sun.position.set(4, -6, 8)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 24 })
    this.scene.add(sun)
    const fill = new THREE.DirectionalLight(0xd6e6f5, 0.55)
    fill.position.set(-4, 3, 4)
    this.scene.add(fill)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.MeshStandardMaterial({ color: 0xc5ced6, roughness: 0.92 }))
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
    this.camera.position.set(3.4, -3.6, 2.4)
    this.controls.target.set(0.5, 0.4, 0.6)
    this.controls.update()
    this.requestRender()
  }

  cameraTop() {
    this.camera.position.set(0.5, 0.4, 7.5)
    this.controls.target.set(0.5, 0.4, 0)
    this.controls.update()
    this.requestRender()
  }

  load(data) {
    this.robot.traverse((object) => object.material?.dispose())
    for (const child of [...this.robot.children]) {
      if (child.isMesh) child.geometry.dispose()
      this.robot.remove(child)
    }
    this.objects.clear()
    this.lastFrame = null
    buildRobot(this.robot, this.objects, data)
    this.requestRender()
  }

  render(frame) {
    if (!frame || (this.lastFrame?.time === frame.time && this.lastFrame.qpos === frame.qpos)) return
    this.lastFrame = frame
    poseRobot(this.objects, frame)
    this.requestRender()
  }

  requestRender() {
    if (this.renderRequested || this.disposed || !this.objects.size) return
    this.renderRequested = true
    requestAnimationFrame(() => {
      this.renderRequested = false
      if (this.disposed || !this.container.clientWidth || !this.container.clientHeight) return
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
      if (!this.drawn) {
        this.drawn = true
        performance.mark('iris:drawn')
      }
    })
  }

  dispose() {
    this.disposed = true
    this.observer.disconnect()
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }
}
