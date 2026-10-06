import assert from 'node:assert/strict';
import { reconcileFollowing } from '../assets/js/account.js';
import { createStore, freshState } from '../assets/js/store.js';

assert.deepEqual(reconcileFollowing(['topuria'], ['topuria','holloway'], ['topuria','oliveira']), ['topuria','oliveira','holloway']);
assert.deepEqual(reconcileFollowing(['topuria','holloway'], ['topuria'], ['topuria','holloway','oliveira']), ['topuria','oliveira']);
assert.deepEqual(reconcileFollowing(['topuria'], [], []), []);
const memory = new Map();
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
const store=createStore();store.state.favorites=['topuria'];store.save();
store.useScope('account-a');assert.deepEqual(store.state.favorites,[]);
store.state.favorites=['ufc-joshua-van'];store.save();
store.useScope('account-b');assert.deepEqual(store.state.favorites,[]);
store.state.favorites=['holloway'];store.save();
store.useScope('account-a');assert.deepEqual(store.state.favorites,['ufc-joshua-van']);
store.useScope();assert.deepEqual(store.state.favorites,['topuria']);
const imported=freshState(); imported.favorites=['oliveira'];store.useScope('account-b');store.replace(imported);
store.useScope();assert.deepEqual(store.state.favorites,['topuria']);
console.log('PASS: concurrent additions/removals merge; guest and accounts have separate local storage; imports stay in their account');
