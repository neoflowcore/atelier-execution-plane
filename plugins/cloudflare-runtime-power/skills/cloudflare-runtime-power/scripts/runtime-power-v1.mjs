const ACCOUNT=/^[0-9a-f]{32}$/;
const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;
const PRODUCTS=Object.freeze({WORKERS:'workers/scripts',PAGES:'pages/projects',D1:'d1/database',R2:'r2/buckets'});
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const digest=async x=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(x)))),b=>b.toString(16).padStart(2,'0')).join('');
const fail=code=>{throw Error(code);};
function profile(x){if(typeof x?.id!=='string'||!x.id||x.id.length>256)fail('POWER_PROFILE_REQUIRED');return x.id;}
function entries(xs,kind){
  if(!Array.isArray(xs))fail('POWER_INVENTORY_SCHEMA');
  const out=xs.map(x=>{
    const id=kind==='WORKERS'?x.id:kind==='D1'?x.uuid:x.name;
    const name=kind==='WORKERS'?x.id:x.name;
    if(typeof id!=='string'||!id||id.length>256||typeof name!=='string'||!name||name.length>256)fail('POWER_RESOURCE_IDENTITY_REQUIRED');
    return {id,name};
  }).sort((a,b)=>a.id.localeCompare(b.id));
  if(new Set(out.map(x=>x.id)).size!==out.length)fail('POWER_DUPLICATE_RESOURCE');
  return out;
}
export function createCloudflareRuntimePowerV1({request,whoami,clock=Date.now}={}){
  if(typeof request!=='function'||typeof whoami!=='function'||typeof clock!=='function')fail('POWER_IO_REQUIRED');
  const get=async(path,query)=>{
    let timer;
    try{
      const r=await Promise.race([request({method:'GET',path,...(query?{query}: {})}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('POWER_READ_TIMEOUT')),10000);})]);
      if(r?.success!==true||r.status!==200)fail('POWER_READ_NOT_SUCCESS');
      return r;
    }catch{fail('POWER_READ_BLOCKED');}finally{clearTimeout(timer);}
  };
  const pages=async(path,perPage)=>{
    const all=[];
    for(let page=1;page<=100;page++){
      const r=await get(path,{page,per_page:perPage});
      if(!Array.isArray(r.result))fail('POWER_INVENTORY_SCHEMA');
      all.push(...r.result);
      const total=r.result_info?.total_pages;
      if(total!==undefined){
        if(!Number.isSafeInteger(total)||total<0||total>100||r.result_info?.page!==page)fail('POWER_PAGINATION_SCHEMA');
        if(page>=total)return all;
      }else if(r.result.length<perPage)return all;
    }
    fail('POWER_PAGINATION_LIMIT');
  };
  return Object.freeze({
    async discover({accountId,projectKey,sourceSha,planSha256}={}){
      if(!/^[a-zA-Z0-9_-]{1,80}$/.test(projectKey??'')||!SHA40.test(sourceSha??'')||!SHA64.test(planSha256??''))fail('POWER_PROJECT_BINDING_REQUIRED');
      const principal=profile(await whoami());
      const raw=await pages('/accounts',50);
      const accounts=raw.map(a=>{if(!ACCOUNT.test(a.id??'')||typeof a.name!=='string')fail('POWER_ACCOUNT_SCHEMA');return {id:a.id,name:a.name};});
      if(new Set(accounts.map(a=>a.id)).size!==accounts.length)fail('POWER_ACCOUNT_SCHEMA');
      if(accountId===undefined){if(accounts.length!==1)fail('POWER_EXPLICIT_ACCOUNT_REQUIRED');accountId=accounts[0].id;}
      if(!ACCOUNT.test(accountId??'')||!accounts.some(a=>a.id===accountId))fail('POWER_ACCOUNT_NOT_AUTHORIZED');
      const products={};
      for(const [kind,suffix] of Object.entries(PRODUCTS)){
        try{
          const path=`/accounts/${accountId}/${suffix}`;
          let xs;
          if(kind==='WORKERS'){
            const r=await get(path);if(r.result_info?.total_pages>1)fail('POWER_PAGINATION_SCHEMA');xs=r.result;
          }else if(kind==='R2'){
            xs=[];let cursor;const seen=new Set();
            for(let attempt=0;attempt<100;attempt++){
              const r=await get(path,{per_page:100,...(cursor?{cursor}:{})});
              if(!Array.isArray(r.result?.buckets))fail('POWER_INVENTORY_SCHEMA');
              xs.push(...r.result.buckets);
              const next=r.result_info?.cursor;
              if(next===undefined||next==='')break;
              if(typeof next!=='string'||next.length>4096||seen.has(next))fail('POWER_PAGINATION_SCHEMA');
              seen.add(next);cursor=next;if(attempt===99)fail('POWER_PAGINATION_LIMIT');
            }
          }else xs=await pages(path,kind==='PAGES'?10:50);
          products[kind]={status:'OBSERVED',resources:entries(xs,kind),scope:kind==='R2'?'DEFAULT_JURISDICTION':'ACCOUNT'};
        }catch{products[kind]={status:'UNKNOWN',resources:null,scope:kind==='R2'?'DEFAULT_JURISDICTION':'ACCOUNT'};}
      }
      if(profile(await whoami())!==principal)fail('POWER_PROFILE_CHANGED');
      const observedAtMs=clock();if(!Number.isSafeInteger(observedAtMs)||observedAtMs<0)fail('POWER_CLOCK_REQUIRED');
      const body={schemaId:'CLOUDFLARE_RUNTIME_POWER_CATALOG_V1',projectKey,sourceSha,planSha256,profileDigest:await digest(principal),accountId,products,observedAtMs,providerMutations:0,credentialValuesReturned:false,finalRuntimeAcceptance:false};
      return Object.freeze({...body,catalogDigest:await digest(body)});
    }
  });
}
export async function compileRuntimePowerSelectionV1({catalog,projectKey,sourceSha,planSha256,profileId,accountId,kind,resourceId,nowMs}={}){
  if(catalog?.schemaId!=='CLOUDFLARE_RUNTIME_POWER_CATALOG_V1')fail('POWER_CATALOG_REQUIRED');
  const {catalogDigest,...body}=catalog;
  if(catalogDigest!==await digest(body))fail('POWER_CATALOG_TAMPERED');
  if(catalog.projectKey!==projectKey||catalog.sourceSha!==sourceSha||catalog.planSha256!==planSha256||catalog.profileDigest!==await digest(profile({id:profileId}))||catalog.accountId!==accountId)fail('POWER_SELECTION_BINDING_MISMATCH');
  if(!Number.isSafeInteger(nowMs)||nowMs<catalog.observedAtMs||nowMs-catalog.observedAtMs>60000)fail('POWER_CATALOG_STALE');
  const product=catalog.products[kind];
  if(!Object.hasOwn(PRODUCTS,kind)||product?.status!=='OBSERVED')fail('POWER_PRODUCT_UNOBSERVED');
  const matches=product.resources.filter(x=>x.id===resourceId);
  if(matches.length!==1)fail('POWER_EXACT_RESOURCE_REQUIRED');
  const plan={schemaId:'CLOUDFLARE_RUNTIME_POWER_SELECTION_V1',projectKey,sourceSha,planSha256,profileDigest:catalog.profileDigest,accountId,kind,resourceId,catalogDigest,observedAtMs:catalog.observedAtMs,expiresAtMs:catalog.observedAtMs+60000,action:'INSPECT',mutationsAllowed:false,credentialCreationAllowed:false,paidResourceCreationAllowed:false,finalRuntimeAcceptance:false};
  return Object.freeze({...plan,selectionDigest:await digest(plan)});
}
