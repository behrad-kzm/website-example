// The sky of "What we do": three bodies in front of a Milky Way, joined by thin lines.
//   1. The hero planet without its ring: a company on its own.
//   2. A gas planet made of drifting 1 and 0 digits: the planet of data that colonAIz produces.
//   3. The hero planet with its ring of digits: the company, equipped with that data.
// Bodies 1 and 3 are built by the hero's own code (assets/planet.js), so they match it exactly.
// Each body is drawn in its own square viewport, which lets the page place and size it freely.
import * as THREE from 'three';
import { buildPlanet, buildRing, digitAtlas, PALETTE, PLANET_SPEED, AXIAL_TILT, RING_INCLINE } from './planet.js';

// Positions as fractions of the half-width and half-height of the sky, for tall and for wide skies
const LAYOUT_TALL = [[-0.42, 0.58], [0.42, 0.12], [-0.12, -0.42]];
const LAYOUT_WIDE = [[-0.64, 0.2], [-0.12, -0.25], [0.38, 0.2]];
// Where the single body sits while the other two are hidden behind it
const HEAD_ON = [0, 0.08];
// Half the side of a body's viewport, in planet radii: room for the ring (which reaches 2.08) and its waves
const EXTENT = 2.4;
// How large each body is drawn relative to the others; the ringed planet is smaller because its ring is wide
const BODY_SIZE = [1, 1, 0.8];
// How far past the planet's centre the number label sits, in planet radii
const LABEL_AT = [1.3, 1.3, 2.2];
const FOV = 32;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createSky(host, buttons, focus, reduceMotion) {
  const canvas = host.querySelector('canvas');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, premultipliedAlpha: true, antialias: true });
  } catch (error) {
    return null;
  }
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const gpuName = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
  // Without a GPU every frame is expensive: draw stills only, like the hero planet does
  const software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpuName);
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;

  const color = (hex) => new THREE.Color(hex);
  const fovTan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

  // Backdrop: one full-canvas triangle
  const backdropUniforms = {
    uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uDrift: { value: new THREE.Vector2() },
    uStar0: { value: new THREE.Vector3() }, uStar1: { value: new THREE.Vector3() }, uStar2: { value: new THREE.Vector3() },
    uFocus: { value: new THREE.Vector3() }, uSpread: { value: 0 },
  };
  const backdropGeometry = new THREE.BufferGeometry();
  backdropGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const backdrop = new THREE.Mesh(backdropGeometry, new THREE.ShaderMaterial({
    uniforms: backdropUniforms, vertexShader: BACKDROP_VERTEX, fragmentShader: BACKDROP_FRAGMENT,
    depthTest: false, depthWrite: false, blending: THREE.NoBlending,
  }));
  backdrop.frustumCulled = false;
  const backdropScene = new THREE.Scene();
  backdropScene.add(backdrop);
  const backdropCamera = new THREE.Camera();

  // The bodies share one scene and one camera; each draw shows only the parts that body needs
  const gain = { value: 1 };   // brightness of the body being drawn
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, EXTENT / fovTan);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  const system = new THREE.Group();   // the hero planet and its ring, leaning as they do in the hero
  system.rotation.z = AXIAL_TILT;
  const planet = buildPlanet(5);
  planet.group.children.forEach((mesh) => toDisplay(mesh.material, gain));
  system.add(planet.group);
  const ring = buildRing(7, color, 2.4);
  ring.points.rotation.x = RING_INCLINE;
  ring.uniforms.uPlanet.value.set(0, 0, -camera.position.z);
  toDisplay(ring.points.material, gain);
  system.add(ring.points);
  scene.add(system);

  const data = buildDataPlanet(color, gain);
  scene.add(data.group);

  let width = 0, height = 0, visible = false, lost = false, raf = 0, last = 0;
  const current = [1, 0, 0, 0];   // eased copies of `focus`
  const started = performance.now();

  function resize() {
    width = host.clientWidth;
    height = host.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, software ? 1 : 1.75));
    renderer.setSize(width, height, false);
    kick();
  }

  function drawBody(i, centreX, centreY, radius) {
    const half = radius * EXTENT;
    renderer.setViewport(centreX - half, height - centreY - half, 2 * half, 2 * half);
    renderer.setScissor(centreX - half, height - centreY - half, 2 * half, 2 * half);
    system.visible = i !== 1;
    ring.points.visible = i === 2;
    data.group.visible = i === 1;
    // Digits are point sprites: their size follows the height of the viewport in device pixels
    const pointScale = (2 * half * renderer.getPixelRatio()) / (2 * fovTan);
    ring.uniforms.uScale.value = pointScale;
    data.uniforms.uScale.value = pointScale;
    gain.value = 1.1 + 1.1 * current[i];   // the body in focus is lit; the others sit back
    renderer.clearDepth();
    renderer.render(scene, camera);
  }

  function draw(time) {
    const min = Math.min(width, height);
    const halfW = 0.5 * width / min, halfH = 0.5 * height / min;
    const layout = width / height > 1.5 ? LAYOUT_WIDE : LAYOUT_TALL;
    // The radius of a planet that is not in focus; the focused one grows to about 2.4 times this
    const radius = clamp(0.07 * Math.sqrt(width * height), 6, 0.16 * min) / min;

    const spread = current[3];
    const ease = spread * spread * (3 - 2 * spread);
    const place = layout.map(([x, y]) => [HEAD_ON[0] + (x - HEAD_ON[0]) * ease, HEAD_ON[1] + (y - HEAD_ON[1]) * ease]);
    // The whole constellation leans a little so the focused body sits nearer the middle
    let shiftX = 0, shiftY = 0;
    for (let i = 0; i < 3; i++) {
      shiftX -= 0.22 * current[i] * place[i][0] * halfW;
      shiftY -= 0.22 * current[i] * place[i][1] * halfH;
    }

    const bodies = [];
    for (let i = 0; i < 3; i++) {
      // The focused body moves toward the viewer: perspective makes it larger
      const scale = 1.7 / (1.7 - 0.42 * current[i]);
      const x = (place[i][0] * halfW + shiftX + 0.006 * Math.sin(time * 0.31 + i * 2.1)) * scale;
      const y = (place[i][1] * halfH + shiftY + 0.006 * Math.cos(time * 0.27 + i * 1.3)) * scale;
      // Head-on, the two far bodies are smaller, so the first planet covers them completely
      const r = radius * BODY_SIZE[i] * scale * (1 + 0.85 * current[i]) * (i === 0 ? 1 : 0.4 + 0.6 * ease);
      backdropUniforms['uStar' + i].value.set(x, y, r);
      bodies.push({ x: width / 2 + x * min, y: height / 2 - y * min, r: r * min });
      const left = bodies[i].x + bodies[i].r * LABEL_AT[i] + 2;
      buttons[i].style.transform = `translate(${left.toFixed(1)}px, ${bodies[i].y.toFixed(1)}px) translateY(-50%)`;
    }

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    backdropUniforms.uRes.value.copy(size);
    backdropUniforms.uTime.value = time;
    backdropUniforms.uDrift.value.set(shiftX + time * 0.004, shiftY + time * 0.002);
    backdropUniforms.uFocus.value.set(current[0], current[1], current[2]);
    backdropUniforms.uSpread.value = ease;

    planet.group.rotation.y = time * PLANET_SPEED * 2;
    planet.uniforms.uTime.value = time;
    ring.uniforms.uTime.value = 12 + time;
    data.uniforms.uTime.value = time;

    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, width, height);
    renderer.clear();
    renderer.render(backdropScene, backdropCamera);
    // Far to near, so that head-on the first planet hides the other two
    renderer.setScissorTest(true);
    for (const i of [2, 1, 0]) {
      if (i !== 0 && ease < 0.02) continue;   // still fully hidden behind the first planet
      drawBody(i, bodies[i].x, bodies[i].y, bodies[i].r);
    }
  }

  function frame(now) {
    raf = 0;
    if (!visible || lost || !width || !height) return;
    const still = software || reduceMotion.matches;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    for (let i = 0; i < 4; i++) {
      // The spread (3) moves more slowly than the focus, so the two bodies emerge unhurried
      current[i] = still ? focus[i] : current[i] + (focus[i] - current[i]) * (1 - Math.exp(-dt * (i === 3 ? 2.6 : 4.5)));
    }
    draw(still ? 20 : (now - started) / 1000);
    if (!still) raf = requestAnimationFrame(frame);
  }

  function kick() {
    if (raf || !visible || lost) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); lost = true; host.hidden = true; });
  new ResizeObserver(resize).observe(host);

  return {
    kick,
    setVisible(value) { visible = value; if (value) kick(); },
  };
}

