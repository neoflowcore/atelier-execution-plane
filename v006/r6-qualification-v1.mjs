import {evaluateExecutionAuthBeforeResourceAdmissionV1} from "./resource-admission-v1.mjs";
import {DIGITALOCEAN_MINIMUM_LIVE_SCOPES,evaluateDigitalOceanScopeEnvelopeV1,MAX_COST_CAP_MILLI_USD,MAX_TTL_SECONDS} from "../providers/digitalocean/api-execution-v1.mjs";
import {compileProviderCleanupReceiptV1} from "../billing/provider-cleanup-receipt-v1.mjs";
const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;
const OFFICIAL=new Set(["OFFICIAL_NATIVE_API","FIRST_PARTY_OFFICIAL_CONNECTOR","BUILTIN_PROVIDER_API_ADAPTER"]);
const passed=v=>v===true||v==="PASS";

/* Pure evaluation only. Never provision, transfer credentials, or accept R6. */
export function evaluateV006R6PreProvisionV1(input={}){
  const authority=input.authority??{};
  const budget=authority.costEnvelope??{};
  const inventory=input.inventory??{};
  const transport=input.transportAttestation??{};
  const scopes=evaluateDigitalOceanScopeEnvelopeV1(input.grantedScopes??[]);
  const sourceSha=input.sourceSha,planSha256=input.planSha256;
  const ttl=input.ttlSeconds,hourly=input.hourlyPriceUsd,now=input.nowMs;
  const predictedCostMilliUsd=Number.isFinite(hourly)&&hourly>=0&&Number.isSafeInteger(ttl)&&ttl>0
    ?Math.ceil(hourly*ttl/3600*1000):null;
  const identity=SHA40.test(sourceSha??"")&&SHA64.test(planSha256??"")&&
    input.currentSourceSha===sourceSha&&input.currentPlanSha256===planSha256;
  const transportReady=transport.status==="PASS"&&
    transport.sourceSha===sourceSha&&transport.planSha256===planSha256&&
    OFFICIAL.has(transport.surfaceClass)&&transport.remoteExecutionCapability===true&&
    transport.cleanupCapability===true&&Number.isFinite(now)&&
    Number.isFinite(transport.observedAtMs)&&Number.isFinite(transport.expiresAtMs)&&
    transport.observedAtMs<=now&&transport.expiresAtMs>now&&
    transport.expiresAtMs-transport.observedAtMs<=300000;
  const authorityBound=authority.schemaId==="EP52_P19_AUTH_ENDGAME_AUTHORITY_V1"&&
    authority.explicitUserApproval===true&&
    authority.approvalScope==="MINIMUM_COST_LIVE_QUALIFICATION_ONLY"&&
    budget.maxConcurrentPaidResources===1&&budget.additionalBillableResourcesAllowed===false;
  const costBound=Number.isSafeInteger(ttl)&&ttl>0&&ttl<=MAX_TTL_SECONDS&&ttl<=budget.maxTtlSeconds&&
    Number.isSafeInteger(input.costCapMilliUsd)&&input.costCapMilliUsd>0&&
    input.costCapMilliUsd<=MAX_COST_CAP_MILLI_USD&&
    input.costCapMilliUsd<=budget.maxPaidComputeMilliUsdPerResource&&
    predictedCostMilliUsd!==null&&predictedCostMilliUsd<=input.costCapMilliUsd;
  const inventoryZero=inventory.authoritative===true&&inventory.paidCompute===0&&
    inventory.orphanedBillableResources===0&&inventory.billableResidue===0&&
    inventory.ephemeralCredentialResidue===0;
  const admission=evaluateExecutionAuthBeforeResourceAdmissionV1({
    executionCredentialReady:input.executionCredentialReady===true,
    transportReady,
    networkReachability:input.networkReachability===true,
    sourceReady:identity,
    exitPathReady:input.exitPathReady===true,
    costAdmission:costBound
  });
  const checks={
    projectAndPlan:identity,
    authority:authorityBound,
    allowedSurface:OFFICIAL.has(input.surfaceClass),
    exactScopes:scopes.leastPrivilegeExactMatch===true,
    targetReadback:input.provider==="DIGITALOCEAN"&&input.targetIdentityReadback==="PASS",
    connection:input.connectionState==="CONNECTED"&&input.authState==="VALID",
    pricingReadback:input.pricingReadback==="PASS",
    inventoryAndCleanup:inventoryZero,
    noOtherPaidResources:input.additionalBillableResourcesRequested===false,
    transport:transportReady,
    boundedCostAndTtl:costBound,
    executionAuth:admission.paidResourceCreateAllowed
  };
  const blockers=Object.keys(checks).filter(k=>!checks[k]);
  return Object.freeze({
    schemaId:"EP52_V006_R6_PREPROVISION_CANDIDATE_V1",
    status:blockers.length?"DEFERRED":"CANDIDATE_READY",
    checks,blockers,admission,
    predictedCostMilliUsd,sourceSha:sourceSha??null,planSha256:planSha256??null,
    requiredScopes:[...DIGITALOCEAN_MINIMUM_LIVE_SCOPES],
    proposalReady:blockers.length===0,
    resourceCreateExecuted:false,
    resourceCreateAuthorizedByThisEvaluation:false,
    finalR6Acceptance:false
  });
}
export function evaluateV006R6PostRunCandidateV1(input={}){
  const pre=input.preprovision??{};
  const receipt=input.cleanupReceipt??null;
  const resource=input.resourceReadback??{};
  const inventory=input.finalInventory??{};
  const checks={
    preProvision:pre.schemaId==="EP52_V006_R6_PREPROVISION_CANDIDATE_V1"&&pre.proposalReady===true,
    resourceIdentity:resource.authoritative===true&&
      resource.sourceSha===pre.sourceSha&&resource.planSha256===pre.planSha256&&
      resource.provider==="DIGITALOCEAN"&&typeof resource.resourceId==="string"&&resource.resourceId.length>0,
    created:passed(resource.createObserved),
    deleted:passed(resource.deleteObserved),
    cleanupReceipt:receipt?.schemaId==="EP52_PROVIDER_CLEANUP_RECEIPT_V1"&&
      receipt.status==="PASS"&&receipt.resourceId===resource.resourceId&&receipt.provider==="DIGITALOCEAN",
    zeroInventory:inventory.authoritative===true&&inventory.resourceAbsent===true&&
      inventory.active===0&&inventory.orphaned===0&&inventory.billable===0&&
      inventory.ephemeralCredentialResidue===0
  };
  const blockers=Object.keys(checks).filter(k=>!checks[k]);
  return Object.freeze({
    schemaId:"EP52_V006_R6_POSTRUN_CANDIDATE_V1",
    checks,blockers,status:blockers.length?"PENDING":"CANDIDATE_PASS",
    authoritativeProviderAcceptanceRequired:true,
    finalR6Acceptance:false,
    retrospectiveProvisionCannotRepairFailedPreProvision:true
  });
}
export function compileV006R6CleanupReceiptV1(input={}){
  return compileProviderCleanupReceiptV1(input);
}
