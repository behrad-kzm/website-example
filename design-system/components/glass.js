/* Colonaiz Liquid Glass runtime.
   1. Edge refraction: Chromium can run an SVG filter as a backdrop-filter, so each [data-refract] glass
      surface gets a displacement map that bends the backdrop along its rounded edge. Other browsers keep
      the CSS blur + saturate material from bundle.css.
   2. Specular highlight: sets --cz-mx / --cz-my on .cz-glass--interactive so the sheen follows the pointer.
   3. Nav lens: a glass capsule that slides under the hovered link inside [data-cz-lens]. */
(function () {
  var root = document.documentElement;
  var css = getComputedStyle(root);
  var num = function (name, fallback) { var v = parseFloat(css.getPropertyValue(name)); return isNaN(v) ? fallback : v; };
  var reduceTransparency = matchMedia('(prefers-reduced-transparency: reduce)').matches || matchMedia('(prefers-contrast: more)').matches;
  var brands = navigator.userAgentData && navigator.userAgentData.brands;
  var chromium = !!(brands && brands.some(function (b) { return /Chromium/.test(b.brand); }));

  // ── 1. Refraction ──
  if (chromium && !reduceTransparency) {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    document.body.appendChild(svg);
    var bezel = num('--glass-bezel', 18), scale = num('--glass-refraction', 28);
    var blur = num('--glass-blur', 16) / 2, saturate = num('--glass-saturate', 180) / 100;
    var dispersion = num('--glass-dispersion', 0.12);
    var count = 0;
    var bend = function (name, s, matrix) {
      return '<feDisplacementMap in="soft" in2="map" scale="' + s + '" xChannelSelector="R" yChannelSelector="G" result="' + name + 'd"/>' +
        '<feColorMatrix in="' + name + 'd" type="matrix" values="' + matrix + '" result="' + name + '"/>';
    };

    // Displacement map for a rounded rect: inside the bezel band, push samples inward along the edge normal.
    var buildMap = function (w, h, r) {
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
      var hw = w / 2, hh = h / 2;
      r = Math.min(r, hw, hh);
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var px = x + .5 - hw, py = y + .5 - hh;
          var qx = Math.abs(px) - (hw - r), qy = Math.abs(py) - (hh - r);
          var nx, ny, dist;
          if (qx > 0 && qy > 0) { var l = Math.hypot(qx, qy) || 1; nx = qx / l; ny = qy / l; dist = r - l; }
          else if (qx > qy) { nx = 1; ny = 0; dist = r - qx; }
          else { nx = 0; ny = 1; dist = r - qy; }
          nx *= px < 0 ? -1 : 1; ny *= py < 0 ? -1 : 1;
          var t = dist < bezel ? Math.pow(1 - Math.max(dist, 0) / bezel, 2) : 0;
          var i = (y * w + x) * 4;
          d[i] = 128 - nx * t * 127; d[i + 1] = 128 - ny * t * 127; d[i + 2] = 128; d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      return c.toDataURL();
    };

    var apply = function (el) {
      var w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      if (!w || !h) return;
      var r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      var id = el.dataset.czFilter || (el.dataset.czFilter = 'cz-refract-' + (++count));
      var old = document.getElementById(id); if (old) old.remove();
      var f = document.createElementNS(NS, 'filter');
      f.setAttribute('id', id); f.setAttribute('x', 0); f.setAttribute('y', 0);
      f.setAttribute('width', w); f.setAttribute('height', h);
      f.setAttribute('filterUnits', 'userSpaceOnUse'); f.setAttribute('primitiveUnits', 'userSpaceOnUse');
      f.setAttribute('color-interpolation-filters', 'sRGB');
      f.innerHTML =
        '<feImage href="' + buildMap(w, h, r) + '" x="0" y="0" width="' + w + '" height="' + h + '" preserveAspectRatio="none" result="map"/>' +
        '<feGaussianBlur in="SourceGraphic" stdDeviation="' + blur + '" result="soft"/>' +
        // Dispersion: bend red, green and blue by slightly different amounts, then add them back together
        bend('r', scale * (1 + dispersion), '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0') +
        bend('g', scale, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0') +
        bend('b', scale * (1 - dispersion), '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0') +
        '<feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg"/>' +
        '<feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" result="bent"/>' +
        '<feColorMatrix in="bent" type="saturate" values="' + saturate + '"/>';
      svg.appendChild(f);
      el.style.backdropFilter = 'url(#' + id + ')';
      el.classList.add('is-refracting');
    };

    var ro = new ResizeObserver(function (entries) { entries.forEach(function (e) { apply(e.target); }); });
    document.querySelectorAll('.cz-glass[data-refract]').forEach(function (el) { ro.observe(el); });
  }

  // ── 2. Pointer specular ──
  document.addEventListener('pointermove', function (e) {
    var el = e.target.closest && e.target.closest('.cz-glass--interactive, .cz-glass[data-refract]');
    if (!el) return;
    var b = el.getBoundingClientRect();
    el.style.setProperty('--cz-mx', (e.clientX - b.left) + 'px');
    el.style.setProperty('--cz-my', (e.clientY - b.top) + 'px');
  }, { passive: true });

  // ── 3. Nav lens ──
  document.querySelectorAll('[data-cz-lens]').forEach(function (group) {
    var lens = document.createElement('span');
    lens.className = 'cz-nav__lens'; lens.setAttribute('aria-hidden', 'true');
    group.prepend(lens);
    var move = function (link) {
      if (!link) { lens.style.opacity = 0; return; }
      lens.style.width = link.offsetWidth + 'px';
      lens.style.transform = 'translate(' + link.offsetLeft + 'px,' + link.offsetTop + 'px)';
      lens.style.opacity = 1;
    };
    var current = function () { return group.querySelector('[aria-current="page"]'); };
    group.addEventListener('pointerover', function (e) { var a = e.target.closest('a'); if (a) move(a); });
    group.addEventListener('focusin', function (e) { var a = e.target.closest('a'); if (a) move(a); });
    group.addEventListener('pointerleave', function () { move(current()); });
    group.addEventListener('focusout', function () { move(current()); });
    move(current());
  });
})();
