import {createHash} from "node:crypto";
import {compileDigitalOceanProvisionSpecV1,normalizeDigitalOceanInventoryV1} from "./index.mjs";
import {selectMinimumDropletForLiveQualificationV1} from "./cost-aware-selector-v1.mjs";
import {evaluateDigitalOceanScopeEnvelopeV1} from "./api-execution-v1.mjs";

const sha=v=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const tags=(e,l)=>[`atelier-execution:${e}`,`atelier-lease:${l}`];

export function createDigitalOceanOfficialApiSurfaceDriverV1({request,getAuthMetadata,surfaceClass="OFFICIAL_NATIVE_API"}={}){
  if(typeof request!=="function"||typeof getAuthMetadata!=="function")throw new Error("DIGITALOCEAN_SURFACE_IO_REQUIRED");
  let resourceId=null,childCount=null,discovery=null;
  const call=async(method,path,opts={})=>{
    const r=await request({method,path,query:opts.query??null,body:opts.body??null,tokenMaterialAllowed:false});
    const allowed=opts.allowed??[200];
    if(!r||!allowed.includes(r.status)){const e=new Error(`DIGITALOCEAN_HTTP_STATUS_UNEXPECTED:${r?.status??"NONE"}`);if(r?.outcomeUnknown)e.code="OUTCOME_UNKNOWN";throw e}
    return r;
  };
  const owned=async(executionId,leaseId)=>{
    if(typeof executionId!=="string"||!executionId||typeof leaseId!=="string"||!leaseId)throw new Error("DIGITALOCEAN_OWNERSHIP_BINDING_REQUIRED");
    let query={tag_name:`atelier-execution:${executionId}`,per_page:200};
    const items=[],seen=new Set();
    for(let page=0;page<100;page++){
      const key=JSON.stringify(query);if(seen.has(key))throw new Error("DIGITALOCEAN_PAGINATION_LOOP");seen.add(key);
      const r=await call("GET","/v2/droplets",{query});
      if(!Array.isArray(r.body?.droplets))throw new Error("DIGITALOCEAN_INVENTORY_SCHEMA_REQUIRED");
      items.push(...r.body.droplets);
      const next=r.body.links?.pages?.next;
      if(!next)return normalizeDigitalOceanInventoryV1(items).filter(x=>tags(executionId,leaseId).every(t=>x.tags.includes(t)));
      const u=new URL(next,"https://api.digitalocean.com");
      if(u.origin!=="https://api.digitalocean.com"||u.pathname!=="/v2/droplets"||u.username||u.password||u.hash||u.searchParams.get("tag_name")!==query.tag_name||u.searchParams.get("per_page")!=="200"||!/^[1-9][0-9]*$/.test(u.searchParams.get("page")??"")||[...u.searchParams.keys()].some(k=>!["tag_name","per_page","page"].includes(k)))throw new Error("DIGITALOCEAN_PAGINATION_TARGET_DENIED");
      query={tag_name:query.tag_name,per_page:200,page:Number(u.searchParams.get("page"))};
    }
    throw new Error("DIGITALOCEAN_PAGINATION_LIMIT");
  };
  return Object.freeze({
    provider:"DIGITALOCEAN",surfaceClass,rawSecretMaterialExposed:false,browserNormalPath:false,manualSshNormalPath:false,
    async discover({context}){
      const auth=await getAuthMetadata();const scope=evaluateDigitalOceanScopeEnvelopeV1(auth?.grantedScopes??[]);
      if(scope.status!=="PASS")throw new Error("DIGITALOCEAN_SCOPE_ENVELOPE_NOT_PASS");
      const [a,s,r,i]=await Promise.all([
        call("GET","/v2/account"),call("GET","/v2/sizes",{query:{per_page:200}}),call("GET","/v2/regions",{query:{per_page:200}}),call("GET","/v2/images",{query:{type:"distribution",per_page:200}})
      ]);
      const region=(r.body?.regions??[]).find(x=>x.slug===context.regionPreference&&x.available!==false)?.slug;
      if(!region)throw new Error("DIGITALOCEAN_REGION_UNAVAILABLE");
      const size=selectMinimumDropletForLiveQualificationV1({requirements:context.requirements,sizes:s.body?.sizes??[],region,ttlSeconds:context.ttlSeconds,costCapMilliUsd:context.costCapMilliUsd});
      const image=(i.body?.images??[]).find(x=>x.slug===context.imageSlug&&x.public!==false&&x.status!=="deleted");
      if(!image)throw new Error("DIGITALOCEAN_IMAGE_UNAVAILABLE");
      const accountUuid=a.body?.account?.uuid;if(!accountUuid)throw new Error("DIGITALOCEAN_ACCOUNT_IDENTITY_REQUIRED");
      discovery={accountUuid,scopeEnvelope:scope,region,size:{slug:size.slug,projectedCostMilliUsd:size.projectedCostMilliUsd},image:{slug:image.slug,id:image.id}};
      return discovery;
    },
    async readCurrent({plan,context}){const xs=await owned(plan.executionId,context.leaseId);if(xs.length>1)throw new Error("DIGITALOCEAN_AMBIGUOUS_OWNED_DROPLETS");if(xs[0])resourceId=xs[0].resourceId;return {droplets:xs}},
    async diffDesired({plan,context,current}){
      if(!discovery)throw new Error("DIGITALOCEAN_DISCOVERY_REQUIRED");
      let spec=compileDigitalOceanProvisionSpecV1({executionId:plan.executionId,leaseId:context.leaseId,region:discovery.region,sizeSlug:discovery.size.slug,imageId:discovery.image.slug,bootstrapBundleSha256:context.bootstrapBundleSha256,ttlSeconds:context.ttlSeconds,costCapMilliUsd:context.costCapMilliUsd});
      if(context.guestBootstrap){
        const m=context.guestBootstrap.metadata;
        if(m?.schemaId!=="DO_EPHEMERAL_GUEST_BOOTSTRAP_V1"||m.executionId!==plan.executionId||m.leaseId!==context.leaseId||m.sourceSha!==plan.sourceHead||m.planSha256!==context.planSha256||m.ttlSeconds!==context.ttlSeconds||m.expiresAtMs<=Date.now()||typeof context.guestBootstrap.materializeUserData!=="function")throw new Error("DIGITALOCEAN_GUEST_BOOTSTRAP_BINDING_REQUIRED");
        spec={...spec,userData:null,guestBootstrap:m};
      }
      return current.droplets.length?{action:"NOOP",resourceId:current.droplets[0].resourceId,spec}:{action:"CREATE",spec,projectedCostMilliUsd:discovery.size.projectedCostMilliUsd};
    },
    async mutateMinimalDelta({diff,context={}}){
      if(diff.action==="NOOP"){resourceId=diff.resourceId;return {noOp:true,resourceCountDelta:0,newPaidResourceCreated:false,resourceId}}
      let userData=diff.spec.userData;
      if(diff.spec.guestBootstrap){
        if(context.guestBootstrap?.metadata?.userDataSha256!==diff.spec.guestBootstrap.userDataSha256)throw new Error("DIGITALOCEAN_GUEST_BOOTSTRAP_REFERENCE_MISMATCH");
        userData=context.guestBootstrap.materializeUserData();
        if(createHash("sha256").update(userData).digest("hex")!==diff.spec.guestBootstrap.userDataSha256)throw new Error("DIGITALOCEAN_GUEST_BOOTSTRAP_DIGEST_MISMATCH");
      }
      const r=await call("POST","/v2/droplets",{allowed:[202],body:{name:`atelier-${diff.spec.executionId}`.slice(0,63),region:diff.spec.region,size:diff.spec.sizeSlug,image:diff.spec.imageId,user_data:userData,tags:diff.spec.tags,backups:false,monitoring:false,ipv6:false}});
      if(r.body?.droplet?.id==null)throw new Error("DIGITALOCEAN_CREATE_ID_REQUIRED");
      resourceId=String(r.body.droplet.id);return {noOp:false,resourceCountDelta:1,newPaidResourceCreated:true,resourceId,projectedCostMilliUsd:diff.projectedCostMilliUsd};
    },
    async reconcileUnknown({plan,context}){const xs=await owned(plan.executionId,context.leaseId);if(xs.length>1)return {status:"BLOCKED_AMBIGUOUS",resourceCountDelta:xs.length,newPaidResourceCreated:true};if(xs.length===1){resourceId=xs[0].resourceId;return {status:"RECONCILED",resourceCountDelta:1,newPaidResourceCreated:true,resourceId}}return {status:"RECONCILED",resourceCountDelta:0,newPaidResourceCreated:false}},
    async authoritativeReadback({plan,context}){if(!resourceId)throw new Error("DIGITALOCEAN_RESOURCE_ID_REQUIRED");const r=await call("GET",`/v2/droplets/${resourceId}`);const d=r.body?.droplet;if(d?.status!=="active")throw new Error("DIGITALOCEAN_DROPLET_NOT_ACTIVE");for(const t of tags(plan.executionId,context.leaseId))if(!(d.tags??[]).includes(t))throw new Error("DIGITALOCEAN_TAG_READBACK_MISMATCH");return {resourceId,status:d.status,ipv4:(d.networks?.v4??[]).map(x=>x.ip_address),receiptDigest:sha({id:resourceId,status:d.status,tags:[...(d.tags??[])].sort()})}},
    async cleanup({plan,context}={}){
      if(!resourceId)return {ephemeralCredentialResidue:false,childBillableResourceCount:0};
      const xs=await owned(plan?.executionId,context?.leaseId);
      if(!xs.some(x=>x.resourceId===resourceId))throw new Error("DIGITALOCEAN_CLEANUP_OWNERSHIP_NOT_VERIFIED");
      childCount=null;
      try{
        const r=await call("GET",`/v2/droplets/${resourceId}/destroy_with_associated_resources`);
        const keys=["snapshots","volumes","volume_snapshots","reserved_ips"];
        if(!keys.every(k=>Array.isArray(r.body?.[k])))throw new Error("DIGITALOCEAN_CHILD_INVENTORY_SCHEMA_REQUIRED");
        childCount=keys.reduce((n,k)=>n+r.body[k].length,0);
      }catch{
        // Release owned paid compute even when the child scan fails. Preserve
        // uncertainty and reject zero-residue acceptance after deletion.
        await call("DELETE",`/v2/droplets/${resourceId}`,{allowed:[204]});
        throw new Error("DIGITALOCEAN_CHILD_INVENTORY_UNKNOWN_AFTER_DELETE");
      }
      await call("DELETE",`/v2/droplets/${resourceId}`,{allowed:[204]});
      return {ephemeralCredentialResidue:false,childBillableResourceCount:childCount};
    },
    async deleteReadback({plan,context}){if(resourceId){const r=await request({method:"GET",path:`/v2/droplets/${resourceId}`,query:null,body:null,tokenMaterialAllowed:false});if(r.status!==404)return {resourceAbsent:false,status:r.status}}const xs=await owned(plan.executionId,context.leaseId);return {resourceAbsent:xs.length===0,ownedDropletCount:xs.length}},
    async residueScan({plan,context}){const xs=await owned(plan.executionId,context.leaseId);if(resourceId&&childCount===null)throw new Error("DIGITALOCEAN_CHILD_INVENTORY_UNKNOWN");return {ACTIVE_PAID_COMPUTE:xs.length,ORPHANED_BILLABLE_RESOURCE:childCount??0,BILLABLE_RESIDUE:xs.length+(childCount??0)}}
  });
}

