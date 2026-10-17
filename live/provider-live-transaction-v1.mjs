import { createHash } from "node:crypto";

const SHA40=/^[0-9a-f]{40}$/;
const sha=v=>createHash("sha256").update(JSON.stringify(v),"utf8").digest("hex");
const PROVIDERS=new Set(["VMWARE","DIGITALOCEAN"]);
const TRANSPORTS=new Set(["DIRECT_WORKER","GITHUB_SELF_HOSTED_JIT"]);
const REQUIRED_STAGES=Object.freeze([
  "DISCOVER",
  "READ_CURRENT",
  "DIFF_DESIRED",
  "MUTATE_MINIMAL_DELTA",
  "AUTHORITATIVE_READBACK",
  "EXECUTE_TRANSPORT",
  "EVIDENCE_RECEIPT",
  "CLEANUP",
  "DELETE_OR_TERMINATE_READBACK",
  "RESIDUE_SCAN"
]);

export function compileProviderLiveTransactionV1(input={}){
  if(!PROVIDERS.has(input.provider)) throw new Error("PROVIDER_LIVE_PROVIDER_INVALID");
  if(!TRANSPORTS.has(input.transport)) throw new Error("PROVIDER_LIVE_TRANSPORT_INVALID");
  if(typeof input.executionId!=="string"||!input.executionId) throw new Error("PROVIDER_LIVE_EXECUTION_ID_REQUIRED");
  if(!SHA40.test(input.sourceHead??"")||!SHA40.test(input.sourceTree??"")) throw new Error("PROVIDER_LIVE_SOURCE_IDENTITY_REQUIRED");
  if(typeof input.attachTicketDigest!=="string"||!/^[0-9a-f]{64}$/.test(input.attachTicketDigest)) throw new Error("PROVIDER_LIVE_ATTACH_TICKET_DIGEST_REQUIRED");
  const paid=input.provider==="DIGITALOCEAN";
  const body={
    schemaId:"EP52_PROVIDER_LIVE_TRANSACTION_V1",
    version:"1",
    provider:input.provider,
    transport:input.transport,
    executionId:input.executionId,
    sourceHead:input.sourceHead,
    sourceTree:input.sourceTree,
    attachTicketDigest:input.attachTicketDigest,
    stages:[...REQUIRED_STAGES],
    currentStage:"DISCOVER",
    providerSelectionAuthority:"RUNTIME_PROVIDER_CONTROL_LAYER",
    executionPlaneConsumesProviderDecision:true,
    officialApiFirst:true,
    browserNormalPath:false,
    manualSshNormalPath:false,
    termuxNormalPath:false,
    rawSecretChatPath:false,
    mutateAllowedOnlyAfterDiscoverReadDiff:true,
    unknownOutcomeRequiresReconciliation:true,
    cleanupMandatory:true,
    deleteReadbackMandatory:true,
    residueScanMandatory:true,
    costEnvelope:paid?{
      maxConcurrentPaidResources:1,
      maxPaidComputeMilliUsdPerResource:100,
      maxPaidComputeMilliUsdTotal:500,
      maxTtlSeconds:1800,
      additionalBillableResourcesAllowed:false
    }:{
      maxConcurrentPaidResources:0,
      maxPaidComputeMilliUsdPerResource:0,
      maxPaidComputeMilliUsdTotal:0,
      maxTtlSeconds:1800,
      additionalBillableResourcesAllowed:false,
      existingInfrastructureOnly:true
    }
  };
  return Object.freeze({...body,transactionPlanDigest:sha(body)});
}

