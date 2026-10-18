// three.js rendering of an exported LIBERO scene: every geom robosuite's
// offscreen cameras draw, in the colour and finish MuJoCo's scene resolved,
// lit like MuJoCo's fixed pipeline without colour management, so the agentview
// and eye-in-hand RGB-D frames sit close to robosuite's. Depth is axial
// metres, as get_real_depth_map.
import * as THREE from './vendor/three/three.module.min.js'
import { OrbitControls } from './vendor/three/OrbitControls.js'
import { inflate } from './engine.js'
import { calibration, project, IMAGE_SIZE, VIEWS } from './libero-plan.js'

THREE.Object3D.DEFAULT_UP.set(0, 0, 1)

const LINEAR = THREE.LinearSRGBColorSpace
const TYPES = { uint16: Uint16Array, uint32: Uint32Array, int8: Int8Array, bytes: Uint8Array }
const GEOM = { PLANE: 0, SPHERE: 2, CAPSULE: 3, ELLIPSOID: 4, CYLINDER: 5, BOX: 6, MESH: 7 }

function slice(bytes, ref) {
  const Type = TYPES[ref.dtype] ?? Uint8Array
  return new Type(bytes.buffer.slice(bytes.byteOffset + ref.offset, bytes.byteOffset + ref.offset + ref.bytes))
}

function dequantize(bytes, [ref, low, span], size) {
  const q = slice(bytes, ref)
  const out = new Float32Array(q.length)
  for (let i = 0; i < q.length; i += 1) out[i] = low[i % size] + (q[i] / 65535) * span[i % size]
  return out
}

function meshGeometry(bytes, entry) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(dequantize(bytes, entry.position, 3), 3))
  const normals = slice(bytes, entry.normal)
  geometry.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(normals, (value) => value / 127), 3))
  if (entry.uv) geometry.setAttribute('uv', new THREE.BufferAttribute(dequantize(bytes, entry.uv, 2), 2))
  geometry.setIndex(new THREE.BufferAttribute(slice(bytes, entry.index), 1))
  return geometry
}

/** A box with per-face texture coordinates in MuJoCo's units: per metre when uniform, else per face. */
function boxGeometry(size, material) {
  const geometry = new THREE.BoxGeometry(size[0] * 2, size[1] * 2, size[2] * 2)
  if (!material) return geometry
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const uv = geometry.getAttribute('uv')
  const [rx, ry] = material.texrepeat
  for (let i = 0; i < position.count; i += 1) {
    const n = [normal.getX(i), normal.getY(i), normal.getZ(i)].map(Math.abs)
    const axis = n.indexOf(Math.max(...n))
    const [a, b] = [0, 1, 2].filter((k) => k !== axis)
    const p = [position.getX(i), position.getY(i), position.getZ(i)]
    const scaleA = material.texuniform ? rx : rx / (2 * size[a])
    const scaleB = material.texuniform ? ry : ry / (2 * size[b])
    uv.setXY(i, p[a] * scaleA, p[b] * scaleB)
  }
  return geometry
}

function primitiveGeometry(item, material) {
  const [a, b, c] = item.size
  switch (item.type) {
    case GEOM.PLANE: {
      const width = a > 0 ? a * 2 : 20
      const height = b > 0 ? b * 2 : 20
      const geometry = new THREE.PlaneGeometry(width, height)
      if (material) {
        const position = geometry.getAttribute('position')
        const uv = geometry.getAttribute('uv')
        const [rx, ry] = material.texrepeat
        for (let i = 0; i < position.count; i += 1) {
          uv.setXY(i, position.getX(i) * (material.texuniform ? rx : rx / width), position.getY(i) * (material.texuniform ? ry : ry / height))
        }
      }
      return geometry
    }
    case GEOM.SPHERE:
      return new THREE.SphereGeometry(a, 24, 16)
    case GEOM.ELLIPSOID: {
      const geometry = new THREE.SphereGeometry(1, 24, 16)
      geometry.scale(a, b, c)
      return geometry
    }
    case GEOM.CAPSULE: {
      const geometry = new THREE.CapsuleGeometry(a, b * 2, 8, 24)
      geometry.rotateX(Math.PI / 2)
      return geometry
    }
    case GEOM.CYLINDER: {
      const geometry = new THREE.CylinderGeometry(a, a, b * 2, 32)
      geometry.rotateX(Math.PI / 2)
      return geometry
    }
    case GEOM.BOX:
      return boxGeometry(item.size, material)
    default:
      return null
  }
}

