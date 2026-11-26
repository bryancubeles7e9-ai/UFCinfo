import assert from 'node:assert/strict';
const events = [];
globalThis.document = Object.assign(new EventTarget(), {querySelector: () => null});
for (const name of ['restarting', 'back']) document.addEventListener(`ufcinfo:server-${name}`, () => events.push(name));
const {accountRequest} = await import('../assets/js/account.js');
const {errorReport} = await import('../assets/js/client-errors.js');
const json = (status, body) => ({ok: status < 400, status, headers: {get: () => 'application/json'}, json: async () => body});
const html = status => ({ok: false, status, headers: {get: () => 'text/html'}, json: async () => ({})});

// A deploy answers 502 briefly; the request succeeds once the server is back.
let calls = 0;
globalThis.fetch = async () => (++calls < 3 ? html(502) : json(200, {ok: true}));
assert.deepEqual(await accountRequest('pickem/state', {}, [0, 0, 0]), {ok: true});
assert.equal(calls, 3);
assert.deepEqual(events, ['restarting', 'back'], 'visitors see a restart notice that clears once the server is back');

// A save that loses its connection is not repeated: it may already have been applied.
calls = 0;
globalThis.fetch = async () => { calls++; throw new TypeError('offline'); };
await assert.rejects(accountRequest('me/pickem', {method: 'PUT', body: {}}, [0, 0, 0]));
assert.equal(calls, 1);

// Application errors such as a conflict are returned at once, and retries are bounded.
calls = 0;
globalThis.fetch = async () => { calls++; return json(409, {error: 'conflict'}); };
await assert.rejects(accountRequest('me/pickem', {method: 'PUT', body: {}}, [0, 0]), error => error.status === 409);
assert.equal(calls, 1);
calls = 0;
globalThis.fetch = async () => { calls++; return html(503); };
await assert.rejects(accountRequest('pickem/state', {}, [0, 0]), error => error.status === 503);
assert.equal(calls, 3);

// Only the site's own scripts are reported, without query strings or extension noise.
const location = {href: 'https://ufcinfo.onrender.com/#pickem?x=1', origin: 'https://ufcinfo.onrender.com', hash: '#pickem?x=1'};
const report = errorReport({message: 'boom', filename: 'https://ufcinfo.onrender.com/assets/js/app.js?v=2', lineno: 5, colno: 7}, location);
assert.deepEqual([report.source, report.view, report.line], ['/assets/js/app.js', '#pickem', 5]);
assert.equal(errorReport({message: 'x', filename: 'chrome-extension://abc/script.js'}, location), null);
assert.equal(errorReport({message: 'x', filename: ''}, location), null);
console.log('PASS: requests retry through deploy restarts without repeating saves; only own script errors are reported');
