import { createHash } from "node:crypto";

const SHA40=/^[0-9a-f]{40}$/;
const sha=v=>createHash("sha256").update(JSON.stringify(v),"utf8").digest("hex");
const PROVIDERS=new Set(["VMWARE","DIGITALOCEAN"]);

function strings(values=[]){return [...new Set(values)].sort();}

export function compileDeferredProviderAttachTicketV1(input={}){
  if(!PROVIDERS.has(input.provider)) throw new Error("DEFERRED_PROVIDER_INVALID");
  if(!SHA40.test(input.sourceHead??"")||!SHA40.test(input.sourceTree??"")) throw new Error("DEFERRED_PROVIDER_SOURCE_IDENTITY_REQUIRED");
  if(typeof input.branch!=="string"||!input.branch) throw new Error("DEFERRED_PROVIDER_BRANCH_REQUIRED");
  const allowedSurfaceClasses=input.provider==="VMWARE"
    ? ["OFFICIAL_NATIVE_API","TRUSTED_EXECUTOR"]
    : ["OFFICIAL_NATIVE_API","FIRST_PARTY_OFFICIAL_CONNECTOR","BUILTIN_PROVIDER_API_ADAPTER"];
  const requiredCapabilities=input.provider==="VMWARE"
    ? ["TARGET_IDENTITY","INVENTORY","WORKER_PROVISION_OR_BIND","DELETE_OR_TERMINATE","DELETE_READBACK","RESIDUE_SCAN"]
    : ["TARGET_IDENTITY","INVENTORY","PRICING_READBACK","CREATE_EPHEMERAL","DELETE_OR_TERMINATE","DELETE_READBACK","CHILD_BILLABLE_SCAN","RESIDUE_SCAN"];
  const body={
    schemaId:"EP52_DEFERRED_PROVIDER_ATTACH_TICKET_V1",
    version:"1",
    provider:input.provider,
    repository:"neoflowcore/atelier-execution-plane",
    branch:input.branch,
    sourceHead:input.sourceHead,
    sourceTree:input.sourceTree,
    state:"DEFERRED_PROVIDER_LIVE_WORK",
    allowedSurfaceClasses,
    requiredCapabilities,
    opaqueConnectionReferenceOnly:true,
    rawSecretMaterialAllowed:false,
    manualSshNormalPath:false,
    termuxNormalPath:false,
    approvalResetOnReattach:false,
    authResetOnReattach:false,
    phaseResetOnReattach:false,
    duplicateExecutionAllowed:false,
    freshCapabilityRediscoveryRequired:true,
    targetIdentityReadbackRequired:true,
    inventoryReadbackRequired:true,
    existingAuthReuseFirst:true,
    resumeAction:"BIND_SURFACE_READ_CURRENT_DIFF_RUN_REQUIRED_LIVE_MATRIX_CLEANUP_RESIDUE_SCAN"
  };
  if(input.provider==="VMWARE"){
    Object.assign(body,{
      existingInfrastructureOnly:true,
      newPaidResourceAllowed:false,
      requiredLiveMatrixEdges:["VMWARE::DIRECT_WORKER","VMWARE::GITHUB_SELF_HOSTED_JIT"],
      repeatabilityRequirement:"VMWARE_LOCAL_REPEATABILITY"
    });
  }else{
    Object.assign(body,{
      existingInfrastructureOnly:false,
      minimumEligibleSizeRequired:true,
      maxConcurrentPaidResources:1,
      maxPaidComputeMilliUsdPerResource:100,
      maxPaidComputeMilliUsdTotal:500,
      maxTtlSeconds:1800,
      additionalBillableResourcesAllowed:false,
      requiredLiveMatrixEdges:["DIGITALOCEAN::DIRECT_WORKER","DIGITALOCEAN::GITHUB_SELF_HOSTED_JIT"]
    });
  }
  return Object.freeze({...body,ticketDigest:sha(body)});
}

export function bindDeferredProviderSurfaceV1({ticket,surfaceReceipt}={}){
  if(!ticket||ticket.schemaId!=="EP52_DEFERRED_PROVIDER_ATTACH_TICKET_V1") throw new Error("DEFERRED_PROVIDER_ATTACH_TICKET_REQUIRED");
  if(!surfaceReceipt||surfaceReceipt.provider!==ticket.provider) throw new Error("DEFERRED_PROVIDER_SURFACE_PROVIDER_MISMATCH");
  const errors=[];
  if(!ticket.allowedSurfaceClasses.includes(surfaceReceipt.surfaceClass)) errors.push("SURFACE_CLASS_NOT_ALLOWED");
  if(surfaceReceipt.connectionState!=="CONNECTED") errors.push("SURFACE_NOT_CONNECTED");
  if(!["VALID","REUSED","NOT_REQUIRED"].includes(surfaceReceipt.authState)) errors.push("SURFACE_AUTH_NOT_VALID");
  if(surfaceReceipt.targetIdentityReadback!=="PASS") errors.push("TARGET_IDENTITY_READBACK_NOT_PASS");
  if(surfaceReceipt.inventoryReadback!=="PASS") errors.push("INVENTORY_READBACK_NOT_PASS");
  const caps=new Set(surfaceReceipt.capabilities??[]);
  for(const capability of ticket.requiredCapabilities) if(!caps.has(capability)) errors.push(`MISSING_CAPABILITY:${capability}`);
  if(surfaceReceipt.rawSecretMaterialObserved===true) errors.push("RAW_SECRET_MATERIAL_OBSERVED");
  const body={
    schemaId:"EP52_DEFERRED_PROVIDER_REATTACH_RECEIPT_V1",
    ticketDigest:ticket.ticketDigest,
    provider:ticket.provider,
    executionSurfaceId:surfaceReceipt.executionSurfaceId??null,
    providerTarget:surfaceReceipt.providerTarget??null,
    surfaceClass:surfaceReceipt.surfaceClass??null,
    connectionState:surfaceReceipt.connectionState??null,
    authState:surfaceReceipt.authState??null,
    capabilities:strings(surfaceReceipt.capabilities??[]),
    targetIdentityReadback:surfaceReceipt.targetIdentityReadback??null,
    inventoryReadback:surfaceReceipt.inventoryReadback??null,
    existingAuthReused:surfaceReceipt.existingAuthReused===true,
    rawSecretMaterialObserved:false,
    errors,
    decision:errors.length===0?"HOT_REATTACH_READY":"REATTACH_NOT_READY",
    approvalReset:false,
    authReset:false,
    duplicateExecutionAllowed:false,
    nextAction:errors.length===0?"RUN_REQUIRED_PROVIDER_LIVE_MATRIX_THEN_CLEANUP":"REFRESH_SURFACE_WITHOUT_SOURCE_RESET"
  };
  return Object.freeze({...body,reattachReceiptDigest:sha(body)});
}
