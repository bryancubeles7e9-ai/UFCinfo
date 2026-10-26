import assert from 'node:assert/strict';
import {changedCountdownUnits} from '../assets/js/showcase-motion.js';
assert.deepEqual(changedCountdownUnits(undefined, ['3','4','5']), [], 'first render does not tick');
assert.deepEqual(changedCountdownUnits(['3','4','5'], ['3','4','5']), [], 'unchanged seconds do not tick');
assert.deepEqual(changedCountdownUnits(['3','4','5'], ['3','4','4']), [2], 'only the minute ticks');
assert.deepEqual(changedCountdownUnits(['3','0','0'], ['2','23','59']), [0,1,2], 'rollover ticks every unit');
console.log('PASS: countdown ticks only the units that change');
