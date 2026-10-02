import { fighters, fighterById, fullName, attributes } from "./data.js";
import { $, escapeHTML } from "./utils.js";
export function calculateModel(red, blue, weights) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!total) return null;
  const redScore =
    red.stats.reduce((sum, stat, index) => sum + stat * weights[index], 0) /
    total;
  const blueScore =
    blue.stats.reduce((sum, stat, index) => sum + stat * weights[index], 0) /
    total;
  return {
    redScore,
    blueScore,
    share: (redScore / (redScore + blueScore)) * 100,
  };
}
export function initializeLab(onSave) {
  let weights = [60, 60, 60, 60, 60];
  const options = fighters
    .map((f) => `<option value="${f.id}">${escapeHTML(fullName(f))}</option>`)
    .join("");
  $("#red-fighter").innerHTML = options;
  $("#blue-fighter").innerHTML = options;
  $("#blue-fighter").value = "holloway";
  $("#weight-controls").innerHTML = attributes
    .map(
      (a, i) =>
        `<label class="weight-control">${a.label}<output id="weight-${i}">60</output><input data-weight="${i}" type="range" min="0" max="100" step="5" value="60" aria-label="Importancia de ${a.label}"></label>`,
    )
    .join("");
  function draw() {
    const red = fighterById($("#red-fighter").value),
      blue = fighterById($("#blue-fighter").value);
    $("#versus-header").innerHTML =
      `<div><small>${escapeHTML(red.first)}</small><strong>${escapeHTML(red.last)}</strong></div><span>VS</span><div><small>${escapeHTML(blue.first)}</small><strong>${escapeHTML(blue.last)}</strong></div>`;
    const center = [210, 145],
      radius = 106;
    const point = (i, scale) => {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      return [
        center[0] + Math.cos(angle) * radius * scale,
        center[1] + Math.sin(angle) * radius * scale,
      ];
    };
    const polygon = (scale) =>
      attributes.map((_, i) => point(i, scale).join(",")).join(" ");
    let svg = `<title>Comparación de ${escapeHTML(fullName(red))} y ${escapeHTML(fullName(blue))}. Atributos ficticios.</title>`;
    for (const scale of [0.25, 0.5, 0.75, 1])
      svg += `<polygon points="${polygon(scale)}" fill="none" stroke="var(--line)"/>`;
    attributes.forEach((a, i) => {
      const end = point(i, 1),
        label = point(i, 1.25);
      svg += `<line x1="210" y1="145" x2="${end[0]}" y2="${end[1]}" stroke="var(--line)"/><text x="${label[0]}" y="${label[1]}" text-anchor="middle" dominant-baseline="middle" fill="var(--muted)" font-size="9" letter-spacing="1">${a.short}</text>`;
    });
    for (const [fighter, color] of [
      [red, "#f4512b"],
      [blue, "#668cbd"],
    ])
      svg += `<polygon points="${fighter.stats.map((stat, i) => point(i, stat / 100).join(",")).join(" ")}" fill="${color}" fill-opacity=".15" stroke="${color}" stroke-width="2"/>`;
    $("#radar").innerHTML = svg;
    $("#comparison-bars").innerHTML = attributes
      .map(
        (a, i) =>
          `<div class="comparison-row"><b>${red.stats[i]}</b><div class="compare-track red"><span style="width:${red.stats[i]}%"></span></div><span>${a.label}</span><div class="compare-track blue"><span style="width:${blue.stats[i]}%"></span></div><b>${blue.stats[i]}</b></div>`,
      )
      .join("");
    const result = calculateModel(red, blue, weights);
    $("#model-result").innerHTML =
      red.id === blue.id
        ? "<p>Selecciona dos luchadores distintos para comparar.</p>"
        : !result
          ? "<p>Activa al menos un atributo para calcular el índice.</p>"
          : `<div class="result-caption"><span>ÍNDICE RELATIVO DE EJEMPLO</span><strong>${result.redScore.toFixed(1)} <i>vs</i> ${result.blueScore.toFixed(1)}</strong></div><div class="result-track"><span style="width:${result.share}%"></span></div><div class="result-names"><span>${escapeHTML(red.last)} · ${result.share.toFixed(1)} %</span><span>${escapeHTML(blue.last)} · ${(100 - result.share).toFixed(1)} %</span></div>`;
    $("#save-matchup").disabled = red.id === blue.id || !result;
    document.querySelectorAll("[data-weight]").forEach((input, i) => {
      input.value = weights[i];
      $(`#weight-${i}`).value = weights[i];
    });
  }
  for (const selector of ["#red-fighter", "#blue-fighter"])
    $(selector).addEventListener("change", draw);
  $("#swap-fighters").addEventListener("click", () => {
    const old = $("#red-fighter").value;
    $("#red-fighter").value = $("#blue-fighter").value;
    $("#blue-fighter").value = old;
    draw();
  });
  $("#weight-controls").addEventListener("input", (event) => {
    if (!event.target.matches("[data-weight]")) return;
    weights[Number(event.target.dataset.weight)] = Number(event.target.value);
    draw();
  });
  $("#reset-weights").addEventListener("click", () => {
    weights = [60, 60, 60, 60, 60];
    draw();
  });
  $("#save-matchup").addEventListener("click", () => {
    if ($("#save-matchup").disabled) return;
    onSave({
      id: crypto.randomUUID(),
      red: $("#red-fighter").value,
      blue: $("#blue-fighter").value,
      weights: [...weights],
      note: $("#matchup-note").value.trim(),
      date: new Date().toISOString(),
    });
  });
  draw();
  return {
    load(matchup) {
      $("#red-fighter").value = matchup.red;
      $("#blue-fighter").value = matchup.blue;
      $("#matchup-note").value = matchup.note;
      weights = [...matchup.weights];
      draw();
    },
    compare(red, blue) {
      $("#red-fighter").value = red;
      $("#blue-fighter").value = blue;
      $("#matchup-note").value = "";
      draw();
    },
  };
}