// The hero draws through a bloom and tone-mapping pass. Here the bodies are drawn straight to the canvas,
// so each material's final colour is tone-mapped and converted for display in its own shader instead.
const DISPLAY_GLSL = `
uniform float uSkyGain;
vec3 skyDisplay(vec3 c) {
  c *= uSkyGain;
  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}
`;
function toDisplay(material, gain) {
  material.uniforms.uSkyGain = gain;
  material.fragmentShader = DISPLAY_GLSL + material.fragmentShader.replace(
    /gl_FragColor = vec4\((.+), ([^,]+)\);(\s*}\s*)$/,
    'gl_FragColor = vec4(skyDisplay($1), $2);$3',
  );
  material.needsUpdate = true;
}

// Body 2: a gas planet made of data. Digits cover a sphere in bands of latitude; each band drifts around
// the planet at its own speed, some one way and some the other, like the cloud belts of a gas giant.
function buildDataPlanet(color, gain) {
  const COUNT = 1700;
  const lat = [], lon = [], phase = [], size = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < COUNT; i++) {
    lat.push(Math.asin(1 - (2 * (i + 0.5)) / COUNT));
    lon.push(i * golden);
    phase.push(Math.random());
    size.push(0.085 + Math.random() * 0.05);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(COUNT * 3), 3));
  geometry.setAttribute('aLat', new THREE.Float32BufferAttribute(lat, 1));
  geometry.setAttribute('aLon', new THREE.Float32BufferAttribute(lon, 1));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.2);

  const uniforms = {
    uTime: { value: 0 }, uScale: { value: 500 }, uAtlas: { value: digitAtlas() },
    uCyan: { value: color(PALETTE.cyan) }, uBlue: { value: color(PALETTE.blue) }, uViolet: { value: color(PALETTE.violet) },
    uSkyGain: gain,
  };
  const digits = new THREE.Points(geometry, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aLat, aLon, aPhase, aSize;
      uniform float uTime, uScale;
      uniform vec3 uCyan, uBlue, uViolet;
      varying vec3 vColor;
      varying float vDigit;
      varying float vAlpha;
      float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
      void main() {
        // Belts: nine bands from pole to pole, each with its own drift
        float band = floor((aLat / 1.5708 * 0.5 + 0.5) * 9.0);
        float drift = (hash(band + 2.3) - 0.5) * 0.55 + 0.1;
        float lon = aLon + uTime * drift;
        // Turbulence: digits bob across their belt and breathe in and out of the surface
        float lat = aLat + 0.04 * sin(uTime * 0.5 + aPhase * 40.0 + lon * 3.0);
        float r = 1.0 + 0.03 * sin(uTime * 0.7 + aPhase * 30.0);
        vec3 p = r * vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale / -mv.z;

        vDigit = step(0.5, hash(aPhase * 91.7 + floor(uTime * 0.7 + aPhase * 13.0)));
        vec3 c = mix(uCyan, uBlue, smoothstep(0.2, 0.8, hash(band + 3.1)));
        c = mix(c, uViolet * 1.5, smoothstep(0.7, 1.0, hash(band * 5.3 + 1.7)));
        // A storm: one bright patch that travels with its belt
        float storm = exp(-pow((mod(lon + 9.42478, 6.28318) - 3.14159) * 1.6, 2.0)) * step(3.5, band) * step(band, 4.5);
        c = mix(c, vec3(0.8, 1.0, 1.0), storm * 0.7);
        float facing = normalize(normalMatrix * p).z;   // 1 facing the viewer, 0 at the limb
        float twinkle = 0.7 + 0.3 * sin(uTime * 2.0 + aPhase * 60.0);
        vColor = c;
        vAlpha = smoothstep(-0.05, 0.55, facing) * twinkle * (0.6 + 0.4 * hash(band * 1.7)) * (1.0 + storm);
      }`,
    fragmentShader: DISPLAY_GLSL + /* glsl */`
      uniform sampler2D uAtlas;
      varying vec3 vColor;
      varying float vDigit;
      varying float vAlpha;
      void main() {
        vec2 uv = vec2(gl_PointCoord.x * 0.5 + vDigit * 0.5, 1.0 - gl_PointCoord.y);
        float glyph = texture2D(uAtlas, uv).a;
        if (glyph < 0.03) discard;
        gl_FragColor = vec4(skyDisplay(vColor * vAlpha * 1.3), glyph);
      }`,
  }));

  // The body under the digits: near-black, with faint belts and a blue rim, so the digits read as its surface
  // and the ones on the far side stay hidden
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.95, 48, 32), new THREE.ShaderMaterial({
    uniforms: { uBlue: uniforms.uBlue, uSkyGain: gain },
    vertexShader: /* glsl */`
      varying vec3 vNormal;
      varying float vLat;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vLat = asin(clamp(normalize(position).y, -1.0, 1.0));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: DISPLAY_GLSL + /* glsl */`
      uniform vec3 uBlue;
      varying vec3 vNormal;
      varying float vLat;
      void main() {
        float rim = pow(1.0 - clamp(normalize(vNormal).z, 0.0, 1.0), 3.0);
        float belts = 0.5 + 0.5 * sin(vLat * 18.0);
        vec3 col = uBlue * (0.012 + 0.02 * belts + 0.22 * rim);
        gl_FragColor = vec4(skyDisplay(col), 1.0);
      }`,
  }));

  const group = new THREE.Group();
  group.rotation.set(0.22, 0, -0.3);
  group.add(body, digits);
  return { group, uniforms };
}

