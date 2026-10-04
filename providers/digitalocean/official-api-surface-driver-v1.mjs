import {createHash} from "node:crypto";
import {compileDigitalOceanProvisionSpecV1,normalizeDigitalOceanInventoryV1} from "./index.mjs";
import {selectMinimumDropletForLiveQualificationV1} from "./cost-aware-selector-v1.mjs";
import {evaluateDigitalOceanScopeEnvelopeV1} from "./api-execution-v1.mjs";

const sha=v=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const tags=(e,l)=>[`atelier-execution:${e}`,`atelier-lease:${l}`];

export function createDigitalOceanOfficialApiSurfaceDriverV1({request,getAuthMetadata,surfaceClass="OFFICIAL_NATIVE_API"}={}){
  if(typeof request!=="function"||typeof getAuthMetadata!=="function")throw new Error("DIGITALOCEAN_SURFACE_IO_REQUIRED");
  let resourceId=null,childCount=0,discovery=null;
  const call=async(method,path,opts={})=>{
    const r=await request({method,path,query:opts.query??null,body:opts.body??null,tokenMaterialAllowed:false});
    const allowed=opts.allowed??[200];
    if(!r||!allowed.includes(r.status)){const e=new Error(`DIGITALOCEAN_HTTP_STATUS_UNEXPECTED:${r?.status??"NONE"}`);if(r?.outcomeUnknown)e.code="OUTCOME_UNKNOWN";throw e}
    return r;
  };
  const owned=async(executionId,leaseId)=>{
    const r=await call("GET","/v2/droplets",{query:{tag_name:`atelier-execution:${executionId}`,per_page:200}});
    return normalizeDigitalOceanInventoryV1(r.body?.droplets??[]).filter(x=>x.tags.includes(`atelier-lease:${leaseId}`));
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
      const spec=compileDigitalOceanProvisionSpecV1({executionId:plan.executionId,leaseId:context.leaseId,region:discovery.region,sizeSlug:discovery.size.slug,imageId:discovery.image.slug,bootstrapBundleSha256:context.bootstrapBundleSha256,ttlSeconds:context.ttlSeconds,costCapMilliUsd:context.costCapMilliUsd});
      return current.droplets.length?{action:"NOOP",resourceId:current.droplets[0].resourceId,spec}:{action:"CREATE",spec,projectedCostMilliUsd:discovery.size.projectedCostMilliUsd};
    },
    async mutateMinimalDelta({diff}){
      if(diff.action==="NOOP"){resourceId=diff.resourceId;return {noOp:true,resourceCountDelta:0,newPaidResourceCreated:false,resourceId}}
      const r=await call("POST","/v2/droplets",{allowed:[202],body:{name:`atelier-${diff.spec.executionId}`.slice(0,63),region:diff.spec.region,size:diff.spec.sizeSlug,image:diff.spec.imageId,user_data:diff.spec.userData,tags:diff.spec.tags,backups:false,monitoring:false,ipv6:false}});
      if(r.body?.droplet?.id==null)throw new Error("DIGITALOCEAN_CREATE_ID_REQUIRED");
      resourceId=String(r.body.droplet.id);return {noOp:false,resourceCountDelta:1,newPaidResourceCreated:true,resourceId,projectedCostMilliUsd:diff.projectedCostMilliUsd};
    },
    async reconcileUnknown({plan,context}){const xs=await owned(plan.executionId,context.leaseId);if(xs.length>1)return {status:"BLOCKED_AMBIGUOUS",resourceCountDelta:xs.length,newPaidResourceCreated:true};if(xs.length===1){resourceId=xs[0].resourceId;return {status:"RECONCILED",resourceCountDelta:1,newPaidResourceCreated:true,resourceId}}return {status:"RECONCILED",resourceCountDelta:0,newPaidResourceCreated:false}},
    async authoritativeReadback({plan,context}){if(!resourceId)throw new Error("DIGITALOCEAN_RESOURCE_ID_REQUIRED");const r=await call("GET",`/v2/droplets/${resourceId}`);const d=r.body?.droplet;if(d?.status!=="active")throw new Error("DIGITALOCEAN_DROPLET_NOT_ACTIVE");for(const t of tags(plan.executionId,context.leaseId))if(!(d.tags??[]).includes(t))throw new Error("DIGITALOCEAN_TAG_READBACK_MISMATCH");return {resourceId,status:d.status,ipv4:(d.networks?.v4??[]).map(x=>x.ip_address),receiptDigest:sha({id:resourceId,status:d.status,tags:[...(d.tags??[])].sort()})}},
    async cleanup(){
      if(!resourceId)return {ephemeralCredentialResidue:false,childBillableResourceCount:0};
      const r=await call("GET",`/v2/droplets/${resourceId}/destroy_with_associated_resources`);
      childCount=["snapshots","volumes","volume_snapshots","reserved_ips"].reduce((n,k)=>n+(Array.isArray(r.body?.[k])?r.body[k].length:0),0);
      await call("DELETE",`/v2/droplets/${resourceId}`,{allowed:[204]});
      return {ephemeralCredentialResidue:false,childBillableResourceCount:childCount};
    },
    async deleteReadback({plan,context}){if(resourceId){const r=await request({method:"GET",path:`/v2/droplets/${resourceId}`,query:null,body:null,tokenMaterialAllowed:false});if(r.status!==404)return {resourceAbsent:false,status:r.status}}const xs=await owned(plan.executionId,context.leaseId);return {resourceAbsent:xs.length===0,ownedDropletCount:xs.length}},
    async residueScan({plan,context}){const xs=await owned(plan.executionId,context.leaseId);return {ACTIVE_PAID_COMPUTE:xs.length,ORPHANED_BILLABLE_RESOURCE:childCount,BILLABLE_RESIDUE:xs.length+childCount}}
  });
}
