import {createHash} from 'node:crypto';
import {estimateDigitalOceanDropletCostMilliUsdV1} from './cost-aware-selector-v1.mjs';

const BASE='https://api.digitalocean.com';
const routes={droplets:['/v2/droplets','droplets'],volumes:['/v2/volumes','volumes'],
  snapshots:['/v2/snapshots','snapshots'],reservedIps:['/v2/reserved_ips','reserved_ips'],
  images:['/v2/images?private=true','images'],sizes:['/v2/sizes','sizes'],regions:['/v2/regions','regions']};
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

// Deliberately read-only. Successful reads are not proof of exact token scopes,
// guest transport, deletion capability, or Runtime acceptance.
export function createAuthenticatedDigitalOceanReadbackV1({token,fetchImpl=fetch}={}){
  if(typeof token!=='string'||!token||/[\r\n]/.test(token))throw Error('DO_CREDENTIAL_REQUIRED');
  async function get(url){
    const u=new URL(url,BASE);
    if(u.origin!==BASE||u.username||u.password||u.hash||!u.pathname.startsWith('/v2/'))throw Error('DO_ENDPOINT_DENIED');
    let response;
    try{response=await fetchImpl(u.href,{method:'GET',redirect:'error',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(20000)});}
    catch{throw Error('DO_READ_TRANSPORT_FAILED');}
    if(response.status!==200)throw Error(`DO_READ_HTTP_${Number(response.status)}`);
    try{return await response.json();}catch{throw Error('DO_READ_INVALID_JSON');}
  }
  async function list(path,key){
    let u=new URL(path,BASE);u.searchParams.set('per_page','200');
    const items=[],seen=new Set();
    for(let page=0;page<100;page++){
      if(seen.has(u.href))throw Error('DO_PAGINATION_LOOP');seen.add(u.href);
      const body=await get(u.href);
      if(!Array.isArray(body[key]))throw Error('DO_INVENTORY_SCHEMA_DRIFT');
      items.push(...body[key]);
      const next=body.links?.pages?.next;
      if(!next)return items;
      const n=new URL(next,BASE);
      if(n.origin!==BASE||n.pathname!==u.pathname||n.username||n.password||n.hash)throw Error('DO_PAGINATION_TARGET_DENIED');
      for(const [k,v] of u.searchParams)if(k!=='page'&&n.searchParams.get(k)!==v)throw Error('DO_PAGINATION_FILTER_DRIFT');
      u=n;
    }
    throw Error('DO_PAGINATION_LIMIT');
  }
  return Object.freeze({async collect({expectedAccountUuid,sourceSha,sourceTree,planSha256,runId,runAttempt}={}){
    if(!/^[0-9a-f]{40}$/.test(sourceSha??'')||!/^[0-9a-f]{40}$/.test(sourceTree??'')||!/^[0-9a-f]{64}$/.test(planSha256??'')||typeof expectedAccountUuid!=='string'||!expectedAccountUuid)throw Error('DO_SOURCE_AND_TARGET_BINDING_REQUIRED');
    const {account}=await get('/v2/account');
    if(account?.uuid!==expectedAccountUuid||account.status!=='active')throw Error('DO_ACCOUNT_IDENTITY_MISMATCH');
    const lists={};
    for(const [kind,[path,key]] of Object.entries(routes))lists[kind]=await list(path,key);
    const inventory=Object.fromEntries(['droplets','volumes','snapshots','reservedIps','images'].map(k=>[k,{count:lists[k].length,digest:digest(lists[k])}]));
    const candidates=lists.sizes.filter(s=>s.available===true&&s.vcpus>=1&&s.memory>=512&&s.disk>=10&&s.regions?.includes('sgp1')&&Number.isFinite(s.price_hourly)&&s.price_hourly>0&&estimateDigitalOceanDropletCostMilliUsdV1({priceHourly:s.price_hourly,ttlSeconds:1800})<=100)
      .sort((a,b)=>a.price_hourly-b.price_hourly||a.slug.localeCompare(b.slug));
    const minimum=lists.regions.some(r=>r.slug==='sgp1'&&r.available===true)?candidates[0]:null;
    const zero=['droplets','volumes','snapshots','reservedIps','images'].every(k=>lists[k].length===0);
    return {schemaId:'EP52_R6_AUTHENTICATED_READBACK_V1',observedAt:new Date().toISOString(),
      source:{sha:sourceSha,tree:sourceTree,planSha256},executor:{class:'GITHUB_HOSTED_RUNNER',runId,runAttempt},
      account:{identityMatched:true,status:'active'},connection:'AUTHENTICATED_API_READBACK_PASS',inventory,
      candidatePricing:minimum?{region:'sgp1',sizeSlug:minimum.slug,hourlyUsd:minimum.price_hourly,ttlSeconds:1800,projectedMilliUsd:estimateDigitalOceanDropletCostMilliUsdV1({priceHourly:minimum.price_hourly,ttlSeconds:1800}),costCapMilliUsd:100}:null,
      inspectedInventoryZero:zero,accountWideResidueZeroAttested:false,retentionClassification:'NOT_ATTESTED',
      exactTokenScopes:'NOT_ATTESTED',guestTransport:'NOT_ATTESTED',cleanupCapability:'NOT_ATTESTED',
      blockers:['EXACT_SCOPE_ATTESTATION_REQUIRED','GUEST_TRANSPORT_ATTESTATION_REQUIRED','CLEANUP_CAPABILITY_REQUIRED','RETENTION_CLASSIFICATION_REQUIRED',...(!zero?['NONZERO_INVENTORY_RECONCILIATION_REQUIRED']:[]),...(!minimum?['PRICING_CANDIDATE_UNAVAILABLE']:[])],
      providerMutations:0,paidResourceCreateAllowed:false,R6:'PENDING',finalAcceptance:false};
  }});
}
