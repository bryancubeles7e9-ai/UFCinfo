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
  // After the page has loaded and gone idle: the offline copy must not compete with the first view.
  const register = () => navigator.serviceWorker.register('/assets/sw.js', {scope: '/'}).catch(() => {});
  const idle = () => (window.requestIdleCallback ? requestIdleCallback(register, {timeout: 5000}) : setTimeout(register, 2000));
  if (document.readyState === 'complete') idle(); else window.addEventListener('load', idle, {once: true});
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
    // Without a connection the server is not restarting: the offline notice explains it instead.
    if (notice || navigator.onLine === false) return;
    notice = document.createElement('div');
    notice.className = 'server-restart-notice';
    notice.setAttribute('role', 'status');
    notice.innerHTML = '<span class="server-restart-spinner" aria-hidden="true"></span><span>Estamos actualizando la web. Tu acción se completará en unos segundos.</span>';
    document.body.append(notice);
  });
  document.addEventListener('ufcinfo:server-back', () => { notice?.remove(); notice = null; });
  window.addEventListener('offline', () => { notice?.remove(); notice = null; });
}

// Without a connection the installed app opens from the copy saved by the service worker:
// tell the visitor that what they see is the last data downloaded on this device.
export function offlineNoticeText() {
  return 'Sin conexión. Estás viendo los últimos datos guardados en este dispositivo; pueden no estar al día.';
}
export function initializeOfflineNotice(win = window) {
  let notice = null;
  const update = () => {
    if (win.navigator.onLine === false && !notice) {
      notice = win.document.createElement('div');
      notice.className = 'offline-notice';
      notice.setAttribute('role', 'status');
      notice.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.3-1.6M1.4 9a15 15 0 0 1 4.2-2.6M22.6 9A15 15 0 0 0 10.7 5M12 20h.01"/></svg><span></span>';
      notice.querySelector('span').textContent = offlineNoticeText();
      win.document.body.append(notice);
    } else if (win.navigator.onLine !== false && notice) {
      notice.remove(); notice = null;
    }
  };
  win.addEventListener('online', update);
  win.addEventListener('offline', update);
  update();
}