export function evaluateProviderLiveTransactionV1({plan,receipts=[]}={}){
  if(!plan||plan.schemaId!=="EP52_PROVIDER_LIVE_TRANSACTION_V1") throw new Error("PROVIDER_LIVE_TRANSACTION_PLAN_REQUIRED");
  if(!Array.isArray(receipts)) throw new Error("PROVIDER_LIVE_RECEIPTS_REQUIRED");
  const errors=[];
  const byStage=new Map();
  for(const r of receipts){
    if(!r||typeof r.stage!=="string") { errors.push("INVALID_STAGE_RECEIPT"); continue; }
    if(!REQUIRED_STAGES.includes(r.stage)){ errors.push(`UNKNOWN_STAGE:${r.stage}`); continue; }
    if(byStage.has(r.stage)) errors.push(`DUPLICATE_STAGE:${r.stage}`);
    byStage.set(r.stage,r);
  }
  let mutationSeen=false;
  for(const stage of REQUIRED_STAGES){
    const r=byStage.get(stage);
    if(!r){ errors.push(`MISSING_STAGE:${stage}`); continue; }
    if(r.executionId!==plan.executionId) errors.push(`EXECUTION_ID_MISMATCH:${stage}`);
    if(r.status==="OUTCOME_UNKNOWN"){
      if(r.reconciliation?.status!=="RECONCILED") errors.push(`UNRECONCILED_UNKNOWN:${stage}`);
    }else if(r.status!=="PASS"){
      errors.push(`STAGE_NOT_PASS:${stage}`);
    }
    if(stage==="MUTATE_MINIMAL_DELTA"){
      mutationSeen=true;
      for(const prereq of ["DISCOVER","READ_CURRENT","DIFF_DESIRED"]){
        const p=byStage.get(prereq);
        if(!p||p.status!=="PASS") errors.push(`MUTATION_BEFORE_PREREQ:${prereq}`);
      }
      if(plan.provider==="DIGITALOCEAN"&&r.resourceCountDelta>1) errors.push("DIGITALOCEAN_RESOURCE_COUNT_DELTA_EXCEEDS_ONE");
      if(plan.provider==="VMWARE"&&r.newPaidResourceCreated===true) errors.push("VMWARE_NEW_PAID_RESOURCE_DENIED");
    }
  }
  const residue=byStage.get("RESIDUE_SCAN");
  if(residue){
    if(residue.ACTIVE_PAID_COMPUTE!==0) errors.push("ACTIVE_PAID_COMPUTE_NOT_ZERO");
    if(residue.ORPHANED_BILLABLE_RESOURCE!==0) errors.push("ORPHANED_BILLABLE_RESOURCE_NOT_ZERO");
    if(residue.BILLABLE_RESIDUE!==0) errors.push("BILLABLE_RESIDUE_NOT_ZERO");
  }
  const deleteReadback=byStage.get("DELETE_OR_TERMINATE_READBACK");
  if(deleteReadback&&deleteReadback.resourceAbsent!==true) errors.push("RESOURCE_DELETE_READBACK_NOT_ABSENT");
  const cleanup=byStage.get("CLEANUP");
  if(cleanup&&cleanup.ephemeralCredentialResidue===true) errors.push("EPHEMERAL_CREDENTIAL_RESIDUE");
  return Object.freeze({
    schemaId:"EP52_PROVIDER_LIVE_TRANSACTION_EVALUATION_V1",
    provider:plan.provider,
    transport:plan.transport,
    executionId:plan.executionId,
    mutationSeen,
    errors,
    status:errors.length===0?"PASS":"FAIL",
    liveMatrixEdge:errors.length===0?`${plan.provider}::${plan.transport}`:null,
    cleanupResidueZero:errors.length===0
  });
}

function matchesOwnership(provider,item,{executionId,leaseId}){
  if(provider==="DIGITALOCEAN"){
    const tags=Array.isArray(item.tags)?item.tags:[];
    return tags.includes(`atelier-execution:${executionId}`)&&tags.includes(`atelier-lease:${leaseId}`);
  }
  const spec=item?.spec??{};
  return spec.executionId===executionId&&spec.leaseId===leaseId;
}

export function reconcileUnknownProviderOutcomeV1({provider,executionId,leaseId,inventory=[]}={}){
  if(!PROVIDERS.has(provider)) throw new Error("RECONCILE_PROVIDER_INVALID");
  if(typeof executionId!=="string"||!executionId||typeof leaseId!=="string"||!leaseId) throw new Error("RECONCILE_OWNERSHIP_KEYS_REQUIRED");
  if(!Array.isArray(inventory)) throw new Error("RECONCILE_INVENTORY_REQUIRED");
  const matches=inventory.filter(item=>matchesOwnership(provider,item,{executionId,leaseId}));
  let state="ABSENT";
  if(matches.length===1) state="PRESENT_EXACT";
  if(matches.length>1) state="AMBIGUOUS_MULTIPLE";
  return Object.freeze({
    schemaId:"EP52_PROVIDER_UNKNOWN_OUTCOME_RECONCILIATION_V1",
    provider,executionId,leaseId,
    matchedResourceIds:matches.map(x=>String(x.resourceId??x.id??"")).filter(Boolean).sort(),
    state,
    safeToRetryCreate:matches.length===0,
    safeToTreatCreateAsSucceeded:matches.length===1,
    userApprovalRequired:matches.length>1,
    status:matches.length<=1?"RECONCILED":"BLOCKED_AMBIGUOUS"
  });
}

export {REQUIRED_STAGES as PROVIDER_LIVE_TRANSACTION_STAGES};
