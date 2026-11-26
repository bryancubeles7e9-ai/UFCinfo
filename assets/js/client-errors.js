// Reports this site's own script errors so failures seen only by visitors reach the server logs.
const sent = new Set();
let budget = 5;

export function errorReport({message, filename, lineno, colno}, location = globalThis.location) {
  // Only report our own scripts; browser extensions and third-party frames are not ours to fix.
  if (!filename || !location || new URL(filename, location.href).origin !== location.origin) return null;
  return {
    message: String(message || 'Error').slice(0, 300),
    source: new URL(filename, location.href).pathname.slice(0, 200),
    line: Number.isInteger(lineno) ? lineno : null,
    column: Number.isInteger(colno) ? colno : null,
    view: String(location.hash || '#inicio').split('?')[0].slice(0, 40),
    browser: String(globalThis.navigator?.userAgent || '').slice(0, 160),
  };
}

function send(report) {
  const key = `${report.message}|${report.source}|${report.line}`;
  if (budget <= 0 || sent.has(key)) return;
  sent.add(key); budget--;
  fetch('/api/client-errors', {method: 'POST', credentials: 'same-origin', keepalive: true,
    headers: {'Content-Type': 'application/json'}, body: JSON.stringify(report)}).catch(() => {});
}

// The service worker only replaces Render's restart error page with a friendly one.
export function registerUpdatingPage() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register('/assets/sw.js', {scope: '/'}).catch(() => {});
}

export function initializeClientErrors() {
  window.addEventListener('error', event => {
    const report = errorReport(event);
    if (report) send(report);
  });
  window.addEventListener('unhandledrejection', event => {
    const stack = String(event.reason?.stack || '');
    const frame = stack.match(/(https?:\/\/[^\s)]+?\.js):(\d+):(\d+)/);
    const report = frame && errorReport({message: `Promesa rechazada: ${event.reason?.message || event.reason}`,
      filename: frame[1], lineno: Number(frame[2]), colno: Number(frame[3])});
    if (report) send(report);
  });
}

// While a request waits for the server to restart, tell the visitor why instead of failing silently.
export function initializeRestartNotice() {
  let notice = null;
  document.addEventListener('ufcinfo:server-restarting', () => {
    if (notice) return;
    notice = document.createElement('div');
    notice.className = 'server-restart-notice';
    notice.setAttribute('role', 'status');
    notice.innerHTML = '<span class="server-restart-spinner" aria-hidden="true"></span><span>Estamos actualizando la web. Tu acción se completará en unos segundos.</span>';
    document.body.append(notice);
  });
  document.addEventListener('ufcinfo:server-back', () => { notice?.remove(); notice = null; });
}
