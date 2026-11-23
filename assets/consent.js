// Cookie consent for Google Analytics (loaded through Google Tag Manager, GTM-TL7MM2F3).
// The tag itself is in each page's <head>: it starts with Consent Mode v2 set to "denied" unless the visitor
// already accepted, so no analytics cookie is written before a choice. This file shows the banner, saves
// the choice, tells Google about it, and lets the visitor change it from the footer ("Cookie settings").
// Advertising storage stays denied always: the privacy policy promises no advertising cookies.
(() => {
  const KEY = 'cz-consent';   // "granted" | "denied"; also read by the <head> snippet
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* storage blocked: ask every visit */ }

  window.dataLayer = window.dataLayer || [];
  const gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  // Declining after accepting: remove the Google Analytics cookies already written (_ga, _ga_<id>, _gid, _gat)
  const clearAnalyticsCookies = () => {
    const parts = location.hostname.split('.');
    const domains = [''];
    for (let i = 0; i < parts.length - 1; i++) domains.push('.' + parts.slice(i).join('.'));
    document.cookie.split(';').map((c) => c.split('=')[0].trim())
      .filter((name) => /^_ga($|_)|^_gid$|^_gat/.test(name))
      .forEach((name) => domains.forEach((d) => { document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`; }));
  };

  let banner = null;
  const hide = () => { if (banner) banner.hidden = true; };

  const choose = (value) => {
    try { localStorage.setItem(KEY, value); } catch (e) { /* the choice holds for this page view only */ }
    gtag('consent', 'update', { analytics_storage: value });
    window.dataLayer.push({ event: 'consent_choice', method: value });   // reported like the events of assets/analytics.js
    if (value === 'denied') clearAnalyticsCookies();
    hide();
  };

  const show = () => {
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'cz-consent cz-glass';
      banner.setAttribute('role', 'region');
      banner.setAttribute('aria-label', 'Cookie consent');
      banner.innerHTML =
        '<p class="cz-consent__text">We would like to use Google Analytics cookies to see how visitors use this website. ' +
        'Nothing is stored unless you accept. <a href="privacy.html#visitors">Privacy Policy</a></p>' +
        '<div class="cz-consent__actions">' +
        '<button type="button" class="cz-btn cz-btn--sm cz-glass cz-glass--interactive" data-choice="denied">Decline</button>' +
        '<button type="button" class="cz-btn cz-btn--sm cz-glass cz-glass--interactive" data-choice="granted">Accept</button>' +
        '</div>';
      banner.addEventListener('click', (e) => {
        const button = e.target.closest('[data-choice]');
        if (button) choose(button.dataset.choice);
      });
      document.body.append(banner);
    }
    banner.hidden = false;
  };

  const ready = () => {
    if (saved !== 'granted' && saved !== 'denied') show();
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-cookie-settings]');
      if (!link) return;
      e.preventDefault();
      show();
      banner.querySelector('button').focus();
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
