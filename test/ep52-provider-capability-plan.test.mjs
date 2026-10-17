import test from 'node:test';
import assert from 'node:assert/strict';
import {assessProviderCapabilitiesV1 as assess,planProviderRouteV1 as plan} from '../power/providers/capability-plan-v1.mjs';
const t=(name,properties)=>({name:'mcp__codex_apps__digitalocean_'+name,description:'tool',...(properties?{inputSchema:{properties}}:{})});
const base=[t('droplet_list'),t('droplet_get'),t('droplet_delete')];
const route=c=>plan({capabilities:c,provider:'digitalocean',operation:'BOOTSTRAP_JOB'});
test('current connector without user_data requires API adapter',()=>{
 const c=assess([...base,t('droplet_create',{Name:{},Region:{},Size:{}})]);
 assert.equal(c.digitalocean.bootstrap,false);assert.equal(route(c).route,'OFFICIAL_API_ADAPTER_REQUIRED');
 assert.equal(plan({capabilities:c,provider:'digitalocean',operation:'INSPECT'}).route,'CONNECTED_PLUGIN');
});
test('missing schema is unknown; prose cannot grant bootstrap',()=>{
 const c=assess([...base,{name:'mcp__codex_apps__digitalocean_droplet_create',description:'supports user_data'}]);
 assert.equal(c.digitalocean.createSchema,'UNKNOWN');assert.equal(route(c).reason,'CREATE_SCHEMA_UNOBSERVED');
});
test('bootstrap requires cleanup and never authorizes paid execution',()=>{
 const create=t('droplet_create',{Name:{},Region:{},Size:{},user_data:{}});
 assert.equal(route(assess([create])).route,'OFFICIAL_API_ADAPTER_REQUIRED');
 const r=route(assess([...base,create]));
 assert.equal(r.route,'CONNECTED_PLUGIN_CANDIDATE');assert.equal(r.executionAuthorized,false);
 assert.equal(r.requiresCostTtlCleanup,true);assert.equal(r.browserExtensionRequired,false);
});
test('invalid registry and unsupported operations fail closed',()=>{
 assert.throws(()=>assess([t('x'),t('x')]));assert.throws(()=>assess([{}]));
 assert.throws(()=>plan({capabilities:assess([]),provider:'foreign',operation:'INSPECT'}));
 assert.throws(()=>plan({capabilities:assess([]),provider:'cloudflare',operation:'DELETE'}));
});
