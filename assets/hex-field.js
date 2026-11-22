// Hexagon field: the planet's surface, laid flat as a background. Every element marked [data-hexfield]
// gets a canvas behind its content (the page's CSS decides whether it fills the element or stays in the window), filled with dark six-sided panels. Violet light leaks from the gaps
// between them in a few slowly drifting regions, as it does on the planet, and the panels react the same
// way: the ones under the pointer light up, and a click sends a wave out across the field.
// Plain WebGL, one small fragment shader per field; without WebGL the element keeps its own background.

import { hasGPU } from './gpu.js';

const HEX_PX = 66;      // width of one panel, in CSS pixels
const HOVER_PX = 210;    // how far the pointer's light reaches
const WAVE_SPEED = 620;  // CSS pixels per second
const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;
const FRAGMENT = `
precision highp float;
uniform vec2 uRes;       // canvas size in device pixels
uniform float uPx;       // device pixels per CSS pixel
uniform float uTime;
uniform vec2 uPointer;   // device pixels, origin bottom left
uniform float uHover;    // 0..1, eased in while the pointer is over the field
uniform vec2 uWaveAt;    // where the last click landed
uniform float uWaveAge;  // seconds since that click (large when idle)
uniform vec2 uShift;     // slides the grid, so two fields side by side do not show the same pattern

const vec2 S = vec2(1.0, 1.7320508);
const vec3 GLOW = vec3(0.36, 0.22, 1.0);

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// xy: position inside the nearest hexagon, zw: that hexagon's centre
vec4 hexagon(vec2 p) {
  vec4 c = floor(vec4(p, p - vec2(0.5, 1.0)) / S.xyxy) + 0.5;
  vec4 h = vec4(p - c.xy * S, p - (c.zw + 0.5) * S);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, c.xy * S) : vec4(h.zw, (c.zw + 0.5) * S);
}

// The grid is turned a little (0.3 rad), so its rows do not line up with the page's edges
const mat2 TURN = mat2(0.955336, -0.295520, 0.295520, 0.955336);
const float GAP = 0.03, BEVEL = 0.105;
const float RISE = 0.19;   // how far a fully lifted panel moves up the screen, in panel widths

float toEdgeOf(vec2 local) {
  vec2 a = abs(local);
  return 0.5 - max(dot(a, S * 0.5), a.x);            // 0 on the panel's edge, 0.5 at its centre
}
// How a panel reacts, decided once per panel as on the planet. x: the pointer over it, y: a click's wave
// passing it, z: its own slow rise (a few panels only)
vec3 react(vec2 centre, float unit) {
  vec2 px = (centre * TURN) * unit - uShift;         // back to device pixels (v * M undoes the turn)
  float hover = uHover * (1.0 - smoothstep(0.0, ${HOVER_PX.toFixed(1)} * uPx, distance(px, uPointer)));
  float x = (distance(px, uWaveAt) - uWaveAge * ${WAVE_SPEED.toFixed(1)} * uPx) / (48.0 * uPx);
  float wave = exp(-x * x) * (1.0 - smoothstep(0.7, 1.8, uWaveAge));
  float seed = hash(centre);
  float rise = seed < 0.06 ? smoothstep(0.15, 0.85, 0.5 + 0.5 * sin(uTime * 0.45 + seed * 500.0)) : 0.0;
  return vec3(hover, wave, rise);
}
float liftOf(vec3 r) { return clamp(r.x + r.y * 0.8 + r.z * 0.5, 0.0, 1.0); }
// Light let out around a panel: the slow leaks, plus its reactions
float glowOf(vec2 centre, vec3 r) {
  float n = noise(centre * 0.33 + vec2(0.0, uTime * 0.02)) * 0.65 + noise(centre * 0.9 + 7.0) * 0.35;
  float leak = smoothstep(0.45, 0.76, n) * (0.8 + 0.2 * sin(uTime * 0.35 + n * 6.0));
  return leak * 0.55 + r.z * 1.1 + r.x * 1.5 + r.y * 1.1;
}

void main() {
  float unit = ${HEX_PX.toFixed(1)} * uPx;           // one panel, in device pixels
  vec2 p = TURN * (gl_FragCoord.xy + uShift) / unit;
  vec2 own = hexagon(p).zw;                          // the panel whose footprint this pixel is in
  vec2 up = TURN * vec2(0.0, 1.0);                   // up the screen, in grid space

  // A lifted panel rises toward the viewer, which moves its top face up the screen and uncovers its
  // glowing side wall below. So the top face over this pixel may belong to this panel or to a
  // neighbour: of the seven candidates, take the highest one that covers the pixel.
  float topLift = -1.0;
  vec2 topLocal = vec2(0.0), topCentre = own;
  vec3 topReact = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    float a = float(i) * 1.0471976;
    vec2 centre = own + (i == 6 ? vec2(0.0) : vec2(cos(a), sin(a)));
    vec3 r = react(centre, unit);
    float lift = liftOf(r);
    vec2 local = (p - centre - up * lift * RISE) / (1.0 + 0.05 * lift);  // nearer the viewer, so a touch larger
    if (toEdgeOf(local) > GAP && lift > topLift) { topLift = lift; topLocal = local; topCentre = centre; topReact = r; }
  }

  float aa = 1.2 / unit;
  vec3 col;
  if (topLift >= 0.0) {
    // On a panel's top face
    float toEdge = toEdgeOf(topLocal);
    float glow = glowOf(topCentre, topReact);
    float seed = hash(topCentre);
    vec2 a = abs(topLocal);
    vec2 normal = dot(a, S * 0.5) > a.x ? sign(topLocal) * normalize(S * 0.5) : vec2(sign(topLocal.x), 0.0);
    // The bevel catches a little light from the top left, and the glow spilling out of the gap
    float lit = 0.5 + 0.5 * dot(normal, TURN * normalize(vec2(-0.5, 0.85)));
    float across = clamp((toEdge - GAP) / (BEVEL - GAP), 0.0, 1.0);
    vec3 bevel = vec3(0.040, 0.042, 0.058) * (0.35 + 1.3 * lit) * (1.0 + 0.9 * topLift) + GLOW * glow * 0.5 * (1.0 - across);
    // The face: matte black, a shade different from panel to panel, a little lighter as it rises,
    // with a soft halo near a glowing gap
    vec3 face = vec3(0.017, 0.018, 0.026) * (0.8 + 0.5 * seed) + vec3(0.016, 0.014, 0.036) * topLift
              + GLOW * glow * 0.42 * exp(-(toEdge - BEVEL) * 26.0);
    col = mix(bevel, face, smoothstep(BEVEL - aa, BEVEL + aa, toEdge));
    // Soften the outline of the top face against what is under it
    vec3 r = react(own, unit);
    col = mix(GLOW * (0.05 + glowOf(own, r)) * 1.7, col, smoothstep(GAP, GAP + 2.0 * aa, toEdge));
  } else {
    // Between top faces: the gap, or the side wall of a lifted panel. Both show the light from underneath;
    // a wall is lit most at its foot and darkens toward the top face.
    vec3 r = react(own, unit);
    float glow = glowOf(own, r);
    float lift = liftOf(r);
    float inFootprint = smoothstep(GAP - aa, GAP + aa, toEdgeOf(p - own));
    float height = clamp(dot(p - own, up) + 0.5, 0.0, 1.0);   // 0 at the panel's lower edge
    vec3 gap = GLOW * (0.05 + glow) * 1.7;
    vec3 wall = GLOW * (0.3 + glow) * mix(1.5, 0.5, smoothstep(0.0, lift * RISE + 0.02, height)) + vec3(0.02, 0.02, 0.03);
    col = mix(gap, wall, inFootprint);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

function createField(host, reduceMotion, index) {
  const canvas = document.createElement('canvas');
  canvas.className = 'hexfield';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX), fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment) return;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);  // one triangle over the canvas
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const uniform = {};
  for (const name of ['uRes', 'uPx', 'uTime', 'uPointer', 'uHover', 'uWaveAt', 'uWaveAge', 'uShift']) uniform[name] = gl.getUniformLocation(program, name);

  host.prepend(canvas);
  host.classList.add('has-hexfield');

  let ratio = 1, visible = false, raf = 0, lost = false;
  const started = performance.now();
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, inside: false, hover: 0 };
  let waveX = 0, waveY = 0, waveStart = -Infinity;

  const draw = (now) => {
    const t = reduceMotion.matches ? 20 : (now - started) / 1000;
    pointer.x += (pointer.tx - pointer.x) * 0.25;
    pointer.y += (pointer.ty - pointer.y) * 0.25;
    pointer.hover += ((pointer.inside ? 1 : 0) - pointer.hover) * (reduceMotion.matches ? 1 : 0.09);
    gl.uniform2f(uniform.uRes, canvas.width, canvas.height);
    gl.uniform1f(uniform.uPx, ratio);
    gl.uniform1f(uniform.uTime, t);
    gl.uniform2f(uniform.uShift, index * 1733 * ratio, index * 911 * ratio);
    gl.uniform2f(uniform.uPointer, pointer.x * ratio, canvas.height - pointer.y * ratio);
    gl.uniform1f(uniform.uHover, pointer.hover);
    gl.uniform2f(uniform.uWaveAt, waveX * ratio, canvas.height - waveY * ratio);
    gl.uniform1f(uniform.uWaveAge, reduceMotion.matches ? 99 : (now - waveStart) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const frame = (now) => {
    raf = 0;
    if (!visible || lost) return;
    draw(now);
    if (!reduceMotion.matches) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf && visible && !lost) raf = requestAnimationFrame(frame); };

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;  // the canvas, not the host: it may be a window-sized layer in a taller host
    if (!w || !h) return;
    // A large field is drawn a little coarser, and so is a phone's: its small GPU fills every pixel of a
    // dense screen on each frame, and a 1.5x field is still sharper than the eye can tell on panels this soft
    ratio = Math.min(devicePixelRatio || 1, w * h > 600000 || Math.min(w, h) < 700 ? 1.5 : 2);
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    gl.viewport(0, 0, canvas.width, canvas.height);
    kick();
  };
  const place = (event) => {
    const box = canvas.getBoundingClientRect();
    return [event.clientX - box.left, event.clientY - box.top];
  };

  host.addEventListener('pointermove', (event) => {
    [pointer.tx, pointer.ty] = place(event);
    if (!pointer.inside) { pointer.x = pointer.tx; pointer.y = pointer.ty; }  // no slide in from the last place it left
    pointer.inside = true;
    kick();
  }, { passive: true });
  host.addEventListener('pointerleave', () => { pointer.inside = false; kick(); });
  host.addEventListener('pointerdown', (event) => {
    [waveX, waveY] = place(event);
    waveStart = performance.now();
    kick();
  }, { passive: true });
  canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); lost = true; canvas.remove(); host.classList.remove('has-hexfield'); });

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; kick(); }, { rootMargin: '100px' }).observe(canvas);
}

// The field is decoration under content that is already readable: it starts once the page has loaded and
// the browser is idle, and only on a real graphics chip. In software WebGL the shader runs on the CPU and
// one frame of a window-sized field held the main thread for over a second (assets/gpu.js); there the
// elements keep their own dark background.
const start = () => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-hexfield]').forEach((host, index) => createField(host, reduceMotion, index));
};
if (hasGPU) {
  const whenIdle = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 2000 }) : setTimeout(start, 300));
  if (document.readyState === 'complete') whenIdle(); else addEventListener('load', whenIdle, { once: true });
}
