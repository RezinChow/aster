// three.js view of the MuJoCo scene. Ported from EmbodiedJev robot-scene.js
// (MIT). G1 and Panda hand visual meshes come from the vendored pack and are
// drawn in their body frame; the task geometry is drawn from the MuJoCo geoms.
import * as THREE from './vendor/three/three.module.min.js'
import { OrbitControls } from './vendor/three/OrbitControls.js'
import { decodeMesh } from './meshes.js'
import { MESHES, VISUALS } from './vendor/g1/g1.js'

THREE.Object3D.DEFAULT_UP.set(0, 0, 1)

/** Decode the quantized visual meshes into three.js geometries, keyed by mesh name. */
export function g1Geometries(pack) {
  const geometries = new Map()
  for (const name of Object.keys(MESHES)) {
    const { positions, indices } = decodeMesh(pack, name)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
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

/**
 * data.primitives: MuJoCo geoms drawn as boxes, spheres or cylinders.
 * data.bodies: body name to id. data.geometries: decoded visual meshes (shared, not disposed here).
 * Fills `parent` and maps `g<geom>` / `b<body>` keys to the posed objects.
 */
function buildRobot(parent, objects, data) {
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
    const mesh = new THREE.Mesh(data.geometries.get(visual.mesh), material(visual.rgba, 0.56, true))
    if (visual.pos) mesh.position.set(...visual.pos)
    // MuJoCo quaternions are w, x, y, z.
    if (visual.quat) mesh.quaternion.set(visual.quat[1], visual.quat[2], visual.quat[3], visual.quat[0])
    mesh.castShadow = mesh.receiveShadow = true
    group.add(mesh)
  }
}

function clearRobot(parent, objects) {
  parent.traverse((object) => object.material?.dispose())
  for (const child of [...parent.children]) {
    if (child.isMesh) child.geometry.dispose()
    parent.remove(child)
  }
  objects.clear()
}

function poseRobot(objects, frame) {
  for (const [key, object] of objects) {
    const pose = key[0] === 'b' ? frame.bodies?.[Number(key.slice(1))] : frame.geoms?.[Number(key.slice(1))]
    if (pose) place(object, pose)
  }
}

function addLights(scene, shadowSize) {
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0xa6b9ad, 1.3)
  hemisphere.position.set(0, 0, 3)
  scene.add(hemisphere)
  const light = new THREE.DirectionalLight(0xffffff, 2.2)
  light.position.set(-0.8, -1.1, 2.5)
  light.castShadow = true
  light.shadow.mapSize.set(shadowSize, shadowSize)
  Object.assign(light.shadow.camera, { left: -1.2, right: 1.2, top: 1.2, bottom: -1.2 })
  light.shadow.normalBias = 0.001
  light.shadow.bias = -0.0001
  scene.add(light)
  const fill = new THREE.DirectionalLight(0xdce9ff, 0.6)
  fill.position.set(1, 1, 1.4)
  scene.add(fill)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0xeef2f1, roughness: 0.93 }))
  floor.position.z = -0.075
  floor.receiveShadow = true
  scene.add(floor)
}

const DEPTH_VERTEX = `varying float vDepth;
void main() {
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vDepth = -view.z;
  gl_Position = projectionMatrix * view;
}`
const DEPTH_FRAGMENT = `varying float vDepth;
void main() { gl_FragColor = vec4(vDepth, 0.0, 0.0, 1.0); }`

/**
 * Calibrated RGB-D cameras on the viewport's WebGL context. The rig keeps its
 * own copy of the scene, so a capture never depends on the user's orbit camera
 * or on the replay frame the viewport shows. Depth is axial, in metres; 0 means
 * no surface.
 */