const BACKDROP_VERTEX = `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BACKDROP_FRAGMENT = `
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uDrift;
uniform vec3 uStar0, uStar1, uStar2;   // xy: centre, z: radius, in units of the shorter canvas side
uniform vec3 uFocus;
uniform float uSpread;   // 0: seen head-on, one body in view. 1: seen from above, all three

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float sum = 0.0, amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * noise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + vec2(17.1, 9.2);
    amp *= 0.5;
  }
  return sum;
}

// Faint background stars: one per grid cell at most, each with its own slow twinkle
vec3 field(vec2 p, float cells, float seed, float density) {
  vec2 g = p * cells;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash(id + seed);
  vec2 o = (vec2(hash(id + seed + 1.3), hash(id + seed + 2.7)) - 0.5) * 0.5;
  float d = length(f - o);
  float twinkle = 0.72 + 0.28 * sin(uTime * (0.5 + 1.8 * hash(id + 9.1)) + h * 40.0);
  float rank = (h - (1.0 - density)) / density;   // 0 to 1 among the cells that hold a star
  float light = step(0.0, rank) * (0.2 + 0.8 * rank * rank) * twinkle;
  light *= 0.0012 / (d * d + 0.0012) * smoothstep(0.25, 0.12, d);
  return mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.9, 0.76), hash(id + seed + 4.4)) * light;
}

