import assert from 'node:assert/strict';
import {renderHomeHero} from '../assets/js/home-hero.js';
const event={id:'ufc-test',number:340,title:'UFC 340',status:'announced',date:'2027-01-31T02:00:00Z',location:'Arena',source:'https://www.ufc.com/event/ufc-test',bouts:[
 {red:'Alpha',blue:'Beta',section:'main',division:'Lightweight'},
 {red:'Charlie',blue:'Delta',section:'main',division:'Welterweight'}]};
const fighters={Alpha:{image:'assets/images/alpha.png',photoCredit:'UFC'},Beta:{image:'assets/images/beta.png',photoCredit:'ESPN'}};
const render=extra=>renderHomeHero({...event,...extra},{note:'Latest data',fighterByName:name=>fighters[name]});
const hero=render();
assert.ok(hero.includes('data-official-event="ufc-test"'));
assert.ok(hero.includes('href="#pickem"'));
assert.ok(hero.includes('data-official-countdown="2027-01-31T02:00:00Z"'));
assert.ok(hero.includes('assets/images/alpha.png'));
assert.ok(hero.includes('FOTOGRAFÍAS: UFC · ESPN'));
assert.ok(hero.includes('<details class="home-source">'));
assert.ok(hero.includes('Latest data'));
assert.ok(hero.includes('Charlie'));
assert.ok(render({poster:'assets/images/events/ufc-test.jpg'}).includes('event-poster-image'));
assert.ok(!render({status:'live'}).includes('data-official-countdown='));
assert.ok(render({bouts:[]}).includes('CARTELERA POR ANUNCIAR'));
assert.ok(renderHomeHero(null).includes('Ver carteleras'));
const escaped=render({title:'<script>bad</script>',bouts:[{red:'<b>Alpha</b>',blue:'Beta',section:'main',division:'Test'}]});
assert.ok(escaped.includes('&lt;b&gt;Alpha&lt;/b&gt;'));
assert.ok(!escaped.includes('<script>bad'));
assert.ok(escaped.includes('fighter-placeholder.svg'));
console.log('PASS homepage: next event, card and Pick’em actions, countdown, real images, poster and empty fallbacks, attribution and escaping');
