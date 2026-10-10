import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthenticatedDigitalOceanReadbackV1} from '../providers/digitalocean/authenticated-readback-v1.mjs';
const binding={expectedAccountUuid:'fixture-account',sourceSha:'a'.repeat(40),sourceTree:'b'.repeat(40),planSha256:'c'.repeat(64)};
const keys={droplets:'droplets',volumes:'volumes',snapshots:'snapshots',reserved_ips:'reserved_ips',images:'images',sizes:'sizes',regions:'regions'};
function io({next=null,fail=null,wrongAccount=false}={}){
  const calls=[];
  return {calls,async fetch(url,options){
    const u=new URL(url);calls.push({url,options});
    if(fail)throw Error(fail);
    if(u.pathname==='/v2/account')return {status:200,json:async()=>({account:{uuid:wrongAccount?'foreign':binding.expectedAccountUuid,status:'active',email:'private'}})};
    const key=keys[u.pathname.split('/').at(-1)];
    return {status:200,json:async()=>({[key]:u.searchParams.get('page')==='2'&&key==='droplets'?[{id:1}]:[],...(next&&key==='droplets'&&!u.searchParams.has('page')?{links:{pages:{next}}}:{})})};
  }};
}
test('readback collects inventory using GET only and never promotes R6',async()=>{
  const f=io(),r=await createAuthenticatedDigitalOceanReadbackV1({token:'fixture-secret',fetchImpl:f.fetch}).collect(binding);
  assert.equal(f.calls.length,8);assert.ok(f.calls.every(c=>c.options.method==='GET'&&c.options.redirect==='error'));
  assert.equal(r.paidResourceCreateAllowed,false);assert.equal(r.R6,'PENDING');assert.equal(r.exactTokenScopes,'NOT_ATTESTED');
  assert.equal(r.accountWideResidueZeroAttested,false);assert.equal(JSON.stringify(r).includes('fixture-secret'),false);assert.equal(JSON.stringify(r).includes('private'),false);
});
test('pagination includes later resources instead of declaring zero',async()=>{
  const f=io({next:'https://api.digitalocean.com/v2/droplets?per_page=200&page=2'});
  const r=await createAuthenticatedDigitalOceanReadbackV1({token:'fixture',fetchImpl:f.fetch}).collect(binding);
  assert.equal(r.inventory.droplets.count,1);assert.equal(r.inspectedInventoryZero,false);
});
test('foreign pagination target cannot receive bearer credentials',async()=>{
  const f=io({next:'https://foreign.invalid/v2/droplets?per_page=200&page=2'});
  await assert.rejects(createAuthenticatedDigitalOceanReadbackV1({token:'fixture',fetchImpl:f.fetch}).collect(binding),/PAGINATION_TARGET_DENIED/);
  assert.ok(f.calls.every(c=>new URL(c.url).origin==='https://api.digitalocean.com'));
});
test('wrong account prevents inventory reads',async()=>{
  const f=io({wrongAccount:true});
  await assert.rejects(createAuthenticatedDigitalOceanReadbackV1({token:'fixture',fetchImpl:f.fetch}).collect(binding),/ACCOUNT_IDENTITY_MISMATCH/);assert.equal(f.calls.length,1);
});
test('transport exceptions are sanitized instead of leaking request headers',async()=>{
  const f=io({fail:'Bearer fixture-secret'});
  await assert.rejects(createAuthenticatedDigitalOceanReadbackV1({token:'fixture-secret',fetchImpl:f.fetch}).collect(binding),e=>e.message==='DO_READ_TRANSPORT_FAILED');
});
test('candidate price uses billing floor and excludes over-budget sizes',async()=>{
  for(const [price,expected] of [[0.00595,10],[0.3,null]]){
    const f=io();const fetchImpl=async(url,options)=>{
      const u=new URL(url);
      if(u.pathname==='/v2/sizes')return {status:200,json:async()=>({sizes:[{slug:'small',available:true,vcpus:1,memory:512,disk:10,regions:['sgp1'],price_hourly:price}]})};
      if(u.pathname==='/v2/regions')return {status:200,json:async()=>({regions:[{slug:'sgp1',available:true}]})};
      return f.fetch(url,options);
    };
    const r=await createAuthenticatedDigitalOceanReadbackV1({token:'fixture',fetchImpl}).collect(binding);
    assert.equal(r.candidatePricing?.projectedMilliUsd??null,expected);
    assert.equal(r.paidResourceCreateAllowed,false);
  }
});