// The Milky Way seen edge-on: a meandering band of unresolved starlight, brightest and warmest at the
// galactic core, torn down the middle by dark dust lanes, with pinpoint stars crowding toward the band
vec3 milkyWay(vec2 p, vec2 uv, float m) {
  // Band axes: s runs along the band, c across it. The band stands upright in a tall sky and lies down
  // in a wide one, a little tilted either way
  float wide = step(1.5, uRes.x / uRes.y);
  float tilt = mix(0.2, 1.45, wide);
  vec2 q = p + uDrift * 0.12;
  float s = q.x * sin(tilt) + q.y * cos(tilt);
  float c = q.x * cos(tilt) - q.y * sin(tilt);
  c += (fbm(vec2(s * 1.4, 7.3)) - 0.47) * 0.22;           // the band meanders
  float core = exp(-s * s * 5.0);                           // the bulge around the galactic centre
  float w = 0.11 + 0.05 * core;
  float band = exp(-c * c / (w * w));
  float outer = exp(-c * c / (w * w * 7.0));

  // Star clouds: two scales of billowing structure
  vec2 g = vec2(s * 2.2, c * 4.5);
  float big = fbm(g + 2.1);
  float fine = fbm(g * 3.1 + big * 1.8 + 9.4);
  float clouds = band * (0.14 + 0.95 * pow(big * fine * 4.2, 1.6)) + outer * 0.07;

  // Dust lanes: dark filaments that follow the band and fray into branches
  float ridge = 1.0 - abs(2.0 * fbm(vec2(s * 2.6, c * 11.0) + big * 1.5 + 4.2) - 1.0);
  float rift = exp(-pow((c + 0.02 * sin(s * 7.0) + 0.05 * (big - 0.47)) / (w * 0.3), 2.0));
  float dust = clamp(smoothstep(0.55, 0.95, ridge) * (0.3 + rift) + rift * smoothstep(0.4, 0.6, fine) * 0.7, 0.0, 1.0);
  clouds *= 1.0 - 0.9 * dust;

  // Colour: warm gold at the core, cool blue-white along the arms, rust where dust thins the light,
  // and a little rose from glowing gas
  vec3 tone = mix(vec3(0.5, 0.64, 1.0), vec3(1.0, 0.72, 0.42), clamp(core * 0.9 + 0.3 * (big - 0.35), 0.0, 1.0));
  tone = mix(tone, vec3(0.95, 0.5, 0.3), dust * 0.55);
  tone += vec3(0.5, 0.12, 0.3) * smoothstep(0.6, 0.8, fbm(g * 1.7 + 21.0)) * band * 0.5;
  float grain = 0.8 + 0.4 * hash(floor(gl_FragCoord.xy / 1.5));   // unresolved stars, like film grain
  vec3 col = tone * clouds * grain * 0.42;   // kept dark: the galaxy is a backdrop, the three stars are the subject

  // Resolved stars: three sizes, far more of them inside the band, fewer where the dust is
  float crowd = (band + outer * 0.35) * (1.0 - 0.7 * dust);
  col += field(q, m / 9.0, 2.0, 0.05 + 0.5 * crowd) * 0.5;
  col += field(q, m / 20.0, 7.0, 0.1 + 0.3 * crowd) * 0.75;
  col += field(p + uDrift * 0.25, m / 64.0, 1.0, 0.28) * 0.9;

  // Fade out toward the edges of the sky so no frame shows
  // (sooner across the band than along it, so the band runs the length of the sky)
  vec2 e = abs(uv - 0.5) * 2.0;
  vec2 reach = mix(vec2(0.3, 0.55), vec2(0.55, 0.3), wide);
  return col * smoothstep(1.0, reach.x, e.x) * smoothstep(1.0, reach.y, e.y);
}