async function decodeTextures(bytes, textures) {
  const out = new Map()
  for (const [id, texture] of Object.entries(textures)) {
    const bitmaps = await Promise.all(
      texture.faces.map((ref) => createImageBitmap(new Blob([slice(bytes, ref)], { type: 'image/jpeg' }), { imageOrientation: 'none' }))
    )
    out.set(Number(id), { type: texture.type, bitmaps, mean: meanColor(bitmaps) })
  }
  return out
}

function meanColor(bitmaps) {
  const canvas = new OffscreenCanvas(8, 8)
  const context = canvas.getContext('2d')
  const sum = [0, 0, 0]
  for (const bitmap of bitmaps) {
    context.drawImage(bitmap, 0, 0, 8, 8)
    const pixels = context.getImageData(0, 0, 8, 8).data
    for (let i = 0; i < pixels.length; i += 4) for (let k = 0; k < 3; k += 1) sum[k] += pixels[i + k] / 255
  }
  return sum.map((value) => value / (bitmaps.length * 64))
}

/** Decoded render pack: geometries, textures and materials, shared by every view of one scene. */
export async function loadRenderPack(render, base64) {
  const bytes = await inflate(base64)
  const meshes = new Map(Object.entries(render.meshes).map(([name, entry]) => [name, meshGeometry(bytes, entry)]))
  const textures = await decodeTextures(bytes, render.textures)
  return { render, meshes, textures }
}

// MuJoCo's fixed-function OpenGL lighting, per fragment: a headlight along the
// view, the model's lights with GL spot cones and attenuation, and the lit
// colour with its specular term clamped before the texture modulates it.
const SURFACE_VERTEX = `varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec2 vUv;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  vWorldNormal = mat3(modelMatrix) * normal;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * world;
}`
const SURFACE_FRAGMENT = `uniform vec3 diffuseColor;
uniform float opacity;
uniform float specular;
uniform float shininess;
uniform float emission;
uniform vec3 texMean;
#ifdef USE_TEXTURE
uniform sampler2D map;
#endif
uniform vec3 headAmbient;
uniform vec3 headDiffuse;
uniform vec3 headSpecular;
#if LIGHTS > 0
uniform vec3 lightPosition[LIGHTS];
uniform vec3 lightDirection[LIGHTS];
uniform vec3 lightAmbient[LIGHTS];
uniform vec3 lightDiffuse[LIGHTS];
uniform vec3 lightSpecular[LIGHTS];
uniform vec3 lightAttenuation[LIGHTS];
uniform vec3 lightCone[LIGHTS];
#endif
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec2 vUv;
void shade(vec3 L, vec3 N, vec3 V, vec3 ambient, vec3 diffuse, vec3 spec, float k, inout vec3 lit) {
  float nl = dot(N, L);
  lit += k * (ambient + max(nl, 0.0) * diffuse) * diffuseColor;
  if (nl > 0.0) lit += k * pow(max(dot(N, normalize(L + V)), 1e-4), shininess) * specular * spec;
}
void main() {
  vec3 N = normalize(vWorldNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorldPosition);
  vec3 lit = emission * diffuseColor;
  vec3 back = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  shade(back, N, V, headAmbient, headDiffuse, headSpecular, 1.0, lit);
#if LIGHTS > 0
  for (int i = 0; i < LIGHTS; i++) {
    vec3 L;
    float k = 1.0;
    if (lightCone[i].x > 0.5) {
      L = -normalize(lightDirection[i]);
    } else {
      vec3 toLight = lightPosition[i] - vWorldPosition;
      float d = length(toLight);
      L = toLight / d;
      vec3 a = lightAttenuation[i];
      k = 1.0 / max(a.x + a.y * d + a.z * d * d, 1e-6);
      float c = dot(-L, normalize(lightDirection[i]));
      k *= c >= lightCone[i].y ? pow(max(c, 0.0), lightCone[i].z) : 0.0;
    }
    shade(L, N, V, lightAmbient[i], lightDiffuse[i], lightSpecular[i], k, lit);
  }
#endif
  vec3 texel = texMean;
#ifdef USE_TEXTURE
  texel = texture2D(map, vUv).rgb;
#endif
  gl_FragColor = vec4(clamp(lit, 0.0, 1.0) * texel, opacity);
}`

