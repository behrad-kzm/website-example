// What the website reports to Google Analytics, beyond the page views GA4 collects by itself.
// Every event is a dataLayer push; Google Tag Manager forwards it to GA4 (the container setup to import is
// docs/analytics/gtm-container.json, and docs/analytics/README.md lists every event and what it answers).
// Consent is not this file's job: the events are always pushed, and Consent Mode (the <head> snippet and
// assets/consent.js) decides whether Google may store a cookie with them.
// Nothing here may slow the page: listeners are passive, observers do the watching, and nothing reads layout
// during a scroll.
(() => {
  window.dataLayer = window.dataLayer || [];

  // Every parameter an event can carry. Each push sets all of them (undefined when unused), because the
  // dataLayer remembers values: without this, a parameter of one event would leak into the next.
  // Keep in step with the variables of docs/analytics/gtm-container.json.
  const PARAMS = ['cta_location', 'cta_text', 'plan', 'section_id', 'seconds', 'percent', 'question', 'faq_group',
    'step_section', 'step_number', 'step_name', 'link_text', 'link_target', 'link_location', 'file_action',
    'metric_name', 'metric_value', 'metric_rating', 'error_message', 'error_source', 'copied_text', 'method'];
  const blank = Object.fromEntries(PARAMS.map((k) => [k, undefined]));
  const track = (event, params = {}) => window.dataLayer.push({ ...blank, ...params, event });

  const text = (el, max = 100) => (el ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  const sectionOf = (el) => {
    const section = el.closest('section');
    if (section) return section.id || (section.classList.contains('hero') ? 'hero' : '');
    return el.closest('.site-header, .cz-nav') ? 'header' : el.closest('.site-footer') ? 'footer' : el.closest('.legal__toc') ? 'toc' : '';
  };

  // ── Clicks ──────────────────────────────────────────────────────────────────────────────────────
  // book_call_click is the one that matters: the visitor leaves for Calendly to book. Mark it as a key event.
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (e.target.closest('[data-scroll-cue]')) return track('scroll_cue_click');
    if (!link || link.closest('[aria-hidden="true"]')) return;
    const href = link.getAttribute('href');
    const where = sectionOf(link);

    if (/calendly\.com/.test(href)) {
      const plan = link.closest('.plan, .cz-card');
      return track('book_call_click', { cta_location: where, cta_text: text(link), plan: where === 'pricing' ? text(plan && plan.querySelector('h3')) : undefined });
    }
    if (/\.pdf($|\?)/.test(href)) return track('sample_report_click', { file_action: link.hasAttribute('download') ? 'download' : 'open', cta_location: where });
    if (/^mailto:/.test(href)) return track('email_click', { link_location: where });
    if (link.hasAttribute('data-cookie-settings')) return track('cookie_settings_open');
    if (/^https?:/.test(href) && link.host !== location.host) {
      // Outbound: GA4's enhanced measurement reports the click itself; this adds which block it was in
      return track('partner_click', { link_text: text(link) || (link.querySelector('img') || {}).alt, link_target: link.hostname, link_location: where });
    }
    track('nav_click', { link_text: text(link), link_target: href, link_location: where });
  }, { passive: true });

  // ── Sections: which ones are reached, and how long each holds the visitor ───────────────────────────────
  // "Current" is the section crossing the middle of the window. Time counts only while the tab is visible.
  const sections = [...document.querySelectorAll('main section, main.legal section[id]')].filter((s) => s.id || s.classList.contains('hero'));
  const seen = new Set();
  const stepReports = {};   // per section id: reports its active step (set further down)
  const spent = new Map();
  let current = null;
  let since = 0;
  const settle = () => {
    if (current && since) spent.set(current, (spent.get(current) || 0) + (performance.now() - since));
    since = document.visibilityState === 'visible' ? performance.now() : 0;
  };
  if ('IntersectionObserver' in window) {
    const watch = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id || 'hero';
        settle();
        current = id;
        if (!seen.has(id)) { seen.add(id); track('section_view', { section_id: id }); }
        (stepReports[id] || (() => {}))();
      });
    }, { rootMargin: '-50% 0px -50% 0px' });
    sections.forEach((s) => watch.observe(s));
  }
  const flushSections = () => {
    settle();
    spent.forEach((ms, id) => {
      if (ms < 2000) return;   // a section scrolled past is not time spent on it
      track('section_time', { section_id: id, seconds: Math.round(ms / 1000) });
      spent.set(id, 0);
    });
  };

  // ── Scroll depth: 25, 50, 75 and 100% of the page (GA4 itself only reports 90%) ───────────────────────────
  // Checked at most twice a second, after a scroll, never inside the scroll itself.
  const marks = [25, 50, 75, 100];
  let depthTimer = 0;
  const checkDepth = () => {
    depthTimer = 0;
    const room = document.documentElement.scrollHeight - innerHeight;
    const percent = room > 0 ? ((scrollY + 4) / room) * 100 : 100;
    while (marks.length && percent >= marks[0]) track('scroll_depth', { percent: marks.shift() });
    if (!marks.length) removeEventListener('scroll', onScroll);
  };
  const onScroll = () => { if (!depthTimer) depthTimer = setTimeout(checkDepth, 500); };
  addEventListener('scroll', onScroll, { passive: true });

  // ── FAQ: which questions get opened ─────────────────────────────────────────────────────────────────
  document.addEventListener('toggle', (e) => {
    const item = e.target;
    if (!(item instanceof HTMLDetailsElement) || !item.open) return;
    const group = item.parentElement && item.parentElement.querySelector('h3');
    track('faq_open', { question: text(item.querySelector('summary')), faq_group: text(group) });
  }, true);   // toggle does not bubble

  // ── The scroll-told sections: which points of "What we do" and steps of "How it works" are reached ─────────
  // Their scripts mark the active step with a class; this only watches for it. Once per step per page view.
  const steps = new Set();
  const watchSteps = (root, name, selector) => {
    if (!root || !('MutationObserver' in window)) return;
    const items = [...root.querySelectorAll(selector)];
    const report = () => {
      if (root.classList.contains('is-static')) return;   // laid out as plain text: nothing is "reached"
      if (!seen.has(name)) return;                         // a step is active from the start, before the visitor is there
      const index = items.findIndex((el) => el.classList.contains('is-active'));
      const key = `${name}:${index}`;
      if (index < 0 || steps.has(key)) return;
      steps.add(key);
      track('story_step', { step_section: name, step_number: index + 1, step_name: text(items[index].querySelector('h3')) });
    };
    stepReports[name] = report;
    new MutationObserver(report).observe(root, { subtree: true, attributes: true, attributeFilter: ['class'] });
  };
  watchSteps(document.querySelector('[data-wwd]'), 'what-we-do', '.wwd__panel');
  watchSteps(document.querySelector('[data-how]'), 'how', '.how__step');

  // Star Track taking over the page (assets/star-track.js publishes data-star on the world)
  const world = document.querySelector('[data-star-world]');
  if (world && 'MutationObserver' in window) {
    let opened = false;
    new MutationObserver(() => {
      if (opened || world.dataset.star !== 'open') return;
      opened = true;
      track('star_track_open');
    }).observe(world, { attributes: true, attributeFilter: ['data-star'] });
  }

  // ── Copying text (a price, the email address) and printing (the terms) ────────────────────────────────
  document.addEventListener('copy', () => {
    const copied = String(getSelection() || '').replace(/\s+/g, ' ').trim();
    if (copied) track('text_copy', { copied_text: copied.slice(0, 100), section_id: current || undefined });
  });
  addEventListener('beforeprint', () => track('page_print'));

  // ── Script errors, so a broken page shows up in the numbers (at most 5 per page view) ──────────────────────
  let errors = 0;
  const reportError = (message, source) => {
    if (errors++ >= 5) return;
    track('js_error', { error_message: String(message).slice(0, 150), error_source: String(source || '').replace(location.origin, '').slice(0, 100) });
  };
  addEventListener('error', (e) => { if (e.message) reportError(e.message, `${e.filename || ''}:${e.lineno || 0}`); });
  addEventListener('unhandledrejection', (e) => reportError((e.reason && e.reason.message) || e.reason, 'promise'));

  // ── Web Vitals from real visitors: how fast the page felt (the numbers PageSpeed only estimates) ────────────
  // LCP: largest paint. CLS: layout shift (worst 5-second window). INP: slowest response to an interaction
  // (the slowest one, not the 98th percentile). FCP and TTFB: first paint and first byte.
  const vitals = {};
  const observe = (type, onEntry, options = {}) => {
    try { new PerformanceObserver((list) => list.getEntries().forEach(onEntry)).observe({ type, buffered: true, ...options }); } catch (e) { /* not supported here */ }
  };
  if ('PerformanceObserver' in window) {
    observe('largest-contentful-paint', (entry) => { vitals.LCP = entry.startTime; });
    observe('paint', (entry) => { if (entry.name === 'first-contentful-paint') vitals.FCP = entry.startTime; });
    let windowValue = 0; let windowStart = 0; let lastShift = 0;
    observe('layout-shift', (entry) => {
      if (entry.hadRecentInput) return;
      if (entry.startTime - lastShift > 1000 || entry.startTime - windowStart > 5000) { windowValue = 0; windowStart = entry.startTime; }
      lastShift = entry.startTime;
      windowValue += entry.value;
      vitals.CLS = Math.max(vitals.CLS || 0, windowValue);
    });
    observe('event', (entry) => { if (entry.interactionId) vitals.INP = Math.max(vitals.INP || 0, entry.duration); }, { durationThreshold: 40 });
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (nav) vitals.TTFB = nav.responseStart;
  }
  const limits = { LCP: [2500, 4000], FCP: [1800, 3000], CLS: [0.1, 0.25], INP: [200, 500], TTFB: [800, 1800] };
  let vitalsSent = false;
  const flushVitals = () => {
    if (vitalsSent) return;
    vitalsSent = true;
    if (!('CLS' in vitals) && 'LCP' in vitals) vitals.CLS = 0;   // no shift seen is a real result
    Object.entries(vitals).forEach(([name, value]) => {
      const [good, poor] = limits[name];
      track('web_vital', {
        metric_name: name,
        metric_value: name === 'CLS' ? Math.round(value * 1000) / 1000 : Math.round(value),
        metric_rating: value <= good ? 'good' : value <= poor ? 'needs-improvement' : 'poor',
      });
    });
  };

  // Leaving (or hiding the tab): the last moment these can be sent
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { flushSections(); flushVitals(); } else settle();
  });
  addEventListener('pagehide', () => { flushSections(); flushVitals(); });
})();
