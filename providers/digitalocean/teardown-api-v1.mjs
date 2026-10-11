const base='https://api.digitalocean.com';
export function createDigitalOceanTeardownApiV1({token,fetchImpl=fetch}={}){
  if(typeof token!=='string'||!token||/[\r\n]/.test(token))throw Error('TEARDOWN_CREDENTIAL_REQUIRED');
  let verifiedIds=new Set();
  async function call(method,path,query={}){
    if(!['GET','DELETE'].includes(method)||!(path==='/v2/account'||path==='/v2/droplets'||/^\/v2\/droplets\/[1-9][0-9]*(?:\/destroy_with_associated_resources)?$/.test(path))||method==='DELETE'&&(!/^\/v2\/droplets\/[1-9][0-9]*$/.test(path)||!verifiedIds.has(path.split('/').at(-1))))throw Error('TEARDOWN_ENDPOINT_DENIED');
    const u=new URL(path,base);for(const [k,v] of Object.entries(query))u.searchParams.set(k,String(v));
    let r;try{r=await fetchImpl(u.href,{method,redirect:'error',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(10000)});}catch{throw Error('TEARDOWN_API_TRANSPORT_UNKNOWN');}
    if(r.status===404&&/^\/v2\/droplets\/[1-9][0-9]*$/.test(path)&&method==='GET')return null;
    if(method==='DELETE'&&r.status===204)return null;
    if(method==='DELETE')throw Error(`TEARDOWN_API_HTTP_${Number(r.status)}`);
    if(r.status!==200)throw Error(`TEARDOWN_API_HTTP_${Number(r.status)}`);
    try{return await r.json();}catch{throw Error('TEARDOWN_API_JSON_UNKNOWN');}
  }
  return Object.freeze({
    async readAccount(){return (await call('GET','/v2/account')).account;},
    async listOwned(lease){
      verifiedIds=new Set();
      const tag=`atelier-execution:${lease.executionId}`,wanted=[tag,`atelier-lease:${lease.leaseId}`];
      const xs=[],seen=new Set();let query={tag_name:tag,per_page:200};
      for(let page=0;page<100;page++){
        const key=JSON.stringify(query);if(seen.has(key))throw Error('TEARDOWN_PAGINATION_LOOP');seen.add(key);
        const b=await call('GET','/v2/droplets',query);if(!Array.isArray(b.droplets))throw Error('TEARDOWN_API_INVENTORY_UNKNOWN');
        xs.push(...b.droplets.filter(x=>Array.isArray(x.tags)&&wanted.every(t=>x.tags.includes(t))));
        const next=b.links?.pages?.next;
        if(!next){verifiedIds=new Set(xs.map(x=>String(x.id)));return xs;}
        const n=new URL(next,base);
        if(n.origin!==base||n.pathname!=='/v2/droplets'||n.username||n.password||n.hash||n.searchParams.get('tag_name')!==tag||n.searchParams.get('per_page')!=='200'||!/^[1-9][0-9]*$/.test(n.searchParams.get('page')??'')||[...n.searchParams.keys()].some(k=>!['tag_name','per_page','page'].includes(k)))throw Error('TEARDOWN_PAGINATION_TARGET_DENIED');
        query={tag_name:tag,per_page:200,page:Number(n.searchParams.get('page'))};
      }throw Error('TEARDOWN_PAGINATION_LIMIT');
    },
    async readResource(resourceId){const b=await call('GET',`/v2/droplets/${resourceId}`);return b===null?null:b.droplet;},
    async readChildren(resourceId){return call('GET',`/v2/droplets/${resourceId}/destroy_with_associated_resources`);},
    async deleteResource(resourceId){return call('DELETE',`/v2/droplets/${resourceId}`);}
  });
}