/** The scene-wide light uniforms every surface shares. */
function lightUniforms(pack) {
  const head = pack.render.visual.headlight
  const lights = pack.render.lights.filter((light) => light.active !== false)
  const off = [0, 0, 0]
  const v3 = (values) => new THREE.Vector3(...values)
  return {
    count: lights.length,
    uniforms: {
      headAmbient: { value: v3(head.active ? head.ambient : off) },
      headDiffuse: { value: v3(head.active ? head.diffuse : off) },
      headSpecular: { value: v3(head.active ? head.specular : off) },
      lightPosition: { value: lights.map((light) => v3(light.pos)) },
      lightDirection: { value: lights.map((light) => v3(light.dir)) },
      lightAmbient: { value: lights.map((light) => v3(light.ambient)) },
      lightDiffuse: { value: lights.map((light) => v3(light.diffuse)) },
      lightSpecular: { value: lights.map((light) => v3(light.specular)) },
      lightAttenuation: { value: lights.map((light) => v3(light.attenuation ?? [1, 0, 0])) },
      lightCone: {
        value: lights.map((light) => v3([light.directional ? 1 : 0, Math.cos(((light.cutoff ?? 180) * Math.PI) / 180), light.exponent ?? 0]))
      }
    }
  }
}

/** A texture image the geom can sample by its own coordinates: 2D, or a cube whose six faces share one image on a box. */
function textureMap(pack, item, material, maps) {
  const texture = material?.texture === null || material?.texture === undefined ? null : pack.textures.get(material.texture)
  if (!texture) return { texture: null, map: null }
  const hasUv = item.type === GEOM.MESH ? !!pack.render.meshes[item.mesh]?.uv : [GEOM.PLANE, GEOM.BOX].includes(item.type)
  const flat = texture.type === '2d' || (texture.type === 'cube' && texture.bitmaps.length === 1 && item.type === GEOM.BOX)
  if (!flat || !hasUv) return { texture, map: null }
  const key = `${material.texture}`
  let map = maps.get(key)
  if (!map) {
    map = new THREE.Texture(texture.bitmaps[0])
    map.flipY = false
    map.colorSpace = THREE.NoColorSpace
    map.wrapS = map.wrapT = THREE.RepeatWrapping
    map.anisotropy = 4
    map.needsUpdate = true
    maps.set(key, map)
  }
  return { texture, map }
}

/** A surface with the colour and finish MuJoCo's scene resolved for this geom. */
function materialFor(pack, item, maps, lights) {
  const material = item.material === null ? null : pack.render.materials[item.material]
  const { texture, map } = textureMap(pack, item, material, maps)
  const rgba = item.rgba
  return new THREE.ShaderMaterial({
    vertexShader: SURFACE_VERTEX,
    fragmentShader: SURFACE_FRAGMENT,
    defines: { LIGHTS: lights.count, ...(map ? { USE_TEXTURE: '' } : {}) },
    uniforms: {
      ...lights.uniforms,
      diffuseColor: { value: new THREE.Vector3(rgba[0], rgba[1], rgba[2]) },
      opacity: { value: rgba[3] },
      specular: { value: item.specular },
      shininess: { value: item.shininess * 128 },
      emission: { value: item.emission },
      texMean: { value: new THREE.Vector3(...(texture && !map ? texture.mean : [1, 1, 1])) },
      ...(map ? { map: { value: map } } : {})
    },
    transparent: rgba[3] < 1,
    side: item.type === GEOM.PLANE ? THREE.DoubleSide : THREE.FrontSide
  })
}

/** One copy of the scene graph, posed from MuJoCo body poses. */
class LiberoGraph {
  constructor(pack, bodyIds) {
    this.scene = new THREE.Scene()
    this.maps = new Map()
    this.items = []
    const lights = lightUniforms(pack)
    for (const [index, item] of pack.render.geoms.entries()) {
      const geometry = item.type === GEOM.MESH ? pack.meshes.get(item.mesh) : primitiveGeometry(item, item.material === null ? null : pack.render.materials[item.material])
      if (!geometry) continue
      const mesh = new THREE.Mesh(geometry, materialFor(pack, item, this.maps, lights))
      mesh.matrixAutoUpdate = false
      mesh.userData.owned = item.type !== GEOM.MESH
      const local = new THREE.Matrix4().compose(
        new THREE.Vector3(...item.pos),
        new THREE.Quaternion(item.quat[1], item.quat[2], item.quat[3], item.quat[0]),
        new THREE.Vector3(1, 1, 1)
      )
      this.items.push({ mesh, body: bodyIds[index], local })
      this.scene.add(mesh)
    }
    const skybox = [...pack.textures.values()].find((texture) => texture.type === 'skybox')
    if (skybox) this.scene.background = new THREE.Color().setRGB(...skybox.mean, LINEAR)
  }