export class SensorRig {
  constructor(renderer, { width, height }) {
    this.renderer = renderer
    this.width = width
    this.height = height
    this.scene = new THREE.Scene()
    this.background = new THREE.Color('#eef2f1')
    this.robot = new THREE.Group()
    this.objects = new Map()
    this.scene.add(this.robot)
    addLights(this.scene, 1024)
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 5)
    this.color = new THREE.WebGLRenderTarget(width, height, { type: THREE.UnsignedByteType, samples: 4 })
    this.color.texture.colorSpace = THREE.SRGBColorSpace
    this.depth = new THREE.WebGLRenderTarget(width, height, { type: THREE.FloatType, format: THREE.RGBAFormat })
    this.depthMaterial = new THREE.ShaderMaterial({ vertexShader: DEPTH_VERTEX, fragmentShader: DEPTH_FRAGMENT, side: THREE.DoubleSide })
    this.rgba = new Uint8Array(width * height * 4)
    this.floats = new Float32Array(width * height * 4)
  }

  get supported() {
    return this.renderer.capabilities.isWebGL2 && this.renderer.extensions.has('EXT_color_buffer_float')
  }

  load(data) {
    clearRobot(this.robot, this.objects)
    buildRobot(this.robot, this.objects, data)
  }

  /** One frame per calibration: { rgb (top-left RGB8), depth (top-left metres), calibration }. */
  capture(frame, calibrations) {
    if (!this.supported) throw new Error('当前浏览器不支持浮点渲染目标，无法生成深度图')
    poseRobot(this.objects, frame)
    const { renderer, scene, camera, width, height } = this
    const previous = renderer.getRenderTarget()
    const clear = renderer.getClearColor(new THREE.Color())
    const alpha = renderer.getClearAlpha()
    const out = {}
    try {
      for (const [view, c] of Object.entries(calibrations)) {
        camera.fov = c.fovy
        camera.aspect = width / height
        camera.position.set(...c.position)
        camera.up.set(...c.up)
        camera.lookAt(c.position[0] + c.forward[0], c.position[1] + c.forward[1], c.position[2] + c.forward[2])
        camera.updateProjectionMatrix()
        camera.updateMatrixWorld()
        scene.background = this.background
        scene.overrideMaterial = null
        renderer.setRenderTarget(this.color)
        renderer.render(scene, camera)
        renderer.readRenderTargetPixels(this.color, 0, 0, width, height, this.rgba)
        scene.background = null
        scene.overrideMaterial = this.depthMaterial
        renderer.setClearColor(0x000000, 0)
        renderer.setRenderTarget(this.depth)
        renderer.clear()
        renderer.render(scene, camera)
        renderer.readRenderTargetPixels(this.depth, 0, 0, width, height, this.floats)
        renderer.setClearColor(clear, alpha)
        const rgb = new Uint8Array(width * height * 3)
        const depth = new Float32Array(width * height)
        // GL rows start at the bottom; image rows start at the top.
        for (let row = 0; row < height; row += 1) {
          const source = (height - 1 - row) * width
          const target = row * width
          for (let column = 0; column < width; column += 1) {
            const s = source + column
            const t = target + column
            rgb[t * 3] = this.rgba[s * 4]
            rgb[t * 3 + 1] = this.rgba[s * 4 + 1]
            rgb[t * 3 + 2] = this.rgba[s * 4 + 2]
            depth[t] = this.floats[s * 4]
          }
        }
        out[view] = { rgb, depth, calibration: c }
      }
    } finally {
      scene.overrideMaterial = null
      scene.background = this.background
      renderer.setClearColor(clear, alpha)
      renderer.setRenderTarget(previous)
    }
    return out
  }

  dispose() {
    clearRobot(this.robot, this.objects)
    this.scene.traverse((object) => {
      object.geometry?.dispose()
      object.material?.dispose()
      object.shadow?.map?.dispose()
    })
    this.color.dispose()
    this.depth.dispose()
    this.depthMaterial.dispose()
  }
}

/** An RGB8 image as a data URL (`image/jpeg` or `image/png`). */
export function imageURL({ rgb, calibration: { width, height } }, type = 'image/jpeg', quality = 0.85) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  const image = context.createImageData(width, height)
  for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
    image.data[j] = rgb[i]
    image.data[j + 1] = rgb[i + 1]
    image.data[j + 2] = rgb[i + 2]
    image.data[j + 3] = 255
  }
  context.putImageData(image, 0, 0)
  return canvas.toDataURL(type, quality)
}

export class RobotScene {
  constructor(container, { label = 'MuJoCo G1 机器人三维场景', pixelRatio = 2, onError = () => {} } = {}) {
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
    addLights(this.scene, pixelRatio < 2 ? 512 : 1024)
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
    clearRobot(this.robot, this.objects)
  }

  load(data) {
    this.clearRobot()
    this.lastFrame = null
    this.data = data
    buildRobot(this.robot, this.objects, data)
    this.sensors?.load(data)
    this.requestRender()
  }

  /** The RGB-D camera rig on this renderer, created on first use with the loaded scene. */
  sensorRig(size) {
    if (!this.sensors) {
      this.sensors = new SensorRig(this.renderer, size)
      if (this.data) this.sensors.load(this.data)
    }
    return this.sensors
  }

  render(frame) {
    if (!frame || (this.lastFrame?.time === frame.time && this.lastFrame.qpos === frame.qpos)) return
    this.lastFrame = frame
    poseRobot(this.objects, frame)
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
        performance.mark('g1:drawn')
      }
    })
  }

  dispose() {
    this.disposed = true
    this.observer.disconnect()
    this.controls.dispose()
    this.sensors?.dispose()
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
