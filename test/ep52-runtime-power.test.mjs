import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudflareRuntimePowerV1,compileRuntimePowerSelectionV1} from '../power/cloudflare/runtime-power-v1.mjs';
const a='a'.repeat(32),b='b'.repeat(32),sourceSha='c'.repeat(40),planSha256='d'.repeat(64);
const input={projectKey:'project-one',sourceSha,planSha256};
function fixture({accounts=[{id:a,name:'one'}],identity,override}={}){
  const calls=[];let identities=0;
  const whoami=async()=>({id:identity?.(++identities)??'user-one',email:'do-not-export@example.invalid'});
  const request=async req=>{
    calls.push(req);assert.equal(req.method,'GET');
    const extra=await override?.(req);if(extra)return extra;
    let result=req.path==='/accounts'?accounts:req.path.endsWith('/workers/scripts')?[{id:'worker-one',secret:'do-not-export',tags:['unrelated']}]:req.path.endsWith('/d1/database')?[{uuid:'db-one',name:'database'}]:req.path.endsWith('/r2/buckets')?{buckets:[{name:'bucket-one'}]}:[{name:'page-one',deployment_configs:{production:{env_vars:{TOKEN:{value:'do-not-export'}}}}}];
    return {success:true,status:200,result};
  };
  return {calls,power:createCloudflareRuntimePowerV1({request,whoami,clock:()=>100000})};
}
const selection=catalog=>({catalog,...input,profileId:'user-one',accountId:a,kind:'WORKERS',resourceId:'worker-one',nowMs:100001});
test('single account discovers four product kinds without exporting profiles, configuration or secrets',async()=>{
 const f=fixture(),c=await f.power.discover(input);assert.equal(c.accountId,a);
 for(const p of Object.values(c.products))assert.equal(p.status,'OBSERVED');
 assert.equal(JSON.stringify(c).includes('do-not-export'),false);assert.equal(JSON.stringify(c).includes('example.invalid'),false);
 assert.equal(c.providerMutations,0);assert.equal((await compileRuntimePowerSelectionV1(selection(c))).mutationsAllowed,false);
});
test('multiple accounts need an explicit authorized account and do not issue resource reads before selection',async()=>{
 const f=fixture({accounts:[{id:a,name:'one'},{id:b,name:'two'}]});await assert.rejects(f.power.discover(input),/EXPLICIT_ACCOUNT/);assert.equal(f.calls.length,1);
 const c=await f.power.discover({...input,accountId:b});assert.equal(c.accountId,b);assert.ok(f.calls.slice(2).every(r=>r.path.includes(b)));
 await assert.rejects(f.power.discover({...input,accountId:'f'.repeat(32)}),/NOT_AUTHORIZED/);
});
test('profile changes invalidate all observations',async()=>{
 const f=fixture({identity:n=>n===1?'one':'two'});await assert.rejects(f.power.discover(input),/PROFILE_CHANGED/);
});
test('permission denial remains unknown and cannot become an empty inventory',async()=>{
 const f=fixture({override:req=>req.path.endsWith('/d1/database')?{success:false,status:403,errors:[{message:'private diagnostic'}]}:null});
 const c=await f.power.discover(input);assert.equal(c.products.D1.status,'UNKNOWN');assert.equal(c.products.D1.resources,null);
 await assert.rejects(compileRuntimePowerSelectionV1({...selection(c),kind:'D1',resourceId:'db-one'}),/UNOBSERVED/);
 assert.equal(JSON.stringify(c).includes('private diagnostic'),false);
});
test('account pagination reaches later accounts',async()=>{
 const f=fixture({override:req=>req.path==='/accounts'?{success:true,status:200,result:[{id:req.query.page===1?a:b,name:'account'}],result_info:{page:req.query.page,total_pages:2}}:null});
 assert.equal((await f.power.discover({...input,accountId:b})).accountId,b);
});
test('Pages pagination is complete and sanitized',async()=>{
 const f=fixture({override:req=>req.path.endsWith('/pages/projects')?{success:true,status:200,result:[{name:'page-'+req.query.page}],result_info:{page:req.query.page,total_pages:2}}:null});
 const c=await f.power.discover(input);assert.equal(c.products.PAGES.resources.length,2);
});
test('R2 cursor pagination uses default jurisdiction and detects cursor loops',async()=>{
 for(const loop of [false,true]){
 const f=fixture({override:req=>req.path.endsWith('/r2/buckets')?{success:true,status:200,result:{buckets:[{name:req.query.cursor?'bucket-two':'bucket-one'}]},result_info:{cursor:!req.query.cursor||loop?'next':''}}:null});
 const c=await f.power.discover(input);assert.equal(c.products.R2.status,loop?'UNKNOWN':'OBSERVED');assert.equal(c.products.R2.scope,'DEFAULT_JURISDICTION');
 if(!loop)assert.equal(c.products.R2.resources.length,2);
 }
});
test('duplicate resources and malformed page metadata remain unknown',async()=>{
 for(const override of [
 req=>req.path.endsWith('/workers/scripts')?{success:true,status:200,result:[{id:'x'},{id:'x'}]}:null,
 req=>req.path.endsWith('/d1/database')?{success:true,status:200,result:[],result_info:{page:99,total_pages:2}}:null]){
 const c=await fixture({override}).power.discover(input);assert.ok(Object.values(c.products).some(p=>p.status==='UNKNOWN'));
 }
});
test('selection rejects stale, future, wrong-account, other-profile, project and source observations',async()=>{
 const c=await fixture().power.discover(input);
 for(const changes of [{nowMs:160001},{nowMs:99999},{accountId:b},{profileId:'other'},{projectKey:'other'},{sourceSha:'e'.repeat(40)},{resourceId:'missing'}])
 await assert.rejects(compileRuntimePowerSelectionV1({...selection(c),...changes}));
});
test('catalog tampering cannot authorize even inspection selection',async()=>{
 const c=await fixture().power.discover(input);const altered=JSON.parse(JSON.stringify(c));altered.products.WORKERS.resources[0].id='foreign';
 await assert.rejects(compileRuntimePowerSelectionV1({...selection(altered),resourceId:'foreign'}),/TAMPERED/);
});
