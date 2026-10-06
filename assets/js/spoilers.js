import { escapeHTML as esc } from "./utils.js";
let enabled = true;
const revealed = new Set();
export const spoilersEnabled = () => enabled;
export function setSpoilersEnabled(value) {
  enabled = Boolean(value);
  revealed.clear();
}
export function revealResult(key) { revealed.add(key); }
export function resultHidden(key) { return enabled && !revealed.has(key); }
export function hiddenResult(key) {
  return `Resultado oculto · <button class="text-link" data-reveal-result="${esc(key)}">Mostrar resultado</button>`;
}
