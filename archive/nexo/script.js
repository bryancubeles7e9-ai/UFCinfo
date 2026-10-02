"use strict";
const $ = (selector) => document.querySelector(selector);
const storageKey = "nexo-workspace-v1";
const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const offsetDate = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return localDate(date);
};
const initialTasks = [
  ["Diseñar la página de inicio", "Mi web", "high", 0],
  ["Añadir interacciones con JavaScript", "Mi web", "medium", 1],
  ["Practicar flexbox y CSS Grid", "Aprendizaje", "medium", 2],
  ["Preparar el próximo proyecto", "Ideas", "low", 4],
  ["Conectar el repositorio de GitHub", "Mi web", "high", -1],
  ["Crear mi primera página HTML", "Aprendizaje", "low", -2],
].map(([title, project, priority, offset], index) => ({
  id: crypto.randomUUID(),
  title,
  project,
  priority,
  date: offsetDate(offset),
  done: index >= 4,
  completedAt: index >= 4 ? offsetDate(offset) : null,
}));
let state = { tasks: initialTasks, focusMinutes: 0, theme: "light" };
let storageAvailable = true;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (
    saved &&
    Array.isArray(saved.tasks) &&
    saved.tasks.every(
      (t) =>
        typeof t.id === "string" &&
        typeof t.title === "string" &&
        typeof t.project === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
        ["high", "medium", "low"].includes(t.priority) &&
        typeof t.done === "boolean",
    )
  ) {
    state = {
      tasks: saved.tasks,
      focusMinutes: Number.isFinite(saved.focusMinutes)
        ? saved.focusMinutes
        : 0,
      theme: saved.theme === "dark" ? "dark" : "light",
    };
  }
} catch {
  storageAvailable = false;
}
let filter = "all",
  editingId = null,
  deletingId = null,
  toastTimeout;
