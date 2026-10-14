import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
const skill='plugins/cloudflare-runtime-power/skills/cloudflare-runtime-power/';
const builder=skill+'scripts/build-mcp-code.mjs';
const account='a'.repeat(32);
const build=input=>execFileSync(process.execPath,[builder],{input:JSON.stringify(input),encoding:'utf8',stdio:['pipe','pipe','pipe']});
test('packaged builder reproduces the tested module and performs GET-only discovery with no credentials',async()=>{
 const original=readFileSync('power/cloudflare/runtime-power-v1.mjs','utf8'),bundled=readFileSync(skill+'scripts/runtime-power-v1.mjs','utf8');
 assert.equal(createHash('sha256').update(bundled).digest('hex'),createHash('sha256').update(original).digest('hex'));
 const code=build({profileId:'fixture-user',projectKey:'fixture-project'}),calls=[];
 const fn=vm.runInNewContext('('+code+')',{crypto:webcrypto,TextEncoder,setTimeout,clearTimeout,cloudflare:{request:async req=>{
 calls.push(req);assert.equal(req.method,'GET');
 return {status:200,success:true,result:req.path==='/accounts'?[{id:account,name:'fixture'}]:req.path.endsWith('/r2/buckets')?{buckets:[]}:[]};
 }}});
 const r=await fn();assert.equal(r.planProvenance,'PLUGIN_RECIPE_ONLY');assert.equal(r.providerMutations,0);assert.equal(r.finalRuntimeAcceptance,false);assert.equal(calls.length,5);
 const result=JSON.stringify(r);assert.equal(result.includes('fixture-user'),false);assert.equal(result.includes(account),false);
});
test('builder rejects credentials, unknown fields and invalid targets before emitting executable code',()=>{
 for(const input of [{profileId:'x',token:'secret'},{profileId:'x',accountId:'../foreign'},{profileId:'x',planSha256:'invalid'},{profileId:'x',selection:{kind:'DELETE',resourceId:'worker'}},{profileId:'x',projectKey:'x;write()'}]){
 assert.throws(()=>build(input));
 }
});
test('profile input is serialized data and cannot inject executable statements',async()=>{
 const dangerous='x";throw new Error("INJECTED");"';
 const code=build({profileId:dangerous});const fn=vm.runInNewContext('('+code+')',{crypto:webcrypto,TextEncoder,setTimeout,clearTimeout,cloudflare:{request:async req=>({success:true,status:200,result:req.path==='/accounts'?[{id:account,name:'fixture'}]:req.path.endsWith('/r2/buckets')?{buckets:[]}:[]})}});
 assert.equal((await fn()).providerMutations,0);
});
test('portable package wires official OAuth and has no baked user authentication',()=>{
 const p=JSON.parse(readFileSync('plugins/cloudflare-runtime-power/plugin.json')),m=JSON.parse(readFileSync('plugins/cloudflare-runtime-power/mcp.json')),market=JSON.parse(readFileSync('.agents/plugins/marketplace.json'));
 assert.equal(m.mcpServers.cloudflare.url,'https://mcp.cloudflare.com/mcp');assert.equal(m.mcpServers.cloudflare.extensions['com.openai'].auth.type,'oauth');
 assert.equal(market.plugins[0].source.path,'./plugins/cloudflare-runtime-power');
 for(const text of [JSON.stringify(p),JSON.stringify(m)])assert.equal(/clientSecret|Authorization|Bearer |client_id|client_secret/.test(text),false);
});

