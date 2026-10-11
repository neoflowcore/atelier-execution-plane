import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {runTeardownServiceV1} from '../watchdog/teardown-watchdog/service-v1.mjs';
import {createDigitalOceanTeardownApiV1} from '../providers/digitalocean/teardown-api-v1.mjs';

const lease={schemaId:'EP52_TEARDOWN_LEASE_V1',executionId:'run',leaseId:'lease',sourceSha:'a'.repeat(40),planSha256:'b'.repeat(64),accountUuid:'bd0ac817-54dd-47e5-8a66-73d30e19fc3a',issuedAtMs:1000,expiresAtMs:2000};
const empty={snapshots:[],volumes:[],volume_snapshots:[],reserved_ips:[]};
function fixture(){
  let clock=1000,resource={id:42,tags:['atelier-execution:run','atelier-lease:lease'],created_at:new Date(1000).toISOString()};
  const calls=[];
  const provider={readAccount:async()=>({uuid:lease.accountUuid,status:'active'}),listOwned:async()=>resource?[resource]:[],readResource:async()=>resource,readChildren:async()=>empty,deleteResource:async id=>{calls.push({id,clock});resource=null;}};
  return {lease,provider,onArmed:async()=>{},now:()=>clock,sleep:async n=>{clock+=n;},pollMs:100,calls,setResource:r=>{resource=r;}};
}
test('armed persistence precedes waiting; expiry deletes owned compute and reads absence',async()=>{
  const f=fixture();let armed=false;
  f.onArmed=async r=>{assert.equal(f.calls.length,0);assert.equal(r.independentFailureDomainAttested,false);armed=true;};
  const sleep=f.sleep;f.sleep=async n=>{assert.equal(armed,true);await sleep(n);};
  const r=await runTeardownServiceV1(f);
  assert.deepEqual(f.calls,[{id:'42',clock:2000}]);
  assert.equal(r.status,'OWNED_CLEANUP_OBSERVED');assert.equal(r.billableResidueZeroAttested,true);assert.equal(r.finalR6Acceptance,false);
});
test('failed durable arm cannot execute DELETE',async()=>{
  const f=fixture();f.onArmed=async()=>{throw Error('disk failure');};
  await assert.rejects(runTeardownServiceV1(f));assert.equal(f.calls.length,0);
});
test('wrong account, ambiguous ownership, pre-existing resource and overlong lease reject before arming/deleting',async()=>{
  for(const mode of ['account','ambiguous','old','ttl']){
    const f=fixture();let armed=false;f.onArmed=async()=>{armed=true;};
    if(mode==='account')f.provider.readAccount=async()=>({uuid:'foreign',status:'active'});
    if(mode==='ambiguous'){const list=f.provider.listOwned;f.provider.listOwned=async()=>{const xs=await list();return [...xs,...xs];};}
    if(mode==='old')f.setResource({id:42,tags:['atelier-execution:run','atelier-lease:lease'],created_at:new Date(0).toISOString()});
    if(mode==='ttl')f.lease={...lease,expiresAtMs:1801001};
    await assert.rejects(runTeardownServiceV1(f));assert.equal(armed,false);assert.equal(f.calls.length,0);
  }
});
test('changed ownership after arming is rejected without a write',async()=>{
  const f=fixture();f.onArmed=async()=>f.setResource({id:42,tags:['foreign'],created_at:new Date(1000).toISOString()});
  await assert.rejects(runTeardownServiceV1(f),/OWNERSHIP_MISMATCH/);assert.equal(f.calls.length,0);
});
test('unknown children release compute while preserving unresolved residue',async()=>{
  const f=fixture();f.provider.readChildren=async()=>{throw Error('network');};
  const r=await runTeardownServiceV1(f);assert.equal(f.calls.length,1);assert.equal(r.ownedComputeAbsent,true);assert.equal(r.status,'CLEANUP_UNRESOLVED');assert.equal(r.childInventoryKnown,false);assert.equal(r.billableResidueZeroAttested,false);
});
test('ownership change during child scan is rechecked immediately before DELETE',async()=>{
  const f=fixture();f.provider.readChildren=async()=>{f.setResource({id:42,tags:['foreign'],created_at:new Date(1000).toISOString()});return empty;};
  await assert.rejects(runTeardownServiceV1(f),/RESOURCE_REBIND_DENIED/);assert.equal(f.calls.length,0);
});
test('billable children are preserved and cannot be promoted to zero',async()=>{
  const f=fixture();f.provider.readChildren=async()=>({...empty,snapshots:[{id:8}]});
  const r=await runTeardownServiceV1(f);assert.equal(r.childBillableResourceCount,1);assert.equal(r.billableResidueZeroAttested,false);assert.equal(f.calls.length,1);
});
test('lost DELETE response reconciles absence without replay',async()=>{
  const f=fixture(),del=f.provider.deleteResource;f.provider.deleteResource=async id=>{await del(id);throw Error('lost response');};
  const r=await runTeardownServiceV1(f);assert.equal(f.calls.length,1);assert.equal(r.ownedComputeAbsent,true);assert.equal(r.deleteObserved,false);
});
test('persistent failure is bounded and never reports cleanup PASS',async()=>{
  const f=fixture();let attempts=0;f.provider.deleteResource=async()=>{attempts++;throw Error('unavailable');};
  const r=await runTeardownServiceV1(f);assert.equal(attempts,3);assert.equal(r.status,'CLEANUP_UNRESOLVED');assert.equal(r.ownedComputeAbsent,false);
});
test('absence at expiry is not evidence of deletion capability or child cleanup',async()=>{
  const f=fixture();f.setResource(null);const r=await runTeardownServiceV1(f);assert.equal(r.status,'ABSENT_AT_EXPIRY');assert.equal(r.childInventoryKnown,false);assert.equal(r.billableResidueZeroAttested,false);assert.equal(r.deleteObserved,false);
});
test('official adapter restricts DELETE to inventoried IDs and rejects cross-origin pagination without leaking credentials',async()=>{
  const calls=[];const token='ephemeral-test-value';
  const api=createDigitalOceanTeardownApiV1({token,fetchImpl:async(url,opts)=>{calls.push({url,method:opts.method});return {status:200,json:async()=>({droplets:[{id:42,tags:['atelier-execution:run','atelier-lease:lease']}],links:{pages:{next:'https://foreign.invalid/v2/droplets?page=2'}}})};}});
  await assert.rejects(api.deleteResource('42'),/ENDPOINT_DENIED/);assert.equal(calls.length,0);
  await assert.rejects(api.listOwned(lease),/PAGINATION_TARGET_DENIED/);assert.equal(calls.length,1);
  await assert.rejects(api.deleteResource('42'),/ENDPOINT_DENIED/);
  assert.equal(JSON.stringify(api).includes(token),false);
});
test('watchdog survives termination of a separate worker process; same-host only',async()=>{
  const worker=spawn(process.execPath,['-e','process.stdout.write("READY\\n");setInterval(()=>{},1000)'],{env:{PATH:process.env.PATH},stdio:['ignore','pipe','ignore']});
  try{
    await once(worker.stdout,'data');
    const started=Date.now(),f=fixture();f.lease={...lease,issuedAtMs:started,expiresAtMs:started+100};
    f.setResource({id:42,tags:['atelier-execution:run','atelier-lease:lease'],created_at:new Date(started).toISOString()});
    delete f.now;delete f.sleep;
    f.onArmed=async()=>{const exit=once(worker,'exit');worker.kill('SIGKILL');await exit;};
    const result=await runTeardownServiceV1(f);
    assert.equal(worker.signalCode,'SIGKILL');assert.equal(result.ownedComputeAbsent,true);assert.equal(result.independentFailureDomainAttested,false);assert.equal(result.finalR6Acceptance,false);
  }finally{if(worker.exitCode===null&&worker.signalCode===null)worker.kill('SIGKILL');}
});
test('official adapter/service integration reads every inventory page, preserves foreign resources, and verifies DELETE via 404',async()=>{
  let exists=true;const methods=[];const f=fixture();
  const resource={id:42,tags:['atelier-execution:run','atelier-lease:lease'],created_at:new Date(1000).toISOString()};
  f.provider=createDigitalOceanTeardownApiV1({token:'test-session',fetchImpl:async(url,opts)=>{
    const u=new URL(url);methods.push(`${opts.method} ${u.pathname}`);
    let status=200,body;
    if(u.pathname==='/v2/account')body={account:{uuid:lease.accountUuid,status:'active'}};
    else if(u.pathname==='/v2/droplets'){
      if(!u.searchParams.has('page'))body={droplets:[{id:99,tags:['foreign']}],links:{pages:{next:'https://api.digitalocean.com/v2/droplets?tag_name=atelier-execution%3Arun&per_page=200&page=2'}}};
      else body={droplets:exists?[resource]:[]};
    }else if(u.pathname.endsWith('/destroy_with_associated_resources'))body=empty;
    else if(opts.method==='DELETE'){assert.equal(u.pathname,'/v2/droplets/42');exists=false;status=204;}
    else if(exists)body={droplet:resource};else status=404;
    return {status,json:async()=>body};
  }});
  const r=await runTeardownServiceV1(f);assert.equal(r.status,'OWNED_CLEANUP_OBSERVED');
  assert.deepEqual(methods.filter(x=>x.startsWith('DELETE')),['DELETE /v2/droplets/42']);
  assert.equal(methods.some(x=>x.startsWith('POST')),false);assert.equal(r.accountWideResidueZeroAttested,false);
});
