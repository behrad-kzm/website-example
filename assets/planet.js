// Cybernetic planet: a Goldberg sphere of bevelled hexagonal panels, ringed by orbiting binary digits,
// with a small scanner pod that flies above the ring's scanner glow and scans the digits below it.
// Rendered with Three.js into the fixed <canvas data-planet> behind the hero.
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const PALETTE = {
  base: '#050B19',
  dark: '#07172D',
  metal: '#102C59',
  cyan: '#16A9FF',
  blue: '#286BFF',
  violet: '#713DFF',
  purple: '#351A75',
};

export const PLANET_SPEED = 0.035; // rad/s around its own axis
const RING_SPEED = 0.06;    // rad/s, slightly faster than the planet
export const AXIAL_TILT = 0.2;     // ring and planet lean to the right
export const RING_INCLINE = 0.36;  // how far the ring plane tips toward the viewer
const RING_INNER = 1.3, RING_OUTER = 2.08; // ring radii, in planet radii
const SCAN_SPEED = 0.14;   // rad per ring-second: the bright scanner line, and the satellite above it
const SAT_HEIGHT = 0.25;    // how far above the ring plane the satellite flies

function main() {
  const canvas = document.querySelector('[data-planet]');
  if (!canvas) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    canvas.remove();
    return;
  }

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compact = Math.min(innerWidth, innerHeight) < 700;

  // Without a GPU (software WebGL: SwiftShader, llvmpipe, …) every frame blocks the main thread for
  // hundreds of milliseconds, so the planet is drawn once, without bloom, and left as a still.
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const gpuName = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
  const software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpuName);
  let frozen = reduceMotion || software;  // true once the animation loop is off
  const color = (hex) => new THREE.Color(hex);

  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // compress highlights so edges glow without blowing out
  renderer.toneMappingExposure = 0.85;
  renderer.setPixelRatio(Math.min(devicePixelRatio, software ? 1 : compact ? 1.5 : 1.75));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

  const system = new THREE.Group();
  system.rotation.z = AXIAL_TILT;
  scene.add(system);

  const planet = buildPlanet(compact ? 6 : 8);
  system.add(planet.group);

  const ring = buildRing(compact ? 11 : 17, color);
  ring.points.rotation.x = RING_INCLINE;
  system.add(ring.points);

  // The satellite lives in the ring's plane so it can ride exactly above the scanner glow
  const orbit = new THREE.Group();
  orbit.rotation.x = RING_INCLINE;
  system.add(orbit);
  const satellite = buildSatellite(color);
  orbit.add(satellite.group);
  const planetMaterials = planet.group.children.map((mesh) => mesh.material);
  // Post: bloom turns the bevel edges and digits into light
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.3, 0.28);
  bloom.enabled = !software;
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // Layout: planet diameter ≈ 48% of the viewport width, a little above centre
  const fovTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  let distance = 6;
  const layout = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    const diameterPx = w > h ? Math.min(0.48 * w, 0.78 * h) : 0.82 * w;
    distance = h / (diameterPx * fovTan);
    system.position.y = 0.06 * 2 * distance * fovTan;
    ring.uniforms.uScale.value = (h * renderer.getPixelRatio()) / (2 * fovTan);
    camera.updateProjectionMatrix();
    placeCamera();
  };

  // Gentle pointer parallax
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!reduceMotion) {
    addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }
  // Scroll story: as the page scrolls toward the command bar, the camera drifts in and the ring speeds up
  const focus = document.querySelector('[data-planet-focus]');
  const scroll = { p: 0 };
  const scrollTarget = () => {
    if (reduceMotion) return 0;
    const end = focus ? Math.max(focus.offsetTop - innerHeight * 0.4, 1) : innerHeight;
    return THREE.MathUtils.clamp(scrollY / end, 0, 1);
  };
  const ease = (x) => x * x * (3 - 2 * x);

  const placeCamera = () => {
    const d = distance * (1 - 0.28 * ease(scroll.p));
    camera.position.set(pointer.x * 0.09 * d, -pointer.y * 0.06 * d, d);
    camera.lookAt(0, system.position.y, 0);
  };

  const clock = new THREE.Clock();

  // Hit-test the pointer against the planet: returns the planet-space direction, or null
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const planetSphere = new THREE.Sphere(new THREE.Vector3(), 1);
  const hitPoint = new THREE.Vector3();
  const hitPlanet = (clientX, clientY) => {
    ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    planetSphere.center.copy(system.position);
    if (!raycaster.ray.intersectSphere(planetSphere, hitPoint)) return null;
    planet.group.updateMatrixWorld();
    return planet.group.worldToLocal(hitPoint.clone()).normalize();
  };
  // Pointer over a control (nav, buttons, links, the palette) belongs to the page, not the planet
  const overPage = (el) => !!(el && el.closest && el.closest('a, button, input, nav, .cz-glass'));

  const hover = { x: 0, y: 0, inside: false, value: 0 };
  let shockStart = -Infinity;
  // Shockwave timing: the first wave fires 3s after load, then every 30s; a click fires one and restarts the 30s
  const AUTO_FIRST = 3, AUTO_EVERY = 30;
  let autoNext = Infinity;
  let shockRingAngle = 0;
  const fireShock = (dir, t) => {
    planet.uniforms.uShockOrigin.value.copy(dir);
    shockStart = t;
    autoNext = t + AUTO_EVERY;
    // Convert planet-local impact direction to system-space ring-plane angle
    const rot = t * PLANET_SPEED;
    shockRingAngle = Math.atan2(
      dir.x * Math.sin(rot) + dir.z * Math.cos(rot),
      dir.x * Math.cos(rot) - dir.z * Math.sin(rot)
    );
  };
  // Auto waves start on the lit face turned toward the viewer, a little above centre
  const autoOrigin = new THREE.Vector3();
  const facingPoint = () => {
    planet.group.updateMatrixWorld();
    planet.group.worldToLocal(autoOrigin.copy(camera.position));
    autoOrigin.normalize();
    autoOrigin.y += 0.35;
    return autoOrigin.normalize();
  };
  if (!reduceMotion) {
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      hover.x = e.clientX; hover.y = e.clientY;
      hover.inside = !overPage(e.target);
    }, { passive: true });
    document.addEventListener('pointerleave', () => { hover.inside = false; });
    addEventListener('pointerdown', (e) => {
      if (overPage(e.target)) return;
      const dir = hitPlanet(e.clientX, e.clientY);
      if (!dir) return;
      fireShock(dir, clock.getElapsedTime());
    });
  }

  let ringTime = 12, last = 0;
  const render = () => {
    const t = reduceMotion ? 12 : clock.getElapsedTime();
    const dt = Math.min(t - last, 0.1); last = t;
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    scroll.p += (scrollTarget() - scroll.p) * 0.08;
    placeCamera();
    camera.updateMatrixWorld();
    planet.group.rotation.y = t * PLANET_SPEED;
    planet.uniforms.uTime.value = t;

    // Hover: follow the point under the cursor (it moves as the planet turns), ease the pulse in and out
    const dir = hover.inside && !frozen ? hitPlanet(hover.x, hover.y) : null;
    if (dir) {
      const p = planet.uniforms.uPointer.value.lerp(dir, 0.25);
      if (p.lengthSq() < 1e-6) p.copy(dir); else p.normalize();
    }
    hover.value += ((dir ? 1 : 0) - hover.value) * 0.08;
    planet.uniforms.uHover.value = hover.value;
    document.documentElement.style.cursor = dir ? 'pointer' : '';
    if (!reduceMotion && t >= autoNext) fireShock(facingPoint(), t);
    planet.uniforms.uShockAge.value = t - shockStart;

    // The ring runs on its own clock so scrolling can speed it up
    ringTime += dt * (1 + 2.5 * ease(scroll.p));
    ring.uniforms.uPlanet.value.copy(system.position).applyMatrix4(camera.matrixWorldInverse);
    ring.uniforms.uTime.value = reduceMotion ? 12 : ringTime;
    ring.uniforms.uShockAge.value = t - shockStart;
    ring.uniforms.uShockAngle.value = shockRingAngle;
    // The glow in the ring under the craft is the scan itself: it is lit only while the beam is on
    ring.uniforms.uScan.value = satellite.update(reduceMotion ? 12 : ringTime, t, frozen);
    // Two passes. First the planet, the ring and the scan beam, through the bloom. Then the pod alone,
    // straight to the screen: bloom would smear its fine detail, and the screen is antialiased where the
    // bloom's buffers are not. The planet is redrawn into the depth buffer only, so it still hides the pod.
    satellite.body.visible = false;
    composer.render();
    satellite.body.visible = true;
    satellite.beams.visible = ring.points.visible = false;
    for (const m of planetMaterials) m.colorWrite = false;
    renderer.setRenderTarget(null);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.autoClear = true;
    for (const m of planetMaterials) m.colorWrite = true;
    satellite.beams.visible = ring.points.visible = true;
  };

  // The planet belongs to the top of the page. From the section marked [data-planet-end] downward it is
  // not shown: that section is opaque and slides over it, and once its top reaches the top of the window
  // the canvas is hidden and no longer drawn.
  const end = document.querySelector('[data-planet-end]');
  let covered = false;
  const checkCovered = () => {
    const now = !!end && end.getBoundingClientRect().top <= 0;
    if (now === covered) return;
    covered = now;
    canvas.style.visibility = covered ? 'hidden' : '';
    if (!covered && frozen) render();
  };
  addEventListener('scroll', checkCovered, { passive: true });

  layout();
  render();
  checkCovered();
  canvas.classList.add('is-ready');
  autoNext = clock.getElapsedTime() + AUTO_FIRST;
  addEventListener('resize', () => { layout(); if (frozen) render(); });

  if (!frozen) {
    // Quality governor: watch the real frame rate and shed work on devices that can't keep up.
    // Step 1 drops to 1x resolution, step 2 turns bloom off, step 3 stops animating and keeps a still.
    const SLOW_MS = 40, HOPELESS_MS = 150, WARMUP = 2, WINDOW = 30;
    let tier = 0, frames = -WARMUP, total = 0, prev = 0;
    const degrade = (toStill) => {
      tier = toStill ? 3 : tier + 1;
      if (tier === 1) { renderer.setPixelRatio(1); composer.setPixelRatio(1); layout(); }
      else if (tier === 2) bloom.enabled = false;
      else { frozen = true; render(); }
      frames = -2; total = 0;
    };
    const loop = (now) => {
      if (frozen) return;
      const delta = now - prev; prev = now;
      if (!covered) render();
      if (delta > 0 && delta < 1000) {  // skip the first frame and gaps from a hidden tab
        if (frames >= 0) total += delta;
        frames++;
        if (frames >= 2 && total / frames > HOPELESS_MS) degrade(true);
        else if (frames >= WINDOW) {
          if (total / frames > SLOW_MS) degrade(false);
          else { frames = 0; total = 0; }
        }
      }
      if (!frozen) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// ───────────── Planet ─────────────

// Dual of a geodesic icosphere: one cell per vertex, its corners at the centroids of the surrounding faces.
// Gives ~10(n+1)² + 2 cells: all hexagons except 12 pentagons.
function goldbergCells(detail) {
  let ico = new THREE.IcosahedronGeometry(1, detail);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  ico = mergeVertices(ico);

  const pos = ico.attributes.position;
  const index = ico.index;
  const verts = [];
  for (let i = 0; i < pos.count; i++) verts.push(new THREE.Vector3().fromBufferAttribute(pos, i).normalize());

  const faceCenters = [];
  const vertFaces = verts.map(() => []);
  for (let f = 0; f < index.count / 3; f++) {
    const a = index.getX(f * 3), b = index.getX(f * 3 + 1), c = index.getX(f * 3 + 2);
    faceCenters.push(new THREE.Vector3().add(verts[a]).add(verts[b]).add(verts[c]).normalize());
    vertFaces[a].push(f); vertFaces[b].push(f); vertFaces[c].push(f);
  }

  return verts.map((n, i) => {
    const t = faceCenters[vertFaces[i][0]].clone().sub(n.clone().multiplyScalar(faceCenters[vertFaces[i][0]].dot(n))).normalize();
    const b = n.clone().cross(t);
    const corners = vertFaces[i]
      .map((f) => faceCenters[f])
      .map((c) => ({ c, a: Math.atan2(c.dot(b), c.dot(t)) }))
      .sort((p, q) => p.a - q.a)
      .map((p) => p.c);
    return { center: n, corners };
  });
}

// Shared GLSL: smooth 3D value noise and the mask for where light leaks out of the gaps
const LEAK_GLSL = /* glsl */`
  uniform float uTime;
  uniform vec3 uLeak;
  float leakHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float valueNoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(leakHash(i), leakHash(i + vec3(1, 0, 0)), f.x),
                   mix(leakHash(i + vec3(0, 1, 0)), leakHash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(leakHash(i + vec3(0, 0, 1)), leakHash(i + vec3(1, 0, 1)), f.x),
                   mix(leakHash(i + vec3(0, 1, 1)), leakHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  // A few soft regions of the sphere, drifting and breathing very slowly
  float leakMask(vec3 dir) {
    float n = valueNoise(dir * 2.2 + vec3(0.0, uTime * 0.02, 0.0)) * 0.65 + valueNoise(dir * 4.7) * 0.35;
    float breathe = 0.8 + 0.2 * sin(uTime * 0.35 + n * 6.0);
    return smoothstep(0.45, 0.76, n) * breathe;
  }
`;
const LEAK_COLOR = '#2f6bff'; // space blue

// Shared GLSL: how strongly a point on the sphere reacts to the pointer (hover) and to a click (shockwave)
const REACT_GLSL = /* glsl */`
  uniform vec3 uPointer;      // planet-space direction under the pointer
  uniform float uHover;       // 0..1, eased in while the pointer is over the planet
  uniform vec3 uShockOrigin;  // planet-space direction of the last click
  uniform float uShockAge;    // seconds since that click (large when idle)
  float hoverAt(vec3 dir) {
    return uHover * (1.0 - smoothstep(0.0, 0.32, distance(dir, uPointer)));
  }
  float shockAt(vec3 dir) {
    float ang = acos(clamp(dot(dir, uShockOrigin), -1.0, 1.0));
    float front = uShockAge * 1.4;                       // radians per second across the sphere
    float x = (ang - front) / 0.14;
    float band = exp(-x * x);  // x*x, not pow(): pow() is undefined for a negative base in GLSL
    return band * (1.0 - smoothstep(1.2, 2.6, uShockAge));
  }
`;

export function buildPlanet(detail) {
  const cells = goldbergCells(detail);
  const positions = [], normals = [], edges = [], seeds = [], cellDirs = [], tops = [], lifts = [], moves = [];
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), nrm = new THREE.Vector3();

  // One triangle; `t` gives each vertex's top flag (1 = moves with the panel when it rises, 0 = stays at the base)
  const tri = (a, b, c, t, edge, cell) => {
    tmpA.subVectors(b, a); tmpB.subVectors(c, a);
    nrm.crossVectors(tmpA, tmpB).normalize();
    [a, b, c].forEach((v, i) => {
      positions.push(v.x, v.y, v.z);
      normals.push(nrm.x, nrm.y, nrm.z);
      edges.push(edge);
      tops.push(t[i]);
      seeds.push(cell.seed);
      lifts.push(cell.lift);
      moves.push(cell.move);
      cellDirs.push(cell.c.x, cell.c.y, cell.c.z);
    });
  };
  const towards = (c, p, k, r) => c.clone().add(p.clone().sub(c).multiplyScalar(k)).normalize().multiplyScalar(r);

  for (const { center: c, corners } of cells) {
    const seed = Math.random();
    const cell = {
      c,
      seed,
      lift: Math.random() < 0.14 ? 0.004 + Math.random() * 0.012 : 0,   // some panels sit a little proud
      move: Math.random() < 0.05 ? (0.025 + Math.random() * 0.035) * 0.8 : 0,   // a few slowly rise and settle
    };
    const m = corners.length;
    const outer = corners.map((p) => towards(c, p, 0.955, 0.995));  // bevel foot, at the gap
    const inner = corners.map((p) => towards(c, p, 0.915, 1.0));    // bevel crest
    const base = corners.map((p) => towards(c, p, 0.955, 0.93));    // prism walls run down to here
    const apex = c.clone();                                          // flat cap

    for (let k = 0; k < m; k++) {
      const k1 = (k + 1) % m;
      tri(apex, inner[k], inner[k1], [1, 1, 1], 0, cell);
      tri(outer[k], outer[k1], inner[k1], [1, 1, 1], 1, cell);
      tri(outer[k], inner[k1], inner[k], [1, 1, 1], 1, cell);
      tri(outer[k], base[k1], outer[k1], [1, 0, 1], 0, cell);
      tri(outer[k], base[k], base[k1], [1, 0, 0], 0, cell);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('aEdge', new THREE.Float32BufferAttribute(edges, 1));
  geo.setAttribute('aTop', new THREE.Float32BufferAttribute(tops, 1));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  geo.setAttribute('aLift', new THREE.Float32BufferAttribute(lifts, 1));
  geo.setAttribute('aMove', new THREE.Float32BufferAttribute(moves, 1));
  geo.setAttribute('aCell', new THREE.Float32BufferAttribute(cellDirs, 3));
  geo.computeBoundingSphere();
  geo.boundingSphere.radius += 0.08;

  const uniforms = {
    uTime: { value: 0 },
    uAlbedo: { value: new THREE.Color('#141517') },                // matte black
    uDust: { value: new THREE.Color('#34332f') },                  // dim grey dust settled on the caps
    uLight: { value: new THREE.Vector3(0.15, 1.0, 0.1).normalize() }, // the one light: overhead, a touch right and forward
    uLeak: { value: new THREE.Color(LEAK_COLOR) },
    uPointer: { value: new THREE.Vector3(0, 0, 1) },
    uHover: { value: 0 },
    uShockOrigin: { value: new THREE.Vector3(0, 0, 1) },
    uShockAge: { value: 99 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      uniform float uTime;
      attribute float aEdge;
      attribute float aTop;
      attribute float aSeed;
      attribute float aLift;
      attribute float aMove;
      attribute vec3 aCell;
      varying vec3 vN;
      varying vec3 vCellN;
      varying vec3 vWPos;
      varying float vEdge;
      varying float vTop;
      varying float vRise;
      varying float vReact;
      varying vec3 vLPos;
      varying float vSeed;
      ${REACT_GLSL}
      void main() {
        // Rising panels: ease out, hold, ease back, each on its own slow cycle
        float cycle = 0.5 + 0.5 * sin(uTime * 0.45 + aSeed * 50.0);
        float rise = smoothstep(0.15, 0.85, cycle);
        float lift = aLift + aMove * rise;
        vRise = aMove > 0.0 ? rise : 0.0;  // 0 at rest, 1 fully out (moving panels only)

        // The surface senses the pointer and rings with a click
        float hover = hoverAt(aCell);
        float shock = shockAt(aCell);
        lift += hover * 0.022 + shock * 0.035;
        vReact = hover * 0.8 + shock * 1.2;

        vec3 p = position + aCell * lift * aTop;
        vLPos = position;  // object space, so the texture turns with the planet
        vSeed = aSeed;

        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWPos = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vCellN = normalize(mat3(modelMatrix) * aCell);
        vEdge = aEdge;
        vTop = aTop;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uAlbedo;
      uniform vec3 uDust;
      uniform vec3 uLight;
      ${LEAK_GLSL}
      varying vec3 vLPos;
      varying float vSeed;
      varying vec3 vN;
      varying vec3 vCellN;
      varying vec3 vWPos;
      varying float vEdge;
      varying float vTop;
      varying float vRise;
      varying float vReact;
      void main() {
        vec3 N = normalize(vN);
        vec3 C = normalize(vCellN);
        vec3 V = normalize(cameraPosition - vWPos);

        // Matte black surface under one overhead light: soft diffuse, no gloss, no glow
        float diffuse = pow(max(dot(N, uLight), 0.0), 1.6);  // steep falloff: light dies quickly away from the top

        // Plain matte black: no texture, no gloss
        vec3 surface = uAlbedo;

        // Powdery surfaces scatter a soft haze at grazing angles instead of a glossy highlight
        float haze = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0) * 0.015 * diffuse;

        // Occlusion: prism walls darken toward the base, the bevel catches a touch more light
        float ao = mix(0.06, 1.0, vTop);
        vec3 col = (surface * diffuse * (1.0 + 0.25 * vEdge) + uDust * haze) * ao;

        // The planet shadows itself: everything below the upper crown fades to black
        col *= smoothstep(0.1, 0.65, dot(C, uLight));  // only the crown catches light

        col *= 2.2;  // overall planet brightness

        // Space-blue light leaking from the gaps in a few regions: it rises up the prism walls from the
        // core and barely touches the bevels. Emissive, so it shows faintly even on the shadowed side.
        // Leaks on the shadowed side are kept softer so they don't float in the dark without context
        float leak = leakMask(normalize(vLPos)) * mix(0.45, 1.0, smoothstep(-0.2, 0.3, dot(C, uLight)));
        float fromGap = pow(clamp(1.0 - vTop, 0.0, 1.0), 1.6) * (1.0 - vEdge) + vEdge * 0.1;  // glow climbs the walls and spills onto the bevels
        // A panel rising out opens its gap: the light swells with the rise and settles back as it returns
        float glow = leak + vRise * 1.6 + vReact * 1.4;
        col += uLeak * glow * (fromGap + (vRise + vReact) * vEdge * 0.12) * 2.3;

        // Safety net: a NaN pixel would be smeared by the bloom pass into a black block. NaN fails every comparison.
        if (!(col.r >= 0.0 && col.g >= 0.0 && col.b >= 0.0)) col = vec3(0.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, material));
  // Core seen through the gaps: black, glowing a soft space blue where the leak mask is open
  const core = new THREE.ShaderMaterial({
    uniforms: {
      uTime: uniforms.uTime, uLeak: uniforms.uLeak,
      uPointer: uniforms.uPointer, uHover: uniforms.uHover,
      uShockOrigin: uniforms.uShockOrigin, uShockAge: uniforms.uShockAge,
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      ${LEAK_GLSL}
      ${REACT_GLSL}
      varying vec3 vDir;
      void main() {
        float glow = leakMask(vDir) + hoverAt(vDir) * 0.6 + shockAt(vDir) * 1.2;
        if (!(glow >= 0.0)) glow = 0.0;  // NaN guard (see the panels shader)
        gl_FragColor = vec4(uLeak * glow * 2.8, 1.0);
      }`,
  });
  group.add(new THREE.Mesh(new THREE.SphereGeometry(0.94, 64, 48), core));
  return { group, uniforms };
}

// ───────────── Binary ring ─────────────

export function digitAtlas() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // The digits use the site's text face. Until it has loaded they are drawn in the fallback, then redrawn.
  const FONT = '700 50px "Inter Tight", Inter, system-ui, sans-serif';
  const draw = () => {
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.font = FONT;
    ctx.fillText('0', 32, 34);
    ctx.fillText('1', 96, 34);
  };
  draw();
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  if (document.fonts && document.fonts.load) document.fonts.load(FONT, '01').then(() => { draw(); tex.needsUpdate = true; }).catch(() => {});
  return tex;
}

// `coarse` (default 1) spaces the digits out and enlarges them by that factor, for a ring drawn small
// (the miniature planet in "What we do", assets/what-we-do-sky.js)
export function buildRing(laneCount, color, coarse = 1) {
  const angle = [], radius = [], height = [], speed = [], phase = [], size = [], lane = [];
  const inner = RING_INNER, outer = RING_OUTER;

  for (let l = 0; l < laneCount; l++) {
    const r = inner + (l / (laneCount - 1)) * (outer - inner) + (Math.random() - 0.5) * 0.02;
    const spacing = (0.026 + Math.random() * 0.012) * coarse;
    const count = Math.floor((Math.PI * 2 * r) / spacing);
    const run = (18 + Math.random() * 50) / coarse; // digits per dashed run
    const gap = 0.08 + Math.random() * 0.25;      // fraction of each run left empty
    const laneSpeed = RING_SPEED * (1.2 - (r - inner) * 0.35);
    const laneSize = (0.028 + Math.random() * 0.012) * coarse;
    for (let i = 0; i < count; i++) {
      if ((i / run) % 1 < gap) continue;
      angle.push((i / count) * Math.PI * 2);
      radius.push(r + (Math.random() - 0.5) * 0.006);
      height.push((Math.random() - 0.5) * 0.012);
      speed.push(laneSpeed);
      phase.push(Math.random());
      size.push(laneSize * (0.8 + Math.random() * 0.4));
      lane.push(l);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(angle.length * 3), 3));
  geo.setAttribute('aAngle', new THREE.Float32BufferAttribute(angle, 1));
  geo.setAttribute('aRadius', new THREE.Float32BufferAttribute(radius, 1));
  geo.setAttribute('aHeight', new THREE.Float32BufferAttribute(height, 1));
  geo.setAttribute('aSpeed', new THREE.Float32BufferAttribute(speed, 1));
  geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  geo.setAttribute('aLane', new THREE.Float32BufferAttribute(lane, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), outer + 0.1);

  const uniforms = {
    uTime: { value: 0 },
    uScale: { value: 500 },
    uPlanet: { value: new THREE.Vector3() },   // planet centre in view space, for soft occlusion
    uAtlas: { value: digitAtlas() },
    uCyan: { value: color(PALETTE.cyan) },
    uBlue: { value: color(PALETTE.blue) },
    uViolet: { value: color(PALETTE.violet) },
    uShockAge: { value: 99 },
    uShockAngle: { value: 0 },
    uScan: { value: 1 },   // strength of the scanner glow, 0 to 1
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,  // occlusion by the planet is computed per digit in the shader, with a soft edge
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aAngle, aRadius, aHeight, aSpeed, aPhase, aSize, aLane;
      uniform float uTime, uScale;
      uniform float uShockAge, uShockAngle, uScan;
      uniform vec3 uPlanet;
      uniform vec3 uCyan, uBlue, uViolet;
      varying vec3 vColor;
      varying float vDigit;
      varying float vAlpha;
      float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
      // Shortest angular distance, result in [0, PI]
      float angDist(float a, float b) { return abs(mod(a - b + 9.42478, 6.28318) - 3.14159); }
      void main() {
        float a = aAngle + uTime * aSpeed;

        // Shockwave ring pulse: computed early so it can drive position
        float dShock = angDist(a, uShockAngle);
        float shockFront = uShockAge * 2.2;
        float xSh = (dShock - shockFront) / 0.28;
        float shock = exp(-xSh * xSh) * max(0.0, 1.0 - uShockAge * 0.26);

        // Normal state is flat (Saturn). When the pulse fires the wave peak
        // rides with the glow band — digits at the crest lift, then settle back.
        float waveY = shock * 0.10;

        vec3 p = vec3(cos(a) * aRadius, aHeight + waveY, sin(a) * aRadius);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * (1.0 + shock * 0.45) * uScale / -mv.z;

        // Scanner beam: rotating bright line that sweeps the ring
        float scanAngle = mod(uTime * ${SCAN_SPEED.toFixed(3)}, 6.28318);
        float dScan = angDist(a, scanAngle);
        float scan = exp(-dScan * dScan * 22.0) * uScan;

        // Aurora: a wide slow colour band drifting around the ring independently
        float auroraAngle = mod(uTime * 0.09, 6.28318);
        float dAurora = angDist(a, auroraAngle);
        float aurora = exp(-dAurora * dAurora * 0.55);

        // Digits under the scanner flip rapidly — looks like live data reading
        float flipRate = 0.45 + scan * 7.0;
        vDigit = step(0.5, hash(aPhase * 91.7 + floor(uTime * flipRate + aPhase * 13.0)));

        vec3 c = mix(uCyan, uBlue, smoothstep(0.0, 0.7, hash(aLane + 3.1)));
        c = mix(c, uViolet, smoothstep(0.55, 1.0, hash(aPhase * 7.0 + aLane)));
        float front = smoothstep(-0.3, 1.0, sin(a));
        float twinkle = 0.65 + 0.35 * sin(uTime * 2.2 + aPhase * 60.0);

        // Scanner lifts digits toward white-cyan
        c = mix(c, vec3(0.75, 1.0, 1.0), scan * 0.8);
        // Aurora tints toward violet-magenta
        c = mix(c, uViolet * 1.6, aurora * 0.55);
        // Shock pulse saturates to bright cyan
        c = mix(c, uCyan * 2.2, shock * 0.9);

        // Soft occlusion: digits behind the planet fade instead of hard-clipping
        vec3 toPoint = mv.xyz;
        float pointDist = length(toPoint);
        vec3 ray = toPoint / pointDist;
        float along = dot(uPlanet, ray);
        float miss = length(uPlanet - ray * along);
        float behind = smoothstep(-0.15, 0.15, pointDist - along);
        float visible = 1.0 - behind * (1.0 - smoothstep(0.92, 1.12, miss));

        vColor = c;
        float baseAlpha = (0.3 + 0.7 * front) * twinkle * (0.55 + 0.45 * hash(aLane * 1.7)) * visible;
        vAlpha = baseAlpha * (1.0 + scan * 1.8 + aurora * 0.45) + shock * 1.1 * visible;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uAtlas;
      varying vec3 vColor;
      varying float vDigit;
      varying float vAlpha;
      void main() {
        vec2 uv = vec2(gl_PointCoord.x * 0.5 + vDigit * 0.5, 1.0 - gl_PointCoord.y);
        float glyph = texture2D(uAtlas, uv).a;
        if (glyph < 0.03) discard;
        gl_FragColor = vec4(vColor * vAlpha * 1.15, glyph);
      }`,
  });

  return { points: new THREE.Points(geo, material), uniforms };
}

// ───────────── Scanner satellite ─────────────

// A small scanner pod: a white, heavily panelled sphere in the manner of hard-surface spacecraft.
// With its thruster pods it is about a quarter of the ring's width across. It is lit from below, by the ring. Layered armour plates stand off the hull, an amber
// window looks forward, two engine blocks sit at the back, a thruster pod hangs on struts at each side,
// and the scanner sits underneath, facing the ring. The paint (panel lines, hatches, vents, rivets,
// markings, grime) and its relief are drawn into canvases here, so nothing is downloaded.
// Its local y axis is the ring's normal, x points away from the planet, z is the direction of flight.

// Small repeatable random generator, so the paint and its relief are drawn with the same numbers
function seeded(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Armour plates, in the hull's texture coordinates: u runs around the hull (0.5 = nose, 0.25 and 0.75 =
// the two sides, 0 and 1 = tail), v runs from the top (0) to the bottom (1). `lift` is how far the plate
// stands off the hull, in hull radii; `cut` and `cutB` slope its top and bottom corners.
const PLATES = [
  { u0: 0, u1: 1, v0: 0, v1: 0.125, lift: 0.035 },                                // crown
  { u0: 0.37, u1: 0.63, v0: 0.16, v1: 0.265, lift: 0.05, cut: 0.12 },             // brow over the window
  { u0: 0.345, u1: 0.395, v0: 0.275, v1: 0.455, lift: 0.045 },                    // window frame, left
  { u0: 0.605, u1: 0.655, v0: 0.275, v1: 0.455, lift: 0.045 },                    // window frame, right
  { u0: 0.33, u1: 0.67, v0: 0.455, v1: 0.505, lift: 0.075 },                      // sill
  { u0: 0.40, u1: 0.60, v0: 0.525, v1: 0.80, lift: 0.04, cutB: 0.18 },            // chest
  { u0: 0.335, u1: 0.39, v0: 0.53, v1: 0.74, lift: 0.03 },                        // cheeks
  { u0: 0.61, u1: 0.665, v0: 0.53, v1: 0.74, lift: 0.03 },
  { u0: 0.13, u1: 0.33, v0: 0.30, v1: 0.63, lift: 0.04, cut: 0.1, cutB: 0.15 },   // shoulders
  { u0: 0.67, u1: 0.87, v0: 0.30, v1: 0.63, lift: 0.04, cut: 0.1, cutB: 0.15 },
  { u0: 0.87, u1: 1.13, v0: 0.33, v1: 0.67, lift: 0.035, cut: 0.08 },             // engine backplate
  { u0: 0.90, u1: 1.10, v0: 0.17, v1: 0.30, lift: 0.04, cutB: 0.15 },             // tail hood
  { u0: 0, u1: 1, v0: 0.815, v1: 0.86, lift: 0.025 },                             // belt
];
const WINDOW = { u0: 0.395, u1: 0.605, v0: 0.285, v1: 0.455, lift: 0.012, local: true };
// How far a plate's side edges pull in at height t (0 top, 1 bottom), as a fraction of its width
const plateInset = (p, t) => (p.cut || 0) * Math.max(0, 1 - t / 0.3) + (p.cutB || 0) * Math.max(0, (t - 0.7) / 0.3);

// Paints the hull into a 2048x1024 drawing space: the colours when `relief` is false, the height map
// (mid grey = hull level, lighter = raised, darker = recessed) when it is true.
function paintHull(ctx, relief) {
  const W = 2048, H = 1024;
  const rnd = seeded(11);
  const pick = (paint, height) => (relief ? height : paint);
  ctx.fillStyle = pick('#d7d9de', '#808080');
  ctx.fillRect(0, 0, W, H);

  // Skin panels: bands of latitude, each split into panels of uneven width and slightly different white
  const bands = [0, 0.13, 0.28, 0.5, 0.66, 0.8, 0.9, 1];
  const counts = [6, 8, 10, 11, 10, 8, 5];
  ctx.lineWidth = pick(3, 5);
  for (let b = 0; b < counts.length; b++) {
    const n = counts[b], y0 = bands[b] * H, y1 = bands[b + 1] * H;
    const cuts = [];
    for (let k = 0; k <= n; k++) cuts.push(((k + (k && k < n ? (rnd() - 0.5) * 0.5 : 0)) / n) * W);
    for (let k = 0; k < n; k++) {
      const g = 204 + Math.floor(rnd() * 28);
      ctx.fillStyle = pick(`rgb(${g},${g + 1},${g + 5})`, '#808080');
      ctx.fillRect(cuts[k], y0, cuts[k + 1] - cuts[k], y1 - y0);
      ctx.strokeStyle = pick('rgba(22,24,32,0.8)', '#000');
      ctx.strokeRect(cuts[k], y0, cuts[k + 1] - cuts[k], y1 - y0);
    }
  }

  // Everything from here on is drawn three times, shifted by a full turn, so it wraps across the seam
  const wrapped = (draw) => {
    for (const dx of [-W, 0, W]) { ctx.save(); ctx.translate(dx, 0); draw(); ctx.restore(); }
  };
  const round = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.lineTo(x + w, y + r); ctx.lineTo(x + w, y + h - r);
    ctx.lineTo(x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.lineTo(x, y + h - r); ctx.lineTo(x, y + r);
    ctx.closePath();
  };

  // Hatches and access panels scattered over the skin, some with a grab handle
  const hatches = [];
  for (let i = 0; i < 34; i++) {
    hatches.push({ x: rnd() * W, y: (0.15 + rnd() * 0.72) * H, w: 50 + rnd() * 120, h: 34 + rnd() * 80, handle: rnd() < 0.4 });
  }
  wrapped(() => {
    for (const h of hatches) {
      round(h.x, h.y, h.w, h.h, 9);
      ctx.fillStyle = pick('rgba(255,255,255,0.10)', '#8c8c8c'); ctx.fill();
      ctx.lineWidth = pick(2, 3.5);
      ctx.strokeStyle = pick('rgba(26,28,36,0.75)', '#101010'); ctx.stroke();
      if (h.handle) {
        ctx.fillStyle = pick('#2a2c34', '#c8c8c8');
        ctx.fillRect(h.x + h.w * 0.5 - 9, h.y + h.h - 14, 18, 5);
      }
    }
  });

  // The armour plates: a lighter face, a hard line at the edge and a soft shadow around it
  wrapped(() => {
    for (const p of PLATES) {
      const x0 = p.u0 * W, x1 = p.u1 * W, y0 = p.v0 * H, y1 = p.v1 * H, w = x1 - x0, h = y1 - y0;
      const top = plateInset(p, 0) * w, bottom = plateInset(p, 1) * w;
      ctx.beginPath();
      ctx.moveTo(x0 + top, y0); ctx.lineTo(x1 - top, y0); ctx.lineTo(x1, y0 + (top ? 0.3 * h : 0));
      ctx.lineTo(x1, y1 - (bottom ? 0.3 * h : 0)); ctx.lineTo(x1 - bottom, y1); ctx.lineTo(x0 + bottom, y1);
      ctx.lineTo(x0, y1 - (bottom ? 0.3 * h : 0)); ctx.lineTo(x0, y0 + (top ? 0.3 * h : 0));
      ctx.closePath();
      ctx.fillStyle = pick('rgba(236,237,241,0.7)', '#989898'); ctx.fill();
      if (!relief) { ctx.lineWidth = 18; ctx.strokeStyle = 'rgba(10,12,22,0.22)'; ctx.stroke(); }
      ctx.lineWidth = 4; ctx.strokeStyle = pick('rgba(14,16,24,0.85)', '#000'); ctx.stroke();
    }
  });

  // Vents: stacks of dark slots
  const vents = [
    [0.445, 0.60, 7], [0.555, 0.60, 7], [0.36, 0.63, 5], [0.64, 0.63, 5],         // chest and cheeks
    [0.20, 0.70, 6], [0.80, 0.70, 6], [0.07, 0.50, 8], [0.93, 0.50, 8],           // sides, beside the engines
    [0.30, 0.20, 4], [0.70, 0.20, 4], [0.5, 0.875, 5], [0.0, 0.76, 6],
  ];
  wrapped(() => {
    ctx.fillStyle = pick('#131419', '#1c1c1c');
    for (const [u, v, n] of vents) {
      for (let i = 0; i < n; i++) { round(u * W - 24, v * H + i * 13, 48, 7, 3); ctx.fill(); }
    }
    // Long grooves over the crown, at the nose and at the tail
    for (const u of [0.47, 0.5, 0.53, 0.97, 1.0, 1.03]) { round(u * W - 5, 0.03 * H, 10, 0.085 * H, 5); ctx.fill(); }
  });

  // Rivets along the band seams
  ctx.fillStyle = pick('rgba(70,72,84,0.85)', '#b4b4b4');
  for (const v of bands.slice(1, -1)) {
    for (let x = 11; x < W; x += 22) {
      ctx.beginPath(); ctx.arc(x, v * H - 9, 2.1, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.arc(x, v * H + 9, 2.1, 0, 6.3); ctx.fill();
    }
  }

  if (relief) return;

  // Markings
  wrapped(() => {
    ctx.fillStyle = '#1a1c24';
    ctx.textBaseline = 'middle';
    ctx.font = '800 46px "Inter Tight", Inter, system-ui, sans-serif';
    for (const [u, v] of [[0.567, 0.60], [0.235, 0.50], [0.765, 0.50], [0.0, 0.725]]) {
      ctx.textAlign = 'center';
      ctx.fillText('CZ-01', u * W, v * H);
      for (let i = 0; i < 3; i++) ctx.fillRect(u * W - 62, v * H + 30 + i * 6, 124 - i * 34, 2);  // small print
    }
    ctx.font = '700 19px "Inter Tight", Inter, system-ui, sans-serif';
    ctx.fillText('C O L O N A I Z', 0.5 * W, 0.215 * H);
    ctx.fillText('SCAN UNIT', 0.5 * W, 0.84 * H);

    // Amber: a line under the sill, warning triangles by the thruster pods, hazard bars under the engines
    ctx.fillStyle = '#f0a31c';
    ctx.fillRect(0.34 * W, 0.512 * H, 0.32 * W, 4);
    for (const u of [0.25, 0.75]) {
      const x = u * W, y = 0.385 * H;
      ctx.beginPath(); ctx.moveTo(x - 20, y - 16); ctx.lineTo(x + 20, y - 16); ctx.lineTo(x, y + 18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1a1c24'; ctx.fillRect(x - 2, y - 10, 4, 12); ctx.fillStyle = '#f0a31c';
    }
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = i % 2 ? '#1a1c24' : '#f0a31c';
      ctx.fillRect((0.9 + i * 0.0091) * W, 0.69 * H, 0.0091 * W, 12);
    }
    // Red arrows pointing at the engines
    ctx.fillStyle = '#d2312b';
    for (const u of [0.915, 1.085]) {
      const x = u * W, y = 0.36 * H;
      ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.lineTo(x, y + 13); ctx.closePath(); ctx.fill();
    }
  });

  // Grime: faint streaks running down from the seams, and specks
  for (let i = 0; i < 260; i++) {
    const y = bands[1 + Math.floor(rnd() * 5)] * H;
    ctx.fillStyle = `rgba(40,42,52,${0.03 + rnd() * 0.05})`;
    ctx.fillRect(rnd() * W, y, 2 + rnd() * 5, 24 + rnd() * 120);
  }
  ctx.fillStyle = 'rgba(30,32,42,0.07)';
  for (let i = 0; i < 2600; i++) ctx.fillRect(rnd() * W, rnd() * H, 1.5, 1.5);
}

// One face of a boxy part: a framed panel with an inset and two slots (colours, or relief)
function paintBox(ctx, relief) {
  const pick = (paint, height) => (relief ? height : paint);
  ctx.fillStyle = pick('#d3d5da', '#808080'); ctx.fillRect(0, 0, 256, 256);
  ctx.lineWidth = 5; ctx.strokeStyle = pick('rgba(20,22,30,0.8)', '#000'); ctx.strokeRect(12, 12, 232, 232);
  ctx.fillStyle = pick('#e1e2e6', '#959595'); ctx.fillRect(30, 30, 196, 120);
  ctx.lineWidth = 3; ctx.strokeRect(30, 30, 196, 120);
  ctx.fillStyle = pick('#17181d', '#202020');
  for (let i = 0; i < 4; i++) ctx.fillRect(44, 172 + i * 14, 70, 7);
  ctx.fillStyle = pick('#f0a31c', '#808080'); ctx.fillRect(150, 176, 62, 8);
  ctx.fillStyle = pick('rgba(70,72,84,0.85)', '#b4b4b4');
  for (const [x, y] of [[22, 22], [234, 22], [22, 234], [234, 234]]) { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 6.3); ctx.fill(); }
}

// The cabin seen through the window: warm light, seats and a console in silhouette, a streak of reflection
function paintWindow(ctx) {
  const W = 512, H = 256;
  const glow = ctx.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.5, W * 0.6);
  glow.addColorStop(0, '#ffc463'); glow.addColorStop(0.55, '#e8891f'); glow.addColorStop(1, '#8a3f08');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(70,28,4,0.75)';
  ctx.fillRect(0, H * 0.74, W, H * 0.26);                              // console across the bottom
  for (const x of [0.2, 0.8]) ctx.fillRect(x * W - 46, H * 0.3, 92, H * 0.5);  // two seat backs
  ctx.fillRect(W * 0.5 - 6, 0, 12, H * 0.34);                          // overhead strut
  ctx.fillStyle = 'rgba(110,48,8,0.8)';
  for (const x of [0.2, 0.8]) ctx.fillRect(x * W - 30, H * 0.18, 60, H * 0.14);  // head rests
  ctx.fillStyle = '#fff0b8';
  ctx.fillRect(W * 0.5 - 44, H * 0.62, 88, 26);                        // lit centre display
  ctx.fillStyle = '#7ff0ff';
  for (let i = 0; i < 9; i++) ctx.fillRect(W * 0.12 + i * 46, H * 0.82, 22, 5);  // instrument lights
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath(); ctx.moveTo(W * 0.08, 0); ctx.lineTo(W * 0.3, 0); ctx.lineTo(W * 0.12, H); ctx.lineTo(0, H); ctx.lineTo(0, H * 0.3); ctx.closePath(); ctx.fill();
}

function canvasTexture(width, height, scale, paint, srgb) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  paint(ctx);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// A slab that follows the hull's curve: the outer face plus side walls down into the hull.
// Its texture coordinates are the hull's own, so the hull's paint carries on across it.
function plateGeometry(p, R) {
  const nu = Math.max(2, Math.ceil((p.u1 - p.u0) * 120)), nv = Math.max(2, Math.ceil((p.v1 - p.v0) * 60));
  const pos = [], uv = [], idx = [];
  const point = (u, v, r) => {
    const a = u * Math.PI * 2, th = v * Math.PI, s = Math.sin(th);
    pos.push(-Math.sin(a) * s * r, Math.cos(th) * r, -Math.cos(a) * s * r);
  };
  const at = (i, j) => {
    const t = j / nv, inset = plateInset(p, t) * (p.u1 - p.u0);
    const u = p.u0 + inset + (p.u1 - p.u0 - 2 * inset) * (i / nu);
    return { u, v: p.v0 + (p.v1 - p.v0) * t, s: i / nu, t };
  };
  const push = (q, r) => { point(q.u, q.v, r); uv.push(p.local ? q.s : q.u, p.local ? 1 - q.t : 1 - q.v); };
  const outer = R * (1 + p.lift), inner = R * 0.985;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) push(at(i, j), outer);
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      idx.push(a, a + nu + 1, a + 1, a + 1, a + nu + 1, a + nu + 2);
    }
  }
  const rim = [];
  for (let i = 0; i <= nu; i++) rim.push([i, 0]);
  for (let j = 1; j <= nv; j++) rim.push([nu, j]);
  for (let i = nu - 1; i >= 0; i--) rim.push([i, nv]);
  for (let j = nv - 1; j >= 0; j--) rim.push([0, j]);
  for (let k = 0; k < rim.length - 1; k++) {
    const a = at(...rim[k]), b = at(...rim[k + 1]), n = pos.length / 3;
    push(a, outer); push(b, outer); push(a, inner); push(b, inner);
    idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// `update(ringTime, t, still)` keeps the pod above the scanner glow, fires the scan now and then, and
// returns how strongly it is scanning (0 to 1). `body` is the pod itself and `beams` its scan light:
// main() draws them in separate passes.
// `coarse` (default 1) enlarges the pod, its height above the ring and its beam lines by that factor, for
// a planet drawn small (the miniature planet in "What we do", assets/what-we-do-sky.js).
// `dim` on the returned object (default 1) scales the pod's lighting.
export function buildSatellite(color, coarse = 1) {
  const BEAM_EVERY = 8, BEAM_FOR = 3, BEAM_FIRST = 1.2; // seconds: one burst per cycle, the first soon after load
  const ringWidth = RING_OUTER - RING_INNER;
  const height = SAT_HEIGHT * (coarse > 1 ? coarse * 0.75 : 1);  // above the ring plane
  const R = (ringWidth / 12) * coarse;  // hull radius: the hull is a sixth of the ring's width across, the whole pod about a quarter

  const hullMap = canvasTexture(2048, 1024, 1, (ctx) => paintHull(ctx, false), true);
  const hullRelief = canvasTexture(1024, 512, 0.5, (ctx) => paintHull(ctx, true), false);
  const paintLook = { color: '#b4b7c0', roughness: 0.62, metalness: 0.05, bumpScale: 2.5 };  // a light grey over the paint
  const hullMat = new THREE.MeshStandardMaterial({ map: hullMap, bumpMap: hullRelief, ...paintLook });
  const plateMat = new THREE.MeshStandardMaterial({ map: hullMap, bumpMap: hullRelief, ...paintLook, side: THREE.DoubleSide });
  const boxMat = new THREE.MeshStandardMaterial({
    map: canvasTexture(256, 256, 1, (ctx) => paintBox(ctx, false), true),
    bumpMap: canvasTexture(256, 256, 1, (ctx) => paintBox(ctx, true), false),
    ...paintLook,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#23252c', roughness: 0.45, metalness: 0.7, side: THREE.DoubleSide });
  const windowMat = new THREE.MeshBasicMaterial({ map: canvasTexture(512, 256, 1, paintWindow, true), side: THREE.DoubleSide });
  const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const lensMat = new THREE.MeshStandardMaterial({ color: '#0a1830', roughness: 0.12, metalness: 0.4, emissive: color('#55d8ff'), emissiveIntensity: 0.4 });

  const body = new THREE.Group();
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); body.add(m); return m; };

  // Hull, armour and window. The sphere is turned so the texture's seam is at the tail.
  add(new THREE.SphereGeometry(R, 72, 48).rotateY(-Math.PI / 2), hullMat);
  add(mergeGeometries(PLATES.map((p) => plateGeometry(p, R))), plateMat);
  add(plateGeometry(WINDOW, R), windowMat);

  // Boxy parts, dark mechanical parts and lights, each merged into one mesh
  const boxes = [], darks = [], lights = [];
  const box = (list, w, h, d, x, y, z) => list.push(new THREE.BoxGeometry(w * R, h * R, d * R).translate(x * R, y * R, z * R));
  const up = new THREE.Vector3(0, 1, 0), quat = new THREE.Quaternion(), dir = new THREE.Vector3();
  // A cylinder between two points (in hull radii); r0 and r1 are its radii at the two ends
  const tube = (list, a, b, r0, r1 = r0, sides = 12, open = false) => {
    dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = dir.length() * R;
    quat.setFromUnitVectors(up, dir.normalize());
    list.push(new THREE.CylinderGeometry(r1 * R, r0 * R, length, sides, 1, open).applyQuaternion(quat)
      .translate((a[0] + b[0]) / 2 * R, (a[1] + b[1]) / 2 * R, (a[2] + b[2]) / 2 * R));
  };
  const lamp = (hex, radius, x, y, z, flat) => {
    const g = flat ? new THREE.CircleGeometry(radius * R, 20).rotateY(Math.PI) : new THREE.SphereGeometry(radius * R, 10, 8);
    g.translate(x * R, y * R, z * R);
    const c = color(hex), tint = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < tint.length; i += 3) { tint[i] = c.r; tint[i + 1] = c.g; tint[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(tint, 3));
    lights.push(g);
  };

  const flames = [];
  for (const side of [-1, 1]) {
    // Engine block: a housing let into the tail, a recessed face, one large nozzle over three small
    // ones, and cooling fins down its outer flank
    const ex = side * 0.34;
    box(boxes, 0.42, 0.54, 0.4, ex, 0.0, -0.9);
    box(darks, 0.34, 0.46, 0.02, ex, 0.0, -1.105);
    tube(darks, [ex, 0.09, -1.08], [ex, 0.09, -1.27], 0.1, 0.125, 28, true);
    tube(darks, [ex, 0.09, -1.25], [ex, 0.09, -1.28], 0.135, 0.135, 28, true);
    lamp('#bfe2ff', 0.092, ex, 0.09, -1.13, true);
    for (const dx of [-0.1, 0, 0.1]) {
      tube(darks, [ex + dx, -0.14, -1.1], [ex + dx, -0.14, -1.17], 0.036, 0.042, 14, true);
      lamp('#6fb4ff', 0.03, ex + dx, -0.14, -1.125, true);
    }
    for (let i = 0; i < 6; i++) box(darks, 0.05, 0.03, 0.26, ex + side * 0.22, 0.17 - i * 0.065, -0.93);
    flames.push(new THREE.ConeGeometry(0.1 * R, 0.55 * R, 20, 1, true).rotateX(-Math.PI / 2).translate(ex * R, 0.09 * R, -1.42 * R));

    // Thruster pod: two shells with a dark waist, a skirt and nozzle underneath, held off the hull by
    // two struts with ball joints, and a navigation light on its outer face (red to port, green to starboard)
    const px = side * 1.46;
    box(boxes, 0.32, 0.2, 0.38, px, 0.2, 0);
    box(darks, 0.33, 0.035, 0.39, px, 0.085, 0);
    box(boxes, 0.32, 0.17, 0.38, px, -0.015, 0);
    tube(darks, [px, -0.1, 0], [px, -0.2, 0], 0.17, 0.09, 4);
    tube(darks, [px, -0.2, 0], [px, -0.25, 0], 0.07, 0.085, 14, true);
    lamp('#8fc4ff', 0.06, px, -0.215, 0);
    for (const [from, to] of [[[side * 0.95, 0.3, 0.06], [side * 1.3, 0.24, 0.06]], [[side * 0.99, -0.05, -0.06], [side * 1.3, 0.0, -0.06]], [[side * 0.97, 0.18, -0.1], [side * 1.3, 0.02, 0.1]]]) {
      tube(darks, from, to, 0.02);
      for (const end of [from, to]) darks.push(new THREE.SphereGeometry(0.034 * R, 10, 8).translate(end[0] * R, end[1] * R, end[2] * R));
    }
    lamp(side < 0 ? '#ff3b30' : '#3dff7a', 0.028, px + side * 0.17, 0.2, 0.12);
  }
  // Between the engines: a hatch and a row of ports
  box(boxes, 0.16, 0.3, 0.06, 0, 0.02, -1.02);
  for (let i = 0; i < 5; i++) box(darks, 0.02, 0.05, 0.02, -0.06 + i * 0.03, 0.26, -0.99);

  // Scanner under the hull: a collar, a dark housing and the lens the beam leaves from
  tube(boxes, [0, -0.93, 0], [0, -1.04, 0], 0.3, 0.22, 32);
  tube(darks, [0, -1.03, 0], [0, -1.1, 0], 0.19, 0.16, 32);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    box(darks, 0.04, 0.05, 0.04, Math.cos(a) * 0.27, -0.99, Math.sin(a) * 0.27);
  }
  add(new THREE.SphereGeometry(0.13 * R, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, -1.08 * R, 0), lensMat);

  // On the crown: a whip aerial, a blade aerial, a sensor dome and a white strobe
  tube(darks, [0.28, 0.93, -0.25], [0.3, 1.5, -0.3], 0.014, 0.006);
  box(darks, 0.02, 0.2, 0.14, -0.3, 1.02, -0.2);
  darks.push(new THREE.SphereGeometry(0.09 * R, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(-0.12 * R, 1.03 * R, 0.3 * R));
  tube(darks, [0, 1.03, -0.1], [0, 1.1, -0.1], 0.03);
  lamp('#ffffff', 0.032, 0, 1.12, -0.1);
  // Two headlamps under the sill
  for (const x of [-0.5, 0.5]) { tube(darks, [x, -0.2, 0.84], [x, -0.2, 0.93], 0.06, 0.07, 16, true); lamp('#fff3d0', 0.05, x, -0.2, 0.9); }

  add(mergeGeometries(boxes), boxMat);
  add(mergeGeometries(darks), darkMat);
  add(mergeGeometries(lights), lightMat);

  // Engine exhaust: two short blue flames that flicker
  const flameTime = { value: 0 };
  add(mergeGeometries(flames), new THREE.ShaderMaterial({
    uniforms: { uTime: flameTime, uFrom: { value: -1.15 * R }, uLength: { value: 0.55 * R } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uFrom, uLength;
      varying float vK;  // 0 at the nozzle, 1 at the tip of the flame
      void main() {
        vK = (uFrom - position.z) / uLength;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime;
      varying float vK;
      void main() {
        float flicker = 0.8 + 0.2 * sin(uTime * 31.0 + vK * 9.0);
        float fade = (1.0 - vK) * (1.0 - vK);
        gl_FragColor = vec4(mix(vec3(0.25, 0.5, 1.0), vec3(0.8, 0.95, 1.0), fade) * fade * flicker * 0.9, 1.0);
      }`,
  }));

  // Scan beam: two flat sheets of light from the lens down to the ring, drawn the hard way a laser
  // scanner looks: thin bright edges, a bright line where the sheet meets the ring, and almost nothing
  // in between. One sheet lies across the ring's lanes and one along them; during a burst each sweeps
  // sideways, so the two lines cross the digits under the craft.
  const apexY = -1.2 * R;
  const drop = height + apexY;  // from the lens down to the ring plane
  const LINE = 0.006 * coarse;             // thickness of the bright lines, in planet radii
  const sheetGeo = new THREE.BufferGeometry();  // apex at the origin, base one unit below and one unit to each side
  sheetGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -1, -1, 0, 1, -1, 0], 3));
  sheetGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 0, 0, 1, 1, 1], 2));
  const beamPower = { value: 0 };
  const beamColor = { value: color('#cdeeff') };
  // `half` is half the length of the line on the ring; `turn` points that line across (0) or along (PI/2) the lanes
  const makeSheet = (half, turn) => {
    const uniforms = { uPower: beamPower, uColor: beamColor, uHalf: { value: half }, uLength: { value: drop } };
    const mesh = new THREE.Mesh(sheetGeo, new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uPower, uHalf, uLength;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float k = vUv.y;                                        // 0 at the lens, 1 at the ring
          float side = 1.0 - abs(vUv.x - 0.5) / max(0.5 * k, 1e-4); // 0 on either edge, 1 on the centre line
          float toEdge = side * k * uHalf;                        // distances in planet radii
          float toRing = (1.0 - k) * uLength;
          float edge = 1.0 - smoothstep(0.0, ${LINE.toFixed(4)}, toEdge);
          float ground = 1.0 - smoothstep(0.0, ${LINE.toFixed(4)}, toRing);
          float fill = 0.2 - 0.1 * k;                              // a thin veil, densest at the lens
          gl_FragColor = vec4(uColor * (fill + 1.5 * edge + 2.2 * ground) * uPower, 1.0);
        }`,
    }));
    mesh.rotation.order = 'YXZ';  // sweep first, then turn
    mesh.rotation.y = turn;
    mesh.position.y = apexY;
    mesh.frustumCulled = false;   // the geometry is a unit triangle; its real size comes from the scale
    // Slide the line on the ring `offset` to one side of the point under the craft
    const aim = (offset) => {
      const length = Math.hypot(drop, offset);
      mesh.rotation.x = Math.atan2(offset, drop);
      mesh.scale.set(half, length, 1);
      uniforms.uLength.value = length;
    };
    return { mesh, aim };
  };
  const across = makeSheet(0.34 * ringWidth, 0);          // a long line across the lanes, sweeping along them
  const along = makeSheet(0.13 * ringWidth, Math.PI / 2); // a short line along the lanes, sweeping across them

  // The pod's light comes from the ring beneath it: a cool light straight up from the ring plane, which
  // leaves the crown in shadow. The viewer looks down on the crown, so the shadow is kept a readable grey.
  // These lights reach only the pod: the planet and the ring are drawn by their own shaders.
  const ringLight = new THREE.DirectionalLight(0xcfd8ff, 2.3);
  ringLight.position.set(0, -1, 0.25);
  const fill = new THREE.DirectionalLight(0xc4ccff, 1.3);  // weaker light from above the viewer, so the shadowed crown still reads as grey
  fill.position.set(-0.4, 1, 0.6);
  const lights3d = new THREE.Group();
  const ambient = new THREE.AmbientLight(0x9a9fc8, 1.1);
  lights3d.add(ringLight, ringLight.target, fill, fill.target, ambient);

  const beams = new THREE.Group();
  beams.add(across.mesh, along.mesh);
  const group = new THREE.Group();
  group.add(body, beams, lights3d);

  const radius = (RING_INNER + RING_OUTER) / 2;
  const smooth = (a, b, x) => { const k = Math.min(Math.max((x - a) / (b - a), 0), 1); return k * k * (3 - 2 * k); };

  // ringTime drives the position (the same clock as the scanner glow); t drives everything else.
  // `still` is true when the page shows a single frame: the pod is then drawn mid-scan.
  const update = (ringTime, t, still) => {
    const a = ringTime * SCAN_SPEED;
    group.position.set(Math.cos(a) * radius, height, Math.sin(a) * radius);
    group.rotation.y = -a;

    let power = 0.85, slide = 0.3, cross = 0.4;  // the still frame: both sheets on, a little off centre
    body.rotation.x = 0.1;  // nose slightly down, looking where it scans
    if (!still) {
      const x = (t - BEAM_FIRST + BEAM_EVERY) % BEAM_EVERY;
      // Snaps on, holds with a slight flicker, snaps off
      power = x < BEAM_FOR ? smooth(0, 0.08, x) * (1 - smooth(BEAM_FOR - 0.15, BEAM_FOR, x)) * (0.9 + 0.1 * Math.sin(t * 43)) : 0;
      slide = Math.sin(x * 2.1);
      cross = Math.sin(x * 2.6 + 1);
      body.rotation.z = Math.sin(t * 0.5) * 0.07;         // rolls gently from side to side
      group.position.y += Math.sin(t * 1.3) * 0.004 * coarse;  // and hovers
    }
    flameTime.value = t;
    lensMat.emissiveIntensity = 0.4 + 2.4 * power;
    ringLight.intensity = (2.3 + 1.2 * power) * api.dim;  // the scan lights the pod's underside a little more
    fill.intensity = 1.3 * api.dim;
    ambient.intensity = 1.1 * api.dim;

    beamPower.value = power;
    across.aim(slide * 0.09 * ringWidth);
    along.aim(cross * 0.32 * ringWidth);
    across.mesh.visible = along.mesh.visible = power > 0.001;
    return power;
  };

  const api = { group, body, beams, update, dim: 1 };
  return api;
}

main();