const priorityNames = { high: "Alta", medium: "Media", low: "Baja" };
const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(
    () => $("#toast").classList.remove("visible"),
    3500,
  );
}
function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    storageAvailable = false;
    toast("No se pudo guardar. Exporta tus tareas para conservarlas.");
  }
  if (!storageAvailable)
    $(".local-note").textContent = "● Almacenamiento local no disponible";
}
function formatDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
  });
}
function render() {
  document.body.classList.toggle("dark", state.theme === "dark");
  const pending = state.tasks.filter((t) => !t.done).length,
    done = state.tasks.length - pending;
  $("#pending-stat").textContent = pending;
  $("#nav-count").textContent = pending;
  $("#done-stat").textContent = done;
  $("#done-caption").textContent = state.tasks.length
    ? `${Math.round((done / state.tasks.length) * 100)} % de tus tareas completadas`
    : "Cada paso cuenta";
  $("#focus-stat").textContent = state.focusMinutes;
  const projects = [...new Set(state.tasks.map((t) => t.project))];
  $("#projects-stat").textContent = projects.filter((p) =>
    state.tasks.some((t) => t.project === p && !t.done),
  ).length;
  const query = $("#search").value.toLocaleLowerCase("es");
  let tasks = state.tasks.filter(
    (t) =>
      (filter === "all" || (filter === "done" ? t.done : !t.done)) &&
      `${t.title} ${t.project}`.toLocaleLowerCase("es").includes(query),
  );
  const rank = { high: 0, medium: 1, low: 2 };
  const sort = $("#sort").value;
  tasks.sort((a, b) =>
    sort === "name"
      ? a.title.localeCompare(b.title, "es")
      : sort === "priority"
        ? rank[a.priority] - rank[b.priority]
        : a.date.localeCompare(b.date),
  );
  $("#task-list").innerHTML = tasks.length
    ? tasks
        .map(
          (t) =>
            `<article class="task ${t.done ? "done" : ""}" data-id="${escapeHTML(t.id)}"><input class="check" type="checkbox" ${t.done ? "checked" : ""} aria-label="Completar: ${escapeHTML(t.title)}"><div class="task-info"><button class="task-title" title="Editar tarea">${escapeHTML(t.title)}</button><div class="task-meta"><span>${escapeHTML(t.project)}</span><span>·</span><span class="${!t.done && t.date < localDate() ? "overdue" : ""}">${t.date === localDate() ? "Hoy" : formatDate(t.date)}${!t.done && t.date < localDate() ? " · Atrasada" : ""}</span></div></div><span class="priority ${t.priority}">${priorityNames[t.priority]}</span><button class="delete-task" aria-label="Eliminar: ${escapeHTML(t.title)}" title="Eliminar tarea">×</button></article>`,
        )
        .join("")
    : "<div class='empty'>✦<br>No hay tareas que mostrar.<br>Añade una idea o cambia los filtros.</div>";
  $("#projects").innerHTML = projects.length
    ? projects
        .map((project, index) => {
          const list = state.tasks.filter((t) => t.project === project),
            completed = list.filter((t) => t.done).length,
            percent = Math.round((completed / list.length) * 100);
          return `<article class="project"><div class="project-top"><span class="project-icon">${["◈", "✳", "▦"][index % 3]}</span><small>${completed === list.length ? "COMPLETADO" : "EN MARCHA"}</small></div><h3>${escapeHTML(project)}</h3><p>${list.length} tareas · ${list.length - completed} pendientes</p><div class="progress-track" role="progressbar" aria-label="Progreso de ${escapeHTML(project)}" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><div style="width:${percent}%"></div></div><div class="project-progress"><span>Progreso del proyecto</span><span>${percent}%</span></div></article>`;
        })
        .join("")
    : "<p class='empty'>Tus proyectos aparecerán cuando añadas tareas.</p>";
  $("#project-options").innerHTML = projects
    .map((p) => `<option value="${escapeHTML(p)}"></option>`)
    .join("");
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = offsetDate(index - 6);
    return {
      date,
      count: state.tasks.filter((t) => t.done && t.completedAt === date).length,
    };
  });
  const max = Math.max(1, ...days.map((d) => d.count));
  $("#chart").innerHTML = days
    .map(
      (d) =>
        `<div class="chart-day" title="${formatDate(d.date)}: ${d.count} tareas"><div class="bar" style="height:${Math.max(4, (d.count / max) * 78)}%" aria-label="${formatDate(d.date)}: ${d.count} tareas"></div><small>${new Date(`${d.date}T12:00:00`).toLocaleDateString("es", { weekday: "short" }).replace(".", "")}</small></div>`,
    )
    .join("");
  $("#week-total").textContent =
    `${days.reduce((sum, d) => sum + d.count, 0)} tareas completadas esta semana. Sigue a tu ritmo.`;
}
function openTask(id = null) {
  editingId = id;
  $("#task-form").reset();
  const task = state.tasks.find((t) => t.id === id);
  $("#dialog-title").textContent = task
    ? "Dale forma a tu tarea"
    : "Una nueva idea";
  for (const key of ["title", "project", "date", "priority"]) {
    $("#task-form").elements[key].value = task
      ? task[key]
      : key === "date"
        ? localDate()
        : key === "priority"
          ? "medium"
          : "";
  }
  $("#task-dialog").showModal();
  $("#task-title").focus();
}
$("#new-task").addEventListener("click", () => openTask());
$("#add-inline").addEventListener("click", () => openTask());
for (const id of ["close-dialog", "cancel-dialog"])
  $(`#${id}`).addEventListener("click", () => $("#task-dialog").close());
$("#task-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.target),
    title = data.get("title").trim(),
    project = data.get("project").trim();
  if (!title || !project) {
    toast("Escribe un título y un proyecto.");
    return;
  }
  const fields = {
    title,
    project,
    date: data.get("date"),
    priority: data.get("priority"),
  };
  if (editingId) {
    Object.assign(
      state.tasks.find((t) => t.id === editingId),
      fields,
    );
  } else {
    state.tasks.push({
      id: crypto.randomUUID(),
      ...fields,
      done: false,
      completedAt: null,
    });
  }
  save();
  render();
  $("#task-dialog").close();
  toast(editingId ? "Tarea actualizada" : "Tu nueva idea ya tiene su lugar");
});
$("#task-list").addEventListener("change", (event) => {
  if (!event.target.matches(".check")) return;
  const task = state.tasks.find(
    (t) => t.id === event.target.closest(".task").dataset.id,
  );
  task.done = event.target.checked;
  task.completedAt = task.done ? localDate() : null;
  save();
  render();
  toast(
    task.done
      ? "¡Un paso más! Tarea completada"
      : "Tarea marcada como pendiente",
  );
});
$("#task-list").addEventListener("click", (event) => {
  const row = event.target.closest(".task");
  if (!row) return;
  if (event.target.closest(".task-title")) openTask(row.dataset.id);
  if (event.target.closest(".delete-task")) {
    deletingId = row.dataset.id;
    $("#delete-dialog").showModal();
  }
});
$("#cancel-delete").addEventListener("click", () =>
  $("#delete-dialog").close(),
);
$("#confirm-delete").addEventListener("click", () => {
  state.tasks = state.tasks.filter((t) => t.id !== deletingId);
  save();
  render();
  $("#delete-dialog").close();
  toast("Tarea eliminada");
});
document.querySelectorAll("[data-filter]").forEach((button) =>
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((b) => {
      b.classList.toggle("selected", b === button);
      b.setAttribute("aria-pressed", String(b === button));
    });
    render();
  }),
);
$("#search").addEventListener("input", render);
$("#sort").addEventListener("change", render);
for (const id of ["theme", "theme-header"])
  $(`#${id}`).addEventListener("click", () => {
    state.theme = state.theme === "light" ? "dark" : "light";
    save();
    render();
  });
