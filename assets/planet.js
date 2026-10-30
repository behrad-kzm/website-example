// Cybernetic planet: a Goldberg sphere of bevelled hexagonal panels, ringed by orbiting binary digits.
// Rendered with Three.js into the fixed <canvas data-planet> behind the hero.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const PALETTE = {
  base: '#050B19',
  dark: '#07172D',
  metal: '#102C59',
  cyan: '#16A9FF',
  blue: '#286BFF',
  violet: '#713DFF',
  purple: '#351A75',
};

const PLANET_SPEED = 0.035; // rad/s around its own axis
const RING_SPEED = 0.06;    // rad/s, slightly faster than the planet
const AXIAL_TILT = 0.2;     // ring and planet lean to the right
const RING_INCLINE = 0.36;  // how far the ring plane tips toward the viewer

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
  const color = (hex) => new THREE.Color(hex);

  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // compress highlights so edges glow without blowing out
  renderer.toneMappingExposure = 0.85;
  renderer.setPixelRatio(Math.min(devicePixelRatio, compact ? 1.5 : 1.75));

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

  // Post: bloom turns the bevel edges and digits into light
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.3, 0.28);
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
  const placeCamera = () => {
    camera.position.set(pointer.x * 0.09 * distance, -pointer.y * 0.06 * distance, distance);
    camera.lookAt(0, system.position.y, 0);
  };

  const clock = new THREE.Clock();
  const render = () => {
    const t = reduceMotion ? 12 : clock.getElapsedTime();
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    placeCamera();
    planet.group.rotation.y = t * PLANET_SPEED;
    planet.uniforms.uTime.value = t;
    camera.updateMatrixWorld();
    ring.uniforms.uPlanet.value.copy(system.position).applyMatrix4(camera.matrixWorldInverse);
    ring.uniforms.uTime.value = t;
    composer.render();
  };

  layout();
  render();
  canvas.classList.add('is-ready');
  addEventListener('resize', () => { layout(); if (reduceMotion) render(); });

  if (!reduceMotion) {
    const loop = () => { render(); requestAnimationFrame(loop); };
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

function buildPlanet(detail) {
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
      varying vec3 vLPos;
      varying float vSeed;
      void main() {
        // Rising panels: ease out, hold, ease back, each on its own slow cycle
        float cycle = 0.5 + 0.5 * sin(uTime * 0.45 + aSeed * 50.0);
        float rise = smoothstep(0.15, 0.85, cycle);
        float lift = aLift + aMove * rise;
        vRise = aMove > 0.0 ? rise : 0.0;  // 0 at rest, 1 fully out (moving panels only)
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
        float fromGap = pow(1.0 - vTop, 1.6) * (1.0 - vEdge) + vEdge * 0.1;  // glow climbs the walls and spills onto the bevels
        // A panel rising out opens its gap: the light swells with the rise and settles back as it returns
        float glow = leak + vRise * 1.6;
        col += uLeak * glow * (fromGap + vRise * vEdge * 0.12) * 2.3;

        gl_FragColor = vec4(col, 1.0);
      }`,
  });

  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, material));
  // Core seen through the gaps: black, glowing a soft space blue where the leak mask is open
  const core = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uLeak: uniforms.uLeak },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      ${LEAK_GLSL}
      varying vec3 vDir;
      void main() {
        gl_FragColor = vec4(uLeak * leakMask(vDir) * 2.8, 1.0);
      }`,
  });
  group.add(new THREE.Mesh(new THREE.SphereGeometry(0.94, 64, 48), core));
  return { group, uniforms };
}

// ───────────── Binary ring ─────────────

function digitAtlas() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 50px "JetBrains Mono", Menlo, monospace';
  ctx.fillText('0', 32, 34);
  ctx.fillText('1', 96, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

function buildRing(laneCount, color) {
  const angle = [], radius = [], height = [], speed = [], phase = [], size = [], lane = [];
  const inner = 1.3, outer = 2.08;

  for (let l = 0; l < laneCount; l++) {
    const r = inner + (l / (laneCount - 1)) * (outer - inner) + (Math.random() - 0.5) * 0.02;
    const spacing = 0.026 + Math.random() * 0.012;
    const count = Math.floor((Math.PI * 2 * r) / spacing);
    const run = 18 + Math.random() * 50;          // digits per dashed run
    const gap = 0.08 + Math.random() * 0.25;      // fraction of each run left empty
    const laneSpeed = RING_SPEED * (1.2 - (r - inner) * 0.35);
    const laneSize = 0.028 + Math.random() * 0.012;
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
      uniform vec3 uPlanet;
      uniform vec3 uCyan, uBlue, uViolet;
      varying vec3 vColor;
      varying float vDigit;
      varying float vAlpha;
      float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
      void main() {
        float a = aAngle + uTime * aSpeed;
        vec3 p = vec3(cos(a) * aRadius, aHeight, sin(a) * aRadius);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale / -mv.z;

        // Each digit flips between 0 and 1 now and then
        vDigit = step(0.5, hash(aPhase * 91.7 + floor(uTime * 0.45 + aPhase * 13.0)));

        vec3 c = mix(uCyan, uBlue, smoothstep(0.0, 0.7, hash(aLane + 3.1)));
        c = mix(c, uViolet, smoothstep(0.55, 1.0, hash(aPhase * 7.0 + aLane)));
        float front = smoothstep(-0.3, 1.0, sin(a));  // the near side of the ring burns brighter
        float twinkle = 0.65 + 0.35 * sin(uTime * 2.2 + aPhase * 60.0);
        vColor = c;
        // Soft occlusion: a digit behind the planet fades out as its line of sight crosses the limb,
        // instead of being sliced by the depth buffer along an edge you can't see
        vec3 toPoint = mv.xyz;
        float pointDist = length(toPoint);
        vec3 ray = toPoint / pointDist;
        float along = dot(uPlanet, ray);
        float miss = length(uPlanet - ray * along);
        float behind = smoothstep(-0.15, 0.15, pointDist - along);
        float visible = 1.0 - behind * (1.0 - smoothstep(0.92, 1.12, miss));

        vAlpha = (0.3 + 0.7 * front) * twinkle * (0.55 + 0.45 * hash(aLane * 1.7)) * visible;
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

main();
