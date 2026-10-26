import {animateInterface} from './action-feedback.js';

const settle = 'cubic-bezier(.2,.7,.3,1)';

// Home hero: fighters slide in from their corners and the VS lands with a short punch.
export function enterHomeHero(banner) {
  if (!banner || banner.closest('[hidden]')) return;
  const [red, blue] = banner.querySelectorAll('.hero-fighter-photo');
  if (red) animateInterface(red, [{opacity:0, transform:'translateX(-48px)'}, {opacity:1, transform:'none'}],
    {duration:620, easing:settle, fill:'backwards'});
  if (blue) animateInterface(blue, [{opacity:0, transform:'translateX(48px)'}, {opacity:1, transform:'none'}],
    {duration:620, delay:60, easing:settle, fill:'backwards'});
  const versus = banner.querySelector('.home-art-vs');
  if (versus) animateInterface(versus, [
    {opacity:0, transform:'translate(-50%,-50%) scale(1.8)'},
    {opacity:1, transform:'translate(-50%,-50%) scale(.92)', offset:.7},
    {opacity:1, transform:'translate(-50%,-50%) scale(1)'}
  ], {duration:420, delay:440, easing:'ease-out', fill:'backwards'});
  const poster = banner.querySelector('.event-poster-image');
  if (poster) animateInterface(poster, [{opacity:0, transform:'scale(1.04)'}, {opacity:1, transform:'none'}],
    {duration:700, easing:settle, fill:'backwards'});
  const title = banner.querySelector('.hero-copy h1');
  if (title) animateInterface(title, [{opacity:0, transform:'translateY(14px)'}, {opacity:1, transform:'none'}],
    {duration:520, delay:120, easing:settle, fill:'backwards'});
}

// Countdown: only the units whose value changed get the scoreboard tick.
export function changedCountdownUnits(previous, next) {
  if (!previous) return [];
  return next.map((value, index) => value !== previous[index] ? index : -1).filter(index => index >= 0);
}
export function tickCountdown(element, values) {
  const previous = element.dataset.countdownValues?.split('|');
  element.dataset.countdownValues = values.join('|');
  const units = element.querySelectorAll(':scope > span');
  for (const index of changedCountdownUnits(previous, values.map(String))) {
    const digits = units[index]?.querySelector('.countdown-digits');
    if (digits) animateInterface(digits, [{opacity:0, transform:'translateY(-60%)'}, {opacity:1, transform:'none'}],
      {duration:380, easing:settle});
  }
}

// Rankings: rows enter in order and the champion gets a gold sweep.
export function enterRankings(table, leader) {
  if (!table || table.closest('[hidden]')) return;
  const rows = [...table.querySelectorAll('tbody tr')];
  rows.forEach((row, index) => {
    if (index > 16) return;
    animateInterface(row, [{opacity:0, transform:'translateX(-14px)'}, {opacity:1, transform:'none'}],
      {duration:320, delay:index * 28, easing:settle, fill:'backwards'});
  });
  const champion = table.querySelector('.champion-row');
  if (champion) animateInterface(champion, [
    {boxShadow:'inset 0 0 0 0 rgba(222,178,76,0)', backgroundColor:'rgba(222,178,76,0)'},
    {boxShadow:'inset 3px 0 0 0 rgba(222,178,76,.9)', backgroundColor:'rgba(222,178,76,.14)', offset:.45},
    {boxShadow:'inset 0 0 0 0 rgba(222,178,76,0)', backgroundColor:'rgba(222,178,76,0)'}
  ], {duration:1100, delay:200, easing:'ease-out'});
  const symbol = leader?.querySelector('.ranking-leader-symbol');
  if (symbol) animateInterface(symbol, [
    {opacity:0, transform:'scale(.8)', textShadow:'0 0 0 rgba(222,178,76,0)'},
    {opacity:1, transform:'scale(1.04)', textShadow:'0 0 28px rgba(222,178,76,.75)', offset:.55},
    {opacity:1, transform:'none', textShadow:'0 0 0 rgba(222,178,76,0)'}
  ], {duration:900, easing:'ease-out', fill:'backwards'});
}