$("#export").addEventListener("click", () => {
  const link = document.createElement("a"),
    url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
  link.href = url;
  link.download = `nexo-${localDate()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Copia de tus datos exportada");
});
const viewNames = {
  inicio: "Vista general",
  tareas: "Mis tareas",
  proyectos: "Proyectos",
  enfoque: "Tiempo de enfoque",
};
function navigate(view) {
  if (!viewNames[view]) view = "inicio";
  document.querySelectorAll("[data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view);
    if (b.dataset.view === view) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  $("#breadcrumb").textContent = viewNames[view];
  $(".hero").hidden = view !== "inicio";
  $(".stats").hidden = view !== "inicio";
  $(".content-grid").hidden = view === "proyectos";
  $("#tasks-section").hidden = view === "enfoque";
  $(".right-column").hidden = view === "tareas";
  $("#projects-section").hidden = view === "tareas" || view === "enfoque";
  $(".content-grid").style.gridTemplateColumns =
    view === "tareas" || view === "enfoque" ? "1fr" : "";
  $("#page-title").textContent = {
    inicio: "Haz espacio para tus ideas.",
    tareas: "Una tarea a la vez.",
    proyectos: "De idea a realidad.",
    enfoque: "Este momento es para ti.",
  }[view];
}
document.querySelectorAll("[data-view]").forEach((button) =>
  button.addEventListener("click", () => {
    location.hash = button.dataset.view;
  }),
);
window.addEventListener("hashchange", () => navigate(location.hash.slice(1)));
$("#hero-focus").addEventListener("click", () => {
  location.hash = "enfoque";
});
document.addEventListener("keydown", (event) => {
  const typing =
    event.target.matches("input,textarea,select") ||
    event.target.isContentEditable;
  if (
    event.key === "/" &&
    !typing &&
    !$("#task-dialog").open &&
    !$("#delete-dialog").open
  ) {
    event.preventDefault();
    if (location.hash === "#proyectos" || location.hash === "#enfoque")
      location.hash = "tareas";
    $("#search").focus();
  }
});
let totalSeconds = 25 * 60,
  remaining = totalSeconds,
  deadline = null,
  running = false;
function updateTimer() {
  if (running) {
    remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (remaining === 0) {
      running = false;
      state.focusMinutes += totalSeconds / 60;
      save();
      render();
      toast("¡Sesión completada! Buen trabajo. Tómate un descanso.");
    }
  }
  $("#timer").textContent =
    `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  $("#timer-state").textContent = running
    ? "Una cosa a la vez"
    : remaining === 0
      ? "¡Sesión completada!"
      : remaining < totalSeconds
        ? "Respira. Retoma cuando quieras."
        : "Todo listo para empezar";
  $("#timer-toggle").textContent = running
    ? "Ⅱ Pausar"
    : remaining === 0
      ? "↺ Otra sesión"
      : "▶ Empezar";
  $(".timer-ring").style.setProperty(
    "--progress",
    `${(1 - remaining / totalSeconds) * 100}%`,
  );
  $("#duration").disabled = running;
}
$("#timer-toggle").addEventListener("click", () => {
  if (running) {
    remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    running = false;
  } else {
    if (remaining === 0) remaining = totalSeconds;
    deadline = Date.now() + remaining * 1000;
    running = true;
  }
  updateTimer();
});
$("#timer-reset").addEventListener("click", () => {
  running = false;
  remaining = totalSeconds;
  updateTimer();
});
$("#duration").addEventListener("change", () => {
  running = false;
  totalSeconds = Number($("#duration").value) * 60;
  remaining = totalSeconds;
  updateTimer();
});
setInterval(updateTimer, 500);
$("#today").textContent = new Date().toLocaleDateString("es", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
document
  .querySelectorAll("[data-filter]")
  .forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.filter === "all")),
  );
save();
render();
navigate(location.hash.slice(1));
updateTimer();
