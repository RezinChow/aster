(() => {
  let canvas = document.getElementById("download-cosmos");
  const section = canvas?.closest(".download");
  if (!canvas || !section) return;
  const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? { matches: true };
  const hasIntersection = typeof IntersectionObserver === "function";
  let width = 0;
  let height = 0;
  let ratio = 0;
  let frame = 0;
  let lastPaint = null;
  let elapsed = 0;
  let inView = false;
  let pageActive = true;
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;
  let renderer = null;
  let seed = 20261026;

  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function createWebGLRenderer() {
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
    if (!gl || typeof gl.createShader !== "function") return null;
    const galaxyCenter = [24, 12, -96];
    const starVertex = `
      attribute vec3 aPosition;
      attribute float aSize;
      attribute vec4 aColor;
      attribute float aLayer;
      uniform vec2 uResolution;
      uniform vec3 uCamera;
      uniform vec3 uGalaxy;
      uniform float uTime;
      uniform float uRatio;
      varying mediump vec4 vColor;
      varying mediump vec2 vTravel;
      varying mediump float vNear;
      void main() {
        vec3 position = aPosition;
        if (aLayer > 0.5) {
          float span = aLayer < 1.5 ? 44.0 : (aLayer < 2.5 ? 108.0 : 204.0);
          position.z = -4.0 - mod(-position.z - 4.0 - uTime * 7.2, span);
        } else if (aLayer > -0.5) {
          vec3 local = position - uGalaxy;
          vec2 disk = vec2(local.x, dot(local.yz, vec2(0.42, 0.9075)));
          float thickness = dot(local.yz, vec2(0.9075, -0.42));
          float angle = uTime * 0.018;
          disk = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * disk;
          position = uGalaxy + vec3(disk.x, disk.y * 0.42 + thickness * 0.9075,
            disk.y * 0.9075 - thickness * 0.42);
        }
        vec3 view = position - uCamera;
        float depth = max(0.5, -view.z);
        float aspect = uResolution.x / uResolution.y;
        vec2 clip = vec2(view.x / aspect, view.y) * 2.3;
        gl_Position = vec4(clip, 0.0, depth);
        vNear = aLayer > 0.5 ? 1.0 - smoothstep(8.0, 42.0, depth) : 0.0;
        vTravel = normalize(clip + vec2(0.0001));
        float size = clamp(aSize * uResolution.y * 1.15 / depth,
          0.55 * uRatio, 12.0 * uRatio);
        gl_PointSize = size * (1.0 + vNear * 1.8);
        float fog = exp(-depth * 0.0055);
        float arrival = smoothstep(4.0, 12.0, depth);
        float shimmer = 0.76 + 0.24 * sin(uTime * 0.7 + aPosition.x * 0.31 + aPosition.y * 0.17);
        vColor = vec4(aColor.rgb, aColor.a * fog * arrival * shimmer);
      }
    `;
    const starFragment = `
      precision mediump float;
      varying mediump vec4 vColor;
      varying mediump vec2 vTravel;
      varying mediump float vNear;
      void main() {
        vec2 point = gl_PointCoord - 0.5;
        float along = dot(point, vTravel);
        float across = dot(point, vec2(-vTravel.y, vTravel.x));
        float radius = length(vec2(along, across * (1.0 + vNear * 4.0)));
        float core = 1.0 - smoothstep(0.04, 0.27, radius);
        float halo = 1.0 - smoothstep(0.15, 0.5, radius);
        gl_FragColor = vec4(vColor.rgb, vColor.a * (core * 0.8 + halo * 0.2));
      }
    `;
    const quadVertex = `
      attribute vec2 aPosition;
      void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
    `;
    const nebulaFragment = `
      precision mediump float;
      uniform vec2 uResolution;
      uniform vec3 uCamera;
      uniform vec3 uGalaxy;
      uniform float uTime;
      float hash(vec2 p) {
        vec3 value = fract(vec3(p.xyx) * 0.1031);
        value += dot(value, value.yzx + 33.33);
        return fract((value.x + value.y) * value.z);
      }
      float noise(vec2 p) {
        vec2 cell = floor(p);
        vec2 fraction = fract(p);
        vec2 blend = fraction * fraction * (3.0 - 2.0 * fraction);
        return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), blend.x),
          mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), blend.x), blend.y);
      }
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 3; i++) {
          value += amplitude * noise(p);
          p = p * 2.03 + 17.1;
          amplitude *= 0.5;
        }
        return value;
      }
      void main() {
        vec2 uv = gl_FragCoord.xy / uResolution;
        float aspect = uResolution.x / uResolution.y;
        vec3 ray = normalize(vec3((uv.x - 0.5) * aspect, uv.y - 0.5, -1.15));
        vec3 farPoint = uCamera + ray * ((170.0 + uCamera.z) / -ray.z);
        vec3 nearPoint = uCamera + ray * ((64.0 + uCamera.z) / -ray.z);
        float farCloud = fbm(farPoint.xy * 0.026 + vec2(uTime * 0.002, 0.0));
        float nearCloud = fbm(nearPoint.xy * 0.052 + fbm(nearPoint.xy * 0.03) * 1.4);
        vec3 color = vec3(0.008, 0.012, 0.027);
        color += vec3(0.035, 0.075, 0.17) * smoothstep(0.22, 0.7, farCloud);
        color += vec3(0.10, 0.035, 0.14) * smoothstep(0.3, 0.76, nearCloud) * 0.6;

        vec3 normal = vec3(0.0, 0.9075, -0.42);
        float denominator = dot(ray, normal);
        if (abs(denominator) > 0.03) {
          float distanceToDisk = dot(uGalaxy - uCamera, normal) / denominator;
          if (distanceToDisk > 0.0) {
            vec3 local = uCamera + ray * distanceToDisk - uGalaxy;
            vec2 disk = vec2(local.x, dot(local.yz, vec2(0.42, 0.9075)));
            float radius = length(disk);
            if (radius < 56.0) {
              float angle = atan(disk.y, disk.x);
              float spiral = 0.5 + 0.5 * cos(3.0 * (angle - radius * 0.14 - uTime * 0.018));
              float arms = pow(spiral, 12.0) * exp(-radius * 0.048);
              float dust = 0.25 + 0.75 * fbm(disk * 0.16);
              float core = exp(-radius * radius * 0.035);
              float diskFade = 1.0 - smoothstep(32.0, 56.0, radius);
              color += (vec3(0.12, 0.22, 0.38) * arms * dust
                + vec3(0.22, 0.21, 0.26) * core) * diskFade;
            }
          }
        }
        float vignette = 1.0 - smoothstep(0.4, 0.98, length((uv - 0.5) * vec2(1.0, 0.82)));
        gl_FragColor = vec4(color * vignette, 1.0);
      }
    `;

    function shader(type, source) {
      const item = gl.createShader(type);
      if (!item) return null;
      gl.shaderSource(item, source);
      gl.compileShader(item);
      return gl.getShaderParameter(item, gl.COMPILE_STATUS) ? item : null;
    }

    function program(vertexSource, fragmentSource) {
      const vertex = shader(gl.VERTEX_SHADER, vertexSource);
      const fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
      if (!vertex || !fragment) return null;
      const result = gl.createProgram();
      if (!result) return null;
      gl.attachShader(result, vertex);
      gl.attachShader(result, fragment);
      gl.linkProgram(result);
      return gl.getProgramParameter(result, gl.LINK_STATUS) ? result : null;
    }

    const starProgram = program(starVertex, starFragment);
    const nebulaProgram = program(quadVertex, nebulaFragment);
    if (!starProgram || !nebulaProgram) return null;
    const starBuffer = gl.createBuffer();
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const starAttributes = Object.fromEntries(["aPosition", "aSize", "aColor", "aLayer"].map((name) => [name, gl.getAttribLocation(starProgram, name)]));
    const quadAttribute = gl.getAttribLocation(nebulaProgram, "aPosition");
    const starUniforms = Object.fromEntries(["uResolution", "uCamera", "uGalaxy", "uTime", "uRatio"].map((name) => [name, gl.getUniformLocation(starProgram, name)]));
    const nebulaUniforms = Object.fromEntries(["uResolution", "uCamera", "uGalaxy", "uTime"].map((name) => [name, gl.getUniformLocation(nebulaProgram, name)]));
    let field = [];
    let meteor = null;
    let nextMeteorAt = 3.4;

    function colorFor(tone) {
      if (tone > 0.88) return [0.84, 0.72, 1.0];
      if (tone > 0.58) return [0.62, 0.79, 1.0];
      return [0.94, 0.96, 1.0];
    }

    function buildStars() {
      field = [];
      const aspect = width / Math.max(1, height);
      const fieldCount = Math.max(480, Math.min(1500, Math.round(width * height / 1000)));
      const galaxyCount = Math.max(500, Math.min(950, Math.round(width * height / 2000)));
      for (let index = 0; index < fieldCount; index++) {
        const distribution = random();
        const layer = distribution < 0.14 ? 1 : distribution < 0.48 ? 2 : 3;
        const span = layer === 1 ? 44 : layer === 2 ? 108 : 204;
        const x = (random() - 0.5) * span * aspect * 1.5;
        const y = (random() - 0.5) * span * 1.15;
        const z = -4 - random() * span;
        const radius = 0.055 + random() * 0.085;
        const color = colorFor(random());
        field.push(x, y, z, radius, ...color, 0.55 + random() * 0.45, layer);
      }
      for (let index = 0; index < galaxyCount; index++) {
        const radius = 1 + Math.pow(random(), 0.7) * 44;
        const angle = (index % 3) * Math.PI * 2 / 3 + radius * 0.14 + (random() - 0.5) * 0.4;
        const u = Math.cos(angle) * radius;
        const v = Math.sin(angle) * radius;
        const thickness = (random() - 0.5) * 1.4;
        const color = radius < 8 ? [1.0, 0.91, 0.8] : colorFor(random());
        field.push(galaxyCenter[0] + u, galaxyCenter[1] + v * 0.42 + thickness * 0.9075,
          galaxyCenter[2] + v * 0.9075 - thickness * 0.42, 0.07 + random() * 0.06,
          ...color, 0.65 + random() * 0.35, 0);
      }
    }

    function draw(time) {
      if (!width || !height) return;
      const camera = [pointerX * 0.25 + Math.sin(time * 0.07) * 1.8,
        pointerY * 0.22 + Math.cos(time * 0.05) * 1.1, Math.sin(time * 0.035) * 2.5];
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.BLEND);
      gl.useProgram(nebulaProgram);
      gl.uniform2f(nebulaUniforms.uResolution, canvas.width, canvas.height);
      gl.uniform3f(nebulaUniforms.uCamera, ...camera);
      gl.uniform3f(nebulaUniforms.uGalaxy, ...galaxyCenter);
      gl.uniform1f(nebulaUniforms.uTime, time);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.vertexAttribPointer(quadAttribute, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(quadAttribute);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      const vertices = field.slice();
      if (time >= nextMeteorAt && !meteor) {
        meteor = { start: nextMeteorAt, x: 12 + random() * 14, y: 8 + random() * 10,
          z: -22 - random() * 18, vx: -24 - random() * 12, vy: -8 - random() * 6 };
      }
      if (meteor) {
        const progress = (time - meteor.start) / 1.3;
        if (progress >= 1) {
          meteor = null;
          nextMeteorAt = time + 6 + random() * 5;
        } else {
          for (let index = 0; index < 30; index++) {
            const t = progress - index * 0.018;
            if (t < 0) continue;
            vertices.push(meteor.x + meteor.vx * t, meteor.y + meteor.vy * t, meteor.z,
              0.12 * (1 - index / 34), 0.76, 0.87, 1.0,
              (1 - index / 30) * Math.sin(progress * Math.PI), -1);
          }
        }
      }

      gl.useProgram(starProgram);
      gl.uniform2f(starUniforms.uResolution, canvas.width, canvas.height);
      gl.uniform3f(starUniforms.uCamera, ...camera);
      gl.uniform3f(starUniforms.uGalaxy, ...galaxyCenter);
      gl.uniform1f(starUniforms.uTime, time);
      gl.uniform1f(starUniforms.uRatio, ratio);
      gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(starAttributes.aPosition, 3, gl.FLOAT, false, 36, 0);
      gl.vertexAttribPointer(starAttributes.aSize, 1, gl.FLOAT, false, 36, 12);
      gl.vertexAttribPointer(starAttributes.aColor, 4, gl.FLOAT, false, 36, 16);
      gl.vertexAttribPointer(starAttributes.aLayer, 1, gl.FLOAT, false, 36, 32);
      Object.values(starAttributes).forEach((attribute) => gl.enableVertexAttribArray(attribute));
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, vertices.length / 9);
    }

    buildStars();
    canvas.dataset.renderer = "webgl";
    return { draw, rebuild: buildStars };
  }


  function createCanvasRenderer() {
    let context;
    try {
      context = canvas.getContext("2d");
    } catch {
      return null;
    }
    if (!context) return null;
    let stars = [];
    let meteor = null;
    let nextMeteorAt = 4.2;

    function buildStars() {
      const count = Math.max(70, Math.min(170, Math.round((width * height) / 8500)));
      stars = Array.from({ length: count }, (_, index) => ({
        x: random(), y: random(), radius: 0.35 + random() * 1.35,
        depth: 0.2 + random() * 0.8, phase: random() * Math.PI * 2, blue: index % 5 === 0
      }));
    }

    function drawBackground() {
      context.fillStyle = "#070910";
      context.fillRect(0, 0, width, height);
      const radius = Math.max(width, height) * 0.82;
      const blue = context.createRadialGradient(width * 0.18, height * 0.22, 0, width * 0.18, height * 0.22, radius);
      blue.addColorStop(0, "rgba(54,82,154,0.24)");
      blue.addColorStop(0.46, "rgba(34,52,105,0.12)");
      blue.addColorStop(1, "rgba(7,9,16,0)");
      context.fillStyle = blue;
      context.fillRect(0, 0, width, height);
      const violet = context.createRadialGradient(width * 0.84, height * 0.64, 0, width * 0.84, height * 0.64, radius * 0.76);
      violet.addColorStop(0, "rgba(93,62,135,0.17)");
      violet.addColorStop(0.55, "rgba(48,38,89,0.08)");
      violet.addColorStop(1, "rgba(7,9,16,0)");
      context.fillStyle = violet;
      context.fillRect(0, 0, width, height);
    }

    function drawMeteor(time) {
      if (time < nextMeteorAt) return;
      if (!meteor) meteor = { start: nextMeteorAt, x: 0.68 + random() * 0.24, y: 0.06 + random() * 0.2, dx: -0.25 - random() * 0.14, dy: 0.2 + random() * 0.12 };
      const progress = (time - meteor.start) / 1.15;
      if (progress >= 1) {
        meteor = null;
        nextMeteorAt = time + 5 + random() * 5;
        return;
      }
      const x = (meteor.x + meteor.dx * progress) * width;
      const y = (meteor.y + meteor.dy * progress) * height;
      const angle = Math.atan2(meteor.dy * height, meteor.dx * width);
      const length = 120 + progress * 110;
      const tailX = x - Math.cos(angle) * length;
      const tailY = y - Math.sin(angle) * length;
      const alpha = Math.sin(progress * Math.PI) * 0.8;
      const trail = context.createLinearGradient(tailX, tailY, x, y);
      trail.addColorStop(0, "rgba(170,204,255,0)");
      trail.addColorStop(0.72, `rgba(194,220,255,${alpha * 0.55})`);
      trail.addColorStop(1, `rgba(255,255,255,${alpha})`);
      context.strokeStyle = trail;
      context.lineWidth = 1.6;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(tailX, tailY);
      context.lineTo(x, y);
      context.stroke();
    }

    function draw(time) {
      if (!width || !height) return;
      context.clearRect(0, 0, width, height);
      drawBackground();
      stars.forEach((star) => {
        const drift = (star.x + time * 0.0012 * star.depth) % 1;
        const x = drift * width + pointerX * star.depth;
        const y = (star.y + Math.sin(time * 0.08 + star.phase) * 0.004) * height + pointerY * star.depth;
        const shimmer = 0.22 + (Math.sin(time * (0.65 + star.depth * 0.65) + star.phase) * 0.5 + 0.5) * 0.68;
        context.fillStyle = star.blue ? `rgba(167,205,255,${shimmer})` : `rgba(244,247,255,${shimmer})`;
        context.beginPath();
        context.arc(x, y, star.radius * (0.75 + star.depth * 0.45), 0, Math.PI * 2);
        context.fill();
      });
      drawMeteor(time);
    }

    buildStars();
    canvas.dataset.renderer = "canvas";
    return { draw: draw, rebuild: buildStars, setTransform: (value) => context.setTransform(value, 0, 0, value, 0, 0) };
  }

  function selectRenderer() {
    try {
      renderer = createWebGLRenderer();
    } catch {
      renderer = null;
    }
    if (!renderer) renderer = createCanvasRenderer();
    if (!renderer && typeof canvas.cloneNode === "function") {
      const replacement = canvas.cloneNode(false);
      canvas.replaceWith(replacement);
      canvas = replacement;
      renderer = createCanvasRenderer();
    }
  }

  function active() {
    return pageActive && !document.hidden && inView;
  }

  function animated() {
    return active() && hasIntersection && !motion.matches && width > 0 && height > 0 && renderer;
  }

  function stop() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    lastPaint = null;
  }

  function tick(now) {
    frame = 0;
    if (!animated()) return;
    const delta = lastPaint === null ? 34 : now - lastPaint;
    if (delta >= 1000 / 30) {
      elapsed += Math.min(delta, 64) / 1000;
      pointerX += (targetX - pointerX) * 0.08;
      pointerY += (targetY - pointerY) * 0.08;
      renderer?.draw(elapsed);
      lastPaint = now;
    }
    frame = window.requestAnimationFrame(tick);
  }

  function sync() {
    if (!animated()) {
      stop();
      if (active()) {
        if (motion.matches) pointerX = pointerY = targetX = targetY = 0;
        renderer?.draw(motion.matches ? 0 : elapsed);
      }
    } else if (!frame) {
      frame = window.requestAnimationFrame(tick);
    }
  }

  function resize() {
    if (!renderer) return;
    const bounds = canvas.getBoundingClientRect();
    const nextWidth = Math.max(0, Math.round(bounds.width));
    const nextHeight = Math.max(0, Math.round(bounds.height));
    const nextRatio = Math.min(2, window.devicePixelRatio || 1);
    if (nextWidth === width && nextHeight === height && nextRatio === ratio) return;
    width = nextWidth;
    height = nextHeight;
    ratio = nextRatio;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    renderer?.setTransform?.(ratio);
    renderer?.rebuild?.();
    if (animated()) renderer?.draw(elapsed);
    sync();
  }

  function pointer(event) {
    if (motion.matches || !active() || event.pointerType === "touch") return;
    const bounds = section.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    targetX = (x - 0.5) * 12;
    targetY = (y - 0.5) * 8;
  }

  canvas.addEventListener?.("webglcontextlost", (event) => {
    event.preventDefault();
    const replacement = canvas.cloneNode(false);
    canvas.replaceWith(replacement);
    canvas = replacement;
    selectRenderer();
    resize();
  });
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pagehide", () => {
    pageActive = false;
    stop();
  });
  window.addEventListener("pageshow", () => {
    pageActive = true;
    resize();
    sync();
  });
  if (motion.addEventListener) motion.addEventListener("change", sync);
  else motion.addListener?.(sync);
  if (hasIntersection) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    }).observe(section);
  } else {
    inView = true;
  }
  if (typeof ResizeObserver === "function") new ResizeObserver(resize).observe(canvas.parentElement);
  selectRenderer();
  if (renderer) {
    section.addEventListener("pointermove", pointer, { passive: true });
    section.addEventListener("pointerleave", () => {
      targetX = targetY = 0;
    }, { passive: true });
  }
  resize();
})();
