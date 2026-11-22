// The hero planet as a still, for devices without a graphics chip (see assets/gpu.js). Two renders of
// assets/planet.js, saved from a GPU, are drawn into the same <canvas data-planet> where the live scene
// would be, at the size and place planet.js's layout gives it: the planet's diameter is 82% of the width
// on a tall screen, otherwise min(48% of the width, 78% of the height), its centre a little above the
// middle. The camera's perspective changes a touch with the window's shape, so each still carries a small
// correction (k: scale, up: centre above the middle, in window heights), matched by eye against the live
// planet at 412x823 and 1280x800.
// Drawn on a 2D canvas, so no Three.js and no WebGL are loaded.

const STILLS = {
  // cx, cy: centre of the planet in the image, d: its diameter there, in image pixels
  portrait: { src: 'assets/planet-still/portrait.webp', cx: 400, cy: 285, d: 656, k: 1.037, up: 0.07 },
  landscape: { src: 'assets/planet-still/landscape.webp', cx: 800, cy: 572, d: 768, k: 1.085, up: 0.052 },
};

const canvas = document.querySelector('[data-planet]');
if (canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let shown = null, wanted = null;   // shown: the still on the canvas, with its image; wanted: the one for this shape

  const draw = () => {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!shown) return;
    const { image, still } = shown;
    const diameter = w > h ? Math.min(0.48 * w, 0.78 * h) : 0.82 * w;
    const scale = (diameter / still.d) * still.k * ratio;
    const x = (w / 2) * ratio - still.cx * scale, y = (h / 2 - still.up * h) * ratio - still.cy * scale;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, x, y, image.width * scale, image.height * scale);
  };

  const load = () => {
    const tall = (canvas.clientWidth || innerWidth) <= (canvas.clientHeight || innerHeight);
    const next = tall ? STILLS.portrait : STILLS.landscape;
    if (next === wanted) { draw(); return; }
    wanted = next;
    const img = new Image();
    img.decoding = 'async';
    img.src = next.src;
    img.decode().then(() => {
      if (wanted !== next) return;
      shown = { image: img, still: next };
      draw();
      canvas.classList.add('is-ready');
    }).catch(() => {});
  };

  // Same as the live planet: hidden once the opaque part of the page below has slid over it
  const end = document.querySelector('[data-planet-end]');
  const checkCovered = () => { canvas.style.visibility = end && end.getBoundingClientRect().top <= 0 ? 'hidden' : ''; };
  addEventListener('scroll', checkCovered, { passive: true });
  let size = '';
  addEventListener('resize', () => {
    const next = canvas.clientWidth + 'x' + canvas.clientHeight;
    if (next !== size) { size = next; load(); }
  });
  checkCovered();
  load();
}
