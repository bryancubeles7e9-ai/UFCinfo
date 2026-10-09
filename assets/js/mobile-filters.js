// Preserve selections when the mobile filter panel is folded away.
export function initializeMobileFilters() {
  const controls = document.getElementById('fighter-filter-controls');
  const panel = document.getElementById('fighter-filters');
  const toggle = document.getElementById('fighter-filter-toggle');
  const reset = document.getElementById('fighter-filter-reset');
  const counter = document.getElementById('fighter-active-filters');
  const followed = document.getElementById('favorites-only');
  if (!controls || !panel || !toggle || !reset || !counter || !followed) return;
  const defaults = new Map([
    ['style-filter', 'all'], ['division-filter', 'all'], ['stance-filter', 'all'],
    ['championship-filter', 'all'], ['fighter-sort', 'featured'],
  ]);
  const inputs = [...defaults].map(([id, value]) => [document.getElementById(id), value]);
  const update = () => {
    const count = inputs.filter(([input, value]) => input.value !== value).length
      + Number(followed.getAttribute('aria-pressed') === 'true');
    counter.textContent = String(count);
    counter.hidden = count === 0;
    reset.hidden = count === 0;
  };
  const setOpen = open => {
    panel.classList.toggle('mobile-filters-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  panel.classList.add('mobile-filters-ready');
  controls.hidden = false;
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  for (const [input] of inputs) input.addEventListener('change', update);
  // The existing handler updates the followed-only filter before this listener.
  followed.addEventListener('click', update);
  reset.addEventListener('click', () => {
    for (const [input, value] of inputs) {
      if (input.value === value) continue;
      input.value = value;
      input.dispatchEvent(new Event('change', {bubbles: true}));
    }
    if (followed.getAttribute('aria-pressed') === 'true') followed.click();
    update();
    toggle.focus();
  });
  const mobile = window.matchMedia('(max-width: 700px)');
  mobile.addEventListener('change', () => {
    // Keep focused inputs visible when rotating into the mobile layout.
    if (mobile.matches && panel.contains(document.activeElement)) setOpen(true);
  });
  update();
}
