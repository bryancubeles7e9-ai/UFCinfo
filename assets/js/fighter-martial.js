import { escapeHTML as esc } from './utils.js';

// UFC's Fighting style describes a style, not necessarily the fighter's first
// discipline or credentials. Never turn Freestyle into freestyle wrestling.
const disciplines = {
  Kickboxer: 'Kickboxing', 'Jiu-Jitsu': 'Jiu-jitsu',
  Boxer: 'Boxeo', Boxing: 'Boxeo', Wrestling: 'Lucha', Wrestler: 'Lucha',
  Karate: 'Karate', 'Muay Thai': 'Muay Thai',
  'Brazilian Jiu-Jitsu': 'Jiu-jitsu brasileño', Sambo: 'Sambo',
  'Kung Fu': 'Kung fu', Judo: 'Judo',
};
const generalStyles = {
  MMA: 'MMA', Freestyle: 'Estilo libre', Striker: 'Golpeo',
  Grappler: 'Grappling', Brawler: 'Intercambio de golpes',
};

export function martialDetails(fighter) {
  if (fighter.martialBase) return {
    label: fighter.martialBase, kind: 'base',
    note: fighter.martialBaseNote || '', source: fighter.martialBaseSource,
  };
  const style = fighter.officialStyle;
  if (disciplines[style]) return {
    label: disciplines[style], kind: 'discipline',
    note: 'Disciplina indicada en el campo «Fighting style» de UFC. No implica que sea su única formación ni acredita un grado.',
    source: fighter.source, consulted: fighter.consulted,
  };
  return {
    label: 'Base no especificada', kind: 'unknown',
    note: generalStyles[style]
      ? `UFC indica «${generalStyles[style]}» como estilo general, sin especificar una disciplina de formación.`
      : 'La ficha consultada no especifica una disciplina de formación.',
    source: fighter.source, consulted: fighter.consulted,
  };
}

export function compactMartialInfo(fighter) {
  const data = martialDetails(fighter);
  return `<div><dt>BASE / ESTILO MARCIAL</dt><dd>${esc(data.label)}</dd></div>`;
}

export function renderMartialDetails(fighter) {
  const data = martialDetails(fighter);
  const source = /^https?:\/\//.test(data.source || '')
    ? `<a class="text-link" href="${esc(data.source)}" target="_blank" rel="noopener noreferrer">Fuente: perfil UFC ›</a>` : '';
  return `<section class="combat-details"><div class="martial-base"><p class="eyebrow">${data.kind === 'discipline' ? 'DISCIPLINA INDICADA POR UFC' : 'BASE / FORMACIÓN MARCIAL'}</p><h3>${esc(data.label)}</h3><p>${esc(data.note)}</p>${source}${data.consulted ? `<p class="data-note">Consulta: ${esc(data.consulted)}</p>` : ''}</div></section>`;
}
