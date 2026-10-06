import { $ } from "./utils.js";
import { directoryFighterById } from "./fighter-directory.js";

export function reconcileFollowing(base, desired, remote) {
  const baseSet = new Set(base), desiredSet = new Set(desired);
  const removed = new Set(base.filter(id => !desiredSet.has(id)));
  return [...new Set([...remote.filter(id => !removed.has(id)), ...desired.filter(id => !baseSet.has(id))])];
}

export class AccountError extends Error {
  constructor(message, status = 0, body = {}) { super(message); this.status = status; this.body = body; }
}

export async function accountRequest(path, {method = "GET", body, csrf} = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`/api/${path}`, {
      method, credentials: "same-origin", cache: "no-store", signal: controller.signal,
      headers: {"Accept": "application/json", ...(body ? {"Content-Type": "application/json"} : {}), ...(csrf ? {"X-Octagon-CSRF": csrf} : {})},
      ...(body ? {body: JSON.stringify(body)} : {}),
    });
    if (!response.headers.get("Content-Type")?.includes("application/json")) throw new AccountError("El acceso a cuentas no está disponible en esta versión. Puedes seguir usando Mi esquina como invitado.", response.status);
    const data = await response.json();
    if (!response.ok) throw new AccountError(data.error || "No se pudo completar la solicitud.", response.status, data);
    return data;
  } catch (error) {
    if (error instanceof AccountError) throw error;
    throw new AccountError("No se pudo conectar con tu cuenta. Tus cambios siguen guardados en este navegador.");
  } finally { clearTimeout(timeout); }
}

const validFavorites = value => Array.isArray(value) && value.length <= 165 && new Set(value).size === value.length && value.every(id => typeof id === "string" && directoryFighterById(id));

