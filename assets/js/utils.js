import { getLocale } from "./i18n.js";
export const $ = (selector) => document.querySelector(selector);
export const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export const formatDate = (date) =>
  new Date(date).toLocaleDateString(getLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
export const formatTime = (date) =>
  new Date(date).toLocaleTimeString(getLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
export function countdown(date) {
  const milliseconds = Math.max(0, Date.parse(date) - Date.now());
  return {
    days: Math.floor(milliseconds / 86400000),
    hours: Math.floor(milliseconds / 3600000) % 24,
    minutes: Math.floor(milliseconds / 60000) % 60,
    seconds: Math.floor(milliseconds / 1000) % 60,
    ended: milliseconds === 0,
  };
}
export function localDatetime(date) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
}
let timeout;
export function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(timeout);
  timeout = setTimeout(() => $("#toast").classList.remove("visible"), 3600);
}

// UFC publishes bout classes in English ("Women's Flyweight Title Bout"); show them in Spanish like the rest of the site.
const boutWeights = { 'light heavyweight': 'semipesado', heavyweight: 'pesado', middleweight: 'medio', welterweight: 'wélter',
  lightweight: 'ligero', featherweight: 'pluma', bantamweight: 'gallo', flyweight: 'mosca', strawweight: 'paja',
  catchweight: 'pactado', 'catch weight': 'pactado' };
export function boutDivisionLabel(value) {
  const text = String(value || '').trim();
  const lower = text.toLowerCase();
  const weight = Object.keys(boutWeights).find(name => lower.includes(name));
  if (!weight) return text;
  const women = /women/.test(lower) ? ' femenino' : '';
  const name = `peso ${boutWeights[weight]}${women}`;
  if (/title|interim/.test(lower)) return `${/interim/.test(lower) ? 'Título interino' : 'Título'} del ${name}`;
  return name[0].toUpperCase() + name.slice(1);
}
