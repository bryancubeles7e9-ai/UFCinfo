import assert from 'node:assert/strict';
import {githubRumorState} from '../scripts/github-rumor-state.mjs';
let exists=false,saved=null;
const fetchImpl=async(url,options)=> {
 assert.equal(options.headers.Authorization,'Bearer fake-test-token');
 if(url.includes('/git/ref/'))return new Response(JSON.stringify({}),{status:exists?200:404});
 if(url.endsWith('/git/refs')){exists=true;return new Response(JSON.stringify({}),{status:201});}
 if(options.method==='PUT') {const request=JSON.parse(options.body);saved=JSON.parse(Buffer.from(request.content,'base64').toString('utf8'));assert.equal(request.branch,'ufcinfo-rumor-state');return new Response(JSON.stringify({content:{sha:'file-sha'}}),{status:201});}
 return saved ? new Response(JSON.stringify({sha:'file-sha',content:Buffer.from(JSON.stringify(saved)).toString('base64')})) : new Response('{}',{status:404});
};
const settings={token:'fake-test-token',repository:'owner/repo',baseSha:'a'.repeat(40),fetchImpl};
const store=githubRumorState(settings);assert.equal(await store.load(),null);
await store.save({schemaVersion:1,reservedCredits:300,estimatedCredits:15,lastSuccessAt:null,pending:null,archive:[{text:'Do not persist source text'}],key:'Do not persist a key'});
assert.equal(saved.reservedCredits,300);assert.deepEqual(saved.archive,[]);assert.ok(!('key' in saved));
assert.equal((await githubRumorState(settings).load()).reservedCredits,300);
saved=null;await assert.rejects(githubRumorState(settings).load(),/Refusing budget reset/);
console.log('PASS: persistent GitHub accounting, safe metadata, no raw text or keys, and missing-ledger protection');