float link(vec2 p, vec3 a, vec3 b, float px) {
  vec2 pa = p - a.xy, ba = b.xy - a.xy;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float d = length(pa - ba * h);
  float gap = smoothstep(a.z * 1.9, a.z * 2.8, length(pa)) * smoothstep(b.z * 1.9, b.z * 2.8, length(p - b.xy));
  return smoothstep(px * 1.3, 0.0, d) * gap;
}

void main() {
  float m = min(uRes.x, uRes.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / m;
  vec2 uv = gl_FragCoord.xy / uRes;
  float px = 1.0 / m;

  vec3 col = milkyWay(p, uv, m);

  vec3 lineColor = vec3(0.6, 0.72, 1.0);
  col += lineColor * link(p, uStar0, uStar1, px) * (0.14 + 0.14 * max(uFocus.x, uFocus.y)) * uSpread;
  col += lineColor * link(p, uStar1, uStar2, px) * (0.14 + 0.14 * max(uFocus.y, uFocus.z)) * uSpread;

  // Fade to nothing at the canvas edges so the sky has no visible frame
  float edge = smoothstep(0.0, 0.14, uv.x) * smoothstep(1.0, 0.86, uv.x) * smoothstep(0.0, 0.12, uv.y) * smoothstep(1.0, 0.88, uv.y);
  col = (1.0 - exp(-col * 1.5)) * edge;
  gl_FragColor = vec4(col, clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0));
}
`;