  pose(poses) {
    const world = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const rotation = new THREE.Quaternion()
    const unit = new THREE.Vector3(1, 1, 1)
    for (const { mesh, body, local } of this.items) {
      const p = body * 3
      const q = body * 4
      position.set(poses.xpos[p], poses.xpos[p + 1], poses.xpos[p + 2])
      rotation.set(poses.xquat[q + 1], poses.xquat[q + 2], poses.xquat[q + 3], poses.xquat[q])
      world.compose(position, rotation, unit)
      mesh.matrix.multiplyMatrices(world, local)
      mesh.matrixWorldNeedsUpdate = true
    }
  }

  dispose() {
    this.scene.traverse((object) => {
      if (object.isMesh) {
        object.material.dispose()
        if (object.userData.owned) object.geometry.dispose()
      }
    })
    for (const map of this.maps.values()) map.dispose()
  }
}

const DEPTH_VERTEX = `varying float vDepth;
void main() {
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vDepth = -view.z;
  gl_Position = projectionMatrix * view;
}`
const DEPTH_FRAGMENT = `varying float vDepth;
void main() { gl_FragColor = vec4(vDepth, 0.0, 0.0, 1.0); }`

/** Place a three.js camera at a MuJoCo camera pose (it looks along its -Z with +Y up, as three.js does). */
function placeCamera(camera, pose) {
  const m = pose.xmat
  const basis = new THREE.Matrix4().set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1)
  camera.position.set(...pose.position)
  camera.quaternion.setFromRotationMatrix(basis)
  camera.fov = pose.fovy
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
}

/**
 * The calibrated agentview and eye-in-hand RGB-D cameras on an existing WebGL
 * renderer. Captures do not depend on the viewport's orbit camera.
 */
export class LiberoCameras {
  constructor(renderer, pack, bodyIds, size = IMAGE_SIZE) {
    this.renderer = renderer
    this.size = size
    this.camera = new THREE.PerspectiveCamera(45, 1, pack.render.visual.znear * pack.render.visual.extent, pack.render.visual.zfar * pack.render.visual.extent)
    this.graph = new LiberoGraph(pack, bodyIds)
    this.color = new THREE.WebGLRenderTarget(size, size, { type: THREE.UnsignedByteType, samples: 4 })
    this.color.texture.colorSpace = THREE.NoColorSpace
    this.depth = new THREE.WebGLRenderTarget(size, size, { type: THREE.FloatType, format: THREE.RGBAFormat })
    this.depthMaterial = new THREE.ShaderMaterial({ vertexShader: DEPTH_VERTEX, fragmentShader: DEPTH_FRAGMENT, side: THREE.DoubleSide })
    this.rgba = new Uint8Array(size * size * 4)
    this.floats = new Float32Array(size * size * 4)
  }

  get supported() {
    return this.renderer.capabilities.isWebGL2 && this.renderer.extensions.has('EXT_color_buffer_float')
  }

  /** { view: { width, height, rgb (top-left RGB8), depth (top-left metres), intrinsics, camera_to_world } }. */
  capture(poses, cameraPoses) {
    if (!this.supported) throw new Error('当前浏览器不支持浮点渲染目标，无法生成深度图')
    this.graph.pose(poses)
    const { renderer, camera, size } = this
    const scene = this.graph.scene
    const previous = renderer.getRenderTarget()
    const clear = renderer.getClearColor(new THREE.Color())
    const alpha = renderer.getClearAlpha()
    const background = scene.background
    const out = {}
    try {
      for (const view of VIEWS) {
        const pose = cameraPoses[view]
        placeCamera(camera, pose)
        scene.overrideMaterial = null
        scene.background = background
        renderer.setClearColor(0x000000, 1)
        renderer.setRenderTarget(this.color)
        renderer.clear()
        renderer.render(scene, camera)
        renderer.readRenderTargetPixels(this.color, 0, 0, size, size, this.rgba)
        scene.overrideMaterial = this.depthMaterial
        scene.background = null
        renderer.setClearColor(0x000000, 0)
        renderer.setRenderTarget(this.depth)
        renderer.clear()
        renderer.render(scene, camera)
        renderer.readRenderTargetPixels(this.depth, 0, 0, size, size, this.floats)
        const rgb = new Uint8Array(size * size * 3)
        const depth = new Float32Array(size * size)
        // GL rows start at the bottom; image rows start at the top.
        for (let row = 0; row < size; row += 1) {
          const source = (size - 1 - row) * size
          const target = row * size
          for (let column = 0; column < size; column += 1) {
            const s = source + column
            const t = target + column
            rgb[t * 3] = this.rgba[s * 4]
            rgb[t * 3 + 1] = this.rgba[s * 4 + 1]
            rgb[t * 3 + 2] = this.rgba[s * 4 + 2]
            depth[t] = this.floats[s * 4]
          }
        }
        out[view] = { ...calibration(pose.position, pose.xmat, pose.fovy, size), rgb, depth }
      }
    } finally {
      scene.overrideMaterial = null
      scene.background = background
      renderer.setClearColor(clear, alpha)
      renderer.setRenderTarget(previous)
    }
    return out
  }