export function initializeAccount({store, onChange}) {
  let user = null, csrf = "", revision = 0, base = [], dirty = false, generation = 0, expired = false;
  let worker = null, timer = null, mode = "login", available = true, ready = false, busy = false;
  const cacheKey = id => `octagon-following-sync:${id}`;
  const status = message => { $("#account-sync-status").textContent = message; if (user) $("#storage-status").textContent = expired ? "○ Sesión caducada" : dirty ? "○ Cuenta · cambios pendientes" : "● Cuenta sincronizada"; };
  function pendingCache() {
    if (!user) return;
    try {
      localStorage.setItem(cacheKey(user.id), JSON.stringify({base, desired: [...store.state.favorites], dirty}));
    } catch { /* Local storage failure is also reported by the main store. */ }
  }
  function readPending(id) {
    try {
      const pending = JSON.parse(localStorage.getItem(cacheKey(id)) || "null");
      return pending?.dirty && validFavorites(pending.base) && validFavorites(pending.desired) ? pending : null;
    } catch { return null; }
  }
  function render() {
    $("#account-open").textContent = user ? "Mi cuenta" : "Iniciar sesión";
    $("#account-panel-title").setAttribute("translate", user ? "no" : "yes");
    $("#account-panel-title").textContent = user ? user.email : "Guarda tu esquina en una cuenta";
    $("#account-panel-copy").textContent = user ? "Tu lista de luchadores seguidos se guarda en tu cuenta y se recupera al iniciar sesión desde otro dispositivo." : "Crea una cuenta o inicia sesión para recuperar tus luchadores seguidos desde otros dispositivos. También puedes seguir usando el modo invitado.";
    $("#account-logout").hidden = !user;
    $("#account-enter").hidden = !!user;
    $("#account-retry").hidden = !user || !dirty;
    $("#account-open").disabled = $("#account-enter").disabled = !ready || busy;
    $("#account-logout").disabled = busy;
    $("#auth-submit").disabled = busy || !ready || !available;
    $("#auth-login-tab").setAttribute("aria-pressed", String(mode === "login"));
    $("#auth-register-tab").setAttribute("aria-pressed", String(mode === "register"));
    $("#auth-password").autocomplete = mode === "login" ? "current-password" : "new-password";
    $("#auth-password").minLength = mode === "register" ? 12 : 1;
    $("#auth-import-local-row").hidden = mode !== "register";
    $("#auth-submit").textContent = busy ? "Espera…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta";
    $("#auth-title").textContent = user ? "Tu cuenta" : mode === "login" ? "Inicia sesión" : "Crea tu cuenta";
    $("#auth-form").hidden = !!user && !expired;
    $("#auth-signed-in").hidden = !user || expired;
    $("#auth-register-tab").disabled = !!user && expired;
    $("#auth-email").readOnly = !!user && expired;
    $("#auth-signed-email").textContent = user?.email || "";
  }
  function validateRemote(data) {
    if (!data.user?.id || !data.user?.email || !validFavorites(data.favorites) || !Number.isInteger(data.revision) || typeof data.csrf !== "string") throw new AccountError("La cuenta devolvió datos no válidos.");
  }
  async function sync() {
    if (!user || !dirty) return;
    if (worker) { await worker; if (dirty && user) return sync(); return; }
    const ticket = generation;
    const run = async () => {
      while (dirty && user && ticket === generation) {
        const sent = [...store.state.favorites];
        status("Guardando tu seguimiento en la cuenta…");
        try {
          const data = await accountRequest("me/following", {method:"PUT", csrf, body:{favorites:sent, revision}});
          if (ticket !== generation) return;
          validateRemote(data);
          base = [...data.favorites]; revision = data.revision;
          dirty = JSON.stringify(sent) !== JSON.stringify(store.state.favorites);
          pendingCache();
          status(dirty ? "Guardando cambios recientes…" : "Seguimiento guardado en tu cuenta.");
        } catch (error) {
          if (ticket !== generation) return;
          if (error.status === 409) {
            validateRemote(error.body);
            store.state.favorites = reconcileFollowing(base, store.state.favorites, error.body.favorites);
            base = [...error.body.favorites]; revision = error.body.revision;
            store.save(); pendingCache(); onChange();
            continue;
          }
          if (error.status === 401) { expired = true; mode = "login"; $("#auth-email").value = user.email; }
          status(error.status === 401 ? "Tu sesión ha caducado. Inicia sesión para guardar los cambios pendientes." : error.message);
          pendingCache();
          break;
        }
      }
      render();
    };
    worker = run();
    try { await worker; } finally { worker = null; }
  }
  async function activate(data) {
    validateRemote(data);
    const pending = readPending(data.user.id);
    generation++; clearTimeout(timer);
    user = data.user; expired = false; csrf = data.csrf; revision = data.revision; base = [...data.favorites];
    store.useScope(user.id);
    store.state.favorites = pending ? reconcileFollowing(pending.base, pending.desired, data.favorites) : [...data.favorites];
    dirty = !!pending;
    store.save(); pendingCache(); onChange();
    status(dirty ? "Recuperando cambios pendientes…" : "Seguimiento guardado en tu cuenta.");
    $("#auth-password").value = "";
    render();
    if (dirty) await sync();
  }
  function notifyLocalChange() {
    if (!user) { status("Modo invitado · Datos guardados en este navegador."); return; }
    dirty = !!worker || JSON.stringify(base) !== JSON.stringify(store.state.favorites);
    pendingCache(); render();
    if (!dirty) { status("Seguimiento guardado en tu cuenta."); return; }
    status("Cambios pendientes de guardar en tu cuenta…");
    clearTimeout(timer); timer = setTimeout(sync, 350);
  }
  async function refresh() {
    if (!ready || !user || busy || worker) return;
    if (dirty) return sync();
    const ticket = generation;
    const before = JSON.stringify(store.state.favorites);
    try {
      const data = await accountRequest("me/following");
      if (ticket !== generation || dirty || before !== JSON.stringify(store.state.favorites)) return;
      validateRemote(data);
      store.state.favorites = [...data.favorites]; base = [...data.favorites]; revision = data.revision;
      store.save(); pendingCache(); onChange(); status("Seguimiento guardado en tu cuenta.");
    } catch (error) {
      if (error.status === 401) { expired = true; mode = "login"; $("#auth-email").value = user.email; render(); }
      status(error.message);
    }
  }
  function open() { $("#auth-error").textContent = available ? "" : "El acceso a cuentas no está disponible en esta versión. Puedes seguir usando Mi esquina como invitado."; render(); $("#auth-dialog").showModal(); }
  $("#account-open").addEventListener("click", open);
  $("#account-enter").addEventListener("click", open);
  $("#account-retry").addEventListener("click", sync);
  $("#auth-login-tab").addEventListener("click", () => {mode="login"; $("#auth-error").textContent=""; render();});
  $("#auth-register-tab").addEventListener("click", () => {mode="register"; $("#auth-error").textContent=""; render();});
  $("#auth-form").addEventListener("submit", async event => {
    event.preventDefault(); if (busy || !available) return;
    busy = true; render(); $("#auth-error").textContent = "";
    try {
      const data = await accountRequest(`auth/${mode}`, {method:"POST", body:{email:$("#auth-email").value, password:$("#auth-password").value, ...(mode === "register" ? {favorites:$("#auth-import-local").checked ? [...store.state.favorites] : []} : {})}});
      await activate(data);
      $("#auth-dialog").close();
    } catch (error) { $("#auth-error").textContent = error.message; }
    finally { busy=false; render(); }
  });
  async function logout() {
    if (busy || !user) return;
    busy = true; render();
    try {
      clearTimeout(timer);
      if (!expired) await sync();
      if (dirty && !expired) { status("Hay cambios sin guardar. Reintenta la sincronización antes de cerrar sesión."); return; }
      if (!expired) await accountRequest("auth/logout", {method:"POST", csrf, body:{}});
      generation++; user=null; expired=false; csrf=""; base=[]; dirty=false;
      store.useScope(); onChange(); status("Modo invitado · Datos guardados en este navegador.");
      if ($("#auth-dialog").open) $("#auth-dialog").close();
    } catch (error) { status(error.message); }
    finally {busy=false; render();}
  }
  $("#account-logout").addEventListener("click", logout);
  $("#auth-logout").addEventListener("click", logout);
  document.addEventListener("visibilitychange", () => {if (!document.hidden) refresh();});
  window.addEventListener("online", refresh);
  setInterval(refresh, 60000);
  render(); status("Comprobando si tienes una sesión abierta…");
  accountRequest("auth/session").then(data => data.user ? activate(data) : status("Modo invitado · Datos guardados en este navegador.")).catch(error => {available=false; status(error.message);}).finally(() => {ready=true;render();});
  return {notifyLocalChange};
}
