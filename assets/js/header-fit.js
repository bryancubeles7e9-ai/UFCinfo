// Wide screens show the sections and the header buttons on one row. When they do not fit
// (1280–1440 px screens, longer Catalan labels, signed-in names…), the sections move to a second row,
// as they already do below 1200 px, instead of pushing buttons off the screen.
export function initializeHeaderFit(header = document.querySelector('.header')) {
  if (!header) return;
  let frame = 0;
  const fit = () => {
    frame = 0;
    if (window.innerWidth <= 1200) { header.classList.remove('is-stacked'); return; }
    header.classList.remove('is-stacked');
    if (header.scrollWidth > header.clientWidth + 1) header.classList.add('is-stacked');
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(fit); };
  fit();
  window.addEventListener('resize', schedule);
  document.addEventListener('ufcinfo:language-changed', schedule);
  document.fonts?.ready.then(schedule);
  // Button labels change after sign-in or when spoilers are toggled.
  new MutationObserver(schedule).observe(header.querySelector('.header-actions') || header, { subtree: true, childList: true, characterData: true });
}