  dispose() {
    this.graph.dispose()
    this.color.dispose()
    this.depth.dispose()
    this.depthMaterial.dispose()
  }
}

/**
 * The planner's input image: the RGB frame with upstream's 64 px pixel grid and
 * a cyan cross at the projected measured TCP. No object labels.
 */
export function annotatedImage(packet, tcp, type = 'image/jpeg', quality = 0.9) {
  const { width, height, rgb } = packet
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
  context.font = '10px sans-serif'
  context.textBaseline = 'top'
  context.lineWidth = 1
  for (let at = 0; at < width; at += 64) {
    context.strokeStyle = 'rgb(115,126,132)'
    context.beginPath()
    context.moveTo(at + 0.5, 0)
    context.lineTo(at + 0.5, height)
    context.stroke()
    context.fillStyle = 'rgb(15,25,34)'
    context.fillRect(at, 0, 24, 12)
    context.fillStyle = '#fff'
    context.fillText(String(at), at + 1, 1)
  }
  for (let at = 64; at < height; at += 64) {
    context.strokeStyle = 'rgb(115,126,132)'
    context.beginPath()
    context.moveTo(0, at + 0.5)
    context.lineTo(width, at + 0.5)
    context.stroke()
    context.fillStyle = 'rgb(15,25,34)'
    context.fillRect(0, at, 26, 12)
    context.fillStyle = '#fff'
    context.fillText(String(at), 1, at + 1)
  }
  const uv = project(packet, tcp)
  if (uv && uv[0] >= 0 && uv[0] < width && uv[1] >= 0 && uv[1] < height) {
    context.strokeStyle = 'rgb(0,255,255)'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(uv[0] - 7, uv[1])
    context.lineTo(uv[0] + 7, uv[1])
    context.moveTo(uv[0], uv[1] - 7)
    context.lineTo(uv[0], uv[1] + 7)
    context.stroke()
  }
  return canvas.toDataURL(type, quality)
}

/** The interactive viewport: the same scene graph under an orbit camera that starts at agentview. */
export class LiberoView {
  constructor(container, { label = 'LIBERO 仿真场景', onError = () => {} } = {}) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.outputColorSpace = LINEAR
    this.renderer.domElement.setAttribute('aria-label', label)
    this.renderer.domElement.classList.add('libero-canvas')
    container.prepend(this.renderer.domElement)
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 50)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
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
  }

  /** Show one scene; `home` is the agentview pose the orbit camera starts from. */
  load(pack, bodyIds, home) {
    this.unload()
    this.graph = new LiberoGraph(pack, bodyIds)
    this.home = home
    this.cameraHome()
  }

  unload() {
    this.graph?.dispose()
    this.graph = null
    this.cameras?.dispose()
    this.cameras = null
  }

  /** The calibrated RGB-D cameras for the loaded scene, on this renderer. */
  sensorRig(pack, bodyIds) {
    if (!this.cameras) this.cameras = new LiberoCameras(this.renderer, pack, bodyIds)
    return this.cameras
  }

  cameraHome() {
    if (!this.home) return
    const m = this.home.xmat
    const forward = [-m[2], -m[5], -m[8]]
    this.camera.position.set(...this.home.position)
    this.controls.target.set(this.home.position[0] + forward[0], this.home.position[1] + forward[1], this.home.position[2] + forward[2])
    this.controls.update()
    this.requestRender()
  }

  cameraTop() {
    if (!this.home) return
    const target = this.controls.target
    this.camera.position.set(target.x, target.y - 0.001, target.z + 1.6)
    this.controls.update()
    this.requestRender()
  }

  render(poses) {
    if (!this.graph || !poses) return
    this.graph.pose(poses)
    this.requestRender()
  }

  requestRender() {
    if (this.renderRequested || this.disposed || !this.graph) return
    this.renderRequested = true
    requestAnimationFrame(() => {
      this.renderRequested = false
      if (this.disposed || !this.graph || !this.container.clientWidth || !this.container.clientHeight) return
      this.controls.update()
      this.renderer.render(this.graph.scene, this.camera)
    })
  }

  dispose() {
    this.disposed = true
    this.observer.disconnect()
    this.controls.dispose()
    this.unload()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }
}
