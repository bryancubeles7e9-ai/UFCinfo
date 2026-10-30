// Manual placements only. No Google connection until configuration AND CMP consent.
const CLIENT = /^ca-pub-[0-9]{16}$/;
const SLOT = /^[0-9]{10}$/;

export function validAdConfig(config, origin) {
  if (!config || config.enabled !== true || config.certifiedCmpReady !== true ||
      !CLIENT.test(config.client ?? '') || !config.slots ||
      !SLOT.test(config.slots.home ?? '') || !SLOT.test(config.slots.events ?? '')) return false;
  try {
    const privacy = new URL(config.privacyUrl, origin);
    return typeof config.privacyUrl === 'string' && config.privacyUrl.startsWith('/') &&
      privacy.origin === origin && privacy.pathname !== '/';
  } catch { return false; }
}

export function consentAllowsAds(data, success) {
  if (success !== true || data?.cmpStatus !== 'loaded' ||
      !['tcloaded', 'useractioncomplete'].includes(data.eventStatus)) return false;
  if (data.gdprApplies === false) return true;
  // Conservative: no ads at all without explicit storage/personalisation consent.
  return data.gdprApplies === true && typeof data.tcString === 'string' && !!data.tcString &&
    data.vendor?.consents?.[755] === true &&
    [1, 3, 4].every(id => data.purpose?.consents?.[id] === true);
}

export async function initializeAdSense({doc = document, win = window, fetcher = fetch} = {}) {
  let config;
  try {
    const response = await fetcher('assets/data/adsense.json', {cache: 'no-cache', credentials: 'omit'});
    if (!response.ok) return;
    config = await response.json();
  } catch { return; }
  if (!validAdConfig(config, win.location.origin)) return;

  const placements = [...doc.querySelectorAll('[data-ad-placement]')];
  const requested = new WeakSet();
  let permitted = false, failed = false, scriptPromise, injected = false;
  const label = () => ({en: 'Advertisement', ca: 'Publicitat'}[doc.documentElement.lang] || 'Publicidad');
  const hide = () => placements.forEach(node => { node.hidden = true; });

  function loadScript() {
    if (!scriptPromise) {
      scriptPromise = new Promise((resolve, reject) => {
        const script = doc.createElement('script');
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.client}`;
        script.addEventListener('load', resolve, {once: true});
        script.addEventListener('error', reject, {once: true});
        injected = true;
        doc.head.append(script);
      });
    }
    return scriptPromise;
  }

  async function request(node) {
    if (!permitted || failed || requested.has(node) || node.closest('[hidden]') || node.clientWidth <= 0) return;
    requested.add(node);
    try {
      await loadScript();
      if (!permitted || failed || node.closest('[hidden]')) { requested.delete(node); return; }
      const unit = doc.createElement('ins');
      unit.className = 'adsbygoogle';
      unit.setAttribute('data-no-translate', '');
      unit.setAttribute('data-ad-client', config.client);
      unit.setAttribute('data-ad-slot', config.slots[node.dataset.adPlacement]);
      unit.setAttribute('data-ad-format', 'auto');
      unit.setAttribute('data-full-width-responsive', 'true');
      node.append(unit);
      (win.adsbygoogle = win.adsbygoogle || []).push({});
    } catch {
      failed = true;
      hide(); // Blocking ads must not break the rest of UFCinfo.
    }
  }

  const observer = typeof win.IntersectionObserver === 'function' ? new win.IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) request(entry.target);
  }, {rootMargin: '200px'}) : null;
  function refresh() {
    if (!permitted || failed) return;
    for (const node of placements) {
      node.hidden = false;
      node.setAttribute('aria-label', label());
      const caption = node.querySelector('.ad-placement-label');
      if (caption) caption.textContent = label();
      if (observer) observer.observe(node);
      else if (!node.closest('[hidden]')) request(node);
    }
  }
  function consentChanged(data, success) {
    // Opening preferences is not a withdrawal; wait for the actual decision.
    if (success === true && data?.cmpStatus === 'loaded' && data.eventStatus === 'cmpuishown') return;
    const next = consentAllowsAds(data, success);
    if (permitted && !next && injected) {
      permitted = false;
      hide();
      observer?.disconnect();
      // Executed third-party scripts cannot be unloaded. Restart without them.
      win.location.reload();
      return;
    }
    permitted = next;
    if (permitted) refresh();
    else hide();
  }

  // CMP snippet comes from the publisher's certified CMP, never a homemade banner.
  let attempts = 0;
  function connectCmp() {
    if (typeof win.__tcfapi === 'function') {
      try { win.__tcfapi('addEventListener', 2, consentChanged); } catch { hide(); }
    } else if (++attempts < 20) win.setTimeout(connectCmp, 500);
  }
  hide();
  const privacy = doc.querySelector('[data-ads-privacy]');
  if (privacy) {
    privacy.href = config.privacyUrl;
    privacy.hidden = false;
    const localize = () => { privacy.textContent = ({en: 'Privacy and advertising', ca: 'Privacitat i publicitat'}[doc.documentElement.lang] || 'Privacidad y publicidad'); };
    privacy.setAttribute('data-no-translate', '');
    doc.addEventListener('ufcinfo:language-changed', localize);
    localize();
  }
  win.addEventListener('hashchange', refresh);
  doc.addEventListener('ufcinfo:language-changed', refresh);
  connectCmp();
}
