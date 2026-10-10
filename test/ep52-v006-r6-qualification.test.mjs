import test from "node:test";
import assert from "node:assert/strict";
import {evaluateV006R6PreProvisionV1,evaluateV006R6PostRunCandidateV1,compileV006R6CleanupReceiptV1} from "../v006/r6-qualification-v1.mjs";
import {DIGITALOCEAN_MINIMUM_LIVE_SCOPES} from "../providers/digitalocean/api-execution-v1.mjs";
const sourceSha="a".repeat(40),planSha256="b".repeat(64),nowMs=1900000000000;
const authority={schemaId:"EP52_P19_AUTH_ENDGAME_AUTHORITY_V1",explicitUserApproval:true,
  approvalScope:"MINIMUM_COST_LIVE_QUALIFICATION_ONLY",
  costEnvelope:{maxConcurrentPaidResources:1,maxPaidComputeMilliUsdPerResource:100,
    maxTtlSeconds:1800,additionalBillableResourcesAllowed:false}};
function base(){
  return {sourceSha,planSha256,currentSourceSha:sourceSha,currentPlanSha256:planSha256,
    authority,provider:"DIGITALOCEAN",surfaceClass:"FIRST_PARTY_OFFICIAL_CONNECTOR",
    connectionState:"CONNECTED",authState:"VALID",targetIdentityReadback:"PASS",
    pricingReadback:"PASS",hourlyPriceUsd:0.00893,ttlSeconds:1800,costCapMilliUsd:100,
    grantedScopes:DIGITALOCEAN_MINIMUM_LIVE_SCOPES,
    inventory:{authoritative:true,paidCompute:0,orphanedBillableResources:0,billableResidue:0,ephemeralCredentialResidue:0},
    transportAttestation:{status:"PASS",sourceSha,planSha256,surfaceClass:"FIRST_PARTY_OFFICIAL_CONNECTOR",
      remoteExecutionCapability:true,cleanupCapability:true,observedAtMs:nowMs-30000,expiresAtMs:nowMs+120000},
    nowMs,executionCredentialReady:true,networkReachability:true,exitPathReady:true,
    additionalBillableResourcesRequested:false};
}
test("R6 no-input preflight fails closed, no resource creation",()=>{
  const r=evaluateV006R6PreProvisionV1();
  assert.equal(r.status,"DEFERRED");assert.equal(r.resourceCreateExecuted,false);
  assert.equal(r.resourceCreateAuthorizedByThisEvaluation,false);
});
test("R6 eligible fixture is only a proposal candidate, never actual approval or seal",()=>{
  const r=evaluateV006R6PreProvisionV1(base());
  assert.equal(r.status,"CANDIDATE_READY");assert.equal(r.proposalReady,true);
  assert.equal(r.finalR6Acceptance,false);assert.ok(r.predictedCostMilliUsd<100);
});
test("R6 blocks missing or stale transport as well as wrong source and plan",()=>{
  for(const delta of [
    {transportAttestation:null},
    {transportAttestation:{...base().transportAttestation,expiresAtMs:nowMs-1}},
    {currentSourceSha:"f".repeat(40)},
    {currentPlanSha256:"f".repeat(64)}
  ])assert.equal(evaluateV006R6PreProvisionV1({...base(),...delta}).proposalReady,false);
});
test("R6 rejects broad scopes, residue, paid extras, and unofficial surface",()=>{
  for(const delta of [
    {grantedScopes:["api:write"]},
    {inventory:{...base().inventory,ephemeralCredentialResidue:1}},
    {inventory:{...base().inventory,billableResidue:1}},
    {additionalBillableResourcesRequested:true},
    {surfaceClass:"THIRD_PARTY_PAID_BROWSER_AGENT"}
  ])assert.equal(evaluateV006R6PreProvisionV1({...base(),...delta}).proposalReady,false);
});
test("R6 budget/TTL/auth restrictions fail closed",()=>{
  for(const delta of [
    {hourlyPriceUsd:100},{ttlSeconds:1801},
    {authority:{...authority,explicitUserApproval:false}},
    {costCapMilliUsd:500},{exitPathReady:false}
  ])assert.equal(evaluateV006R6PreProvisionV1({...base(),...delta}).proposalReady,false);
});
test("R6 preprovision alone is never R6 PASS",()=>{
  const pre=evaluateV006R6PreProvisionV1(base());
  const r=evaluateV006R6PostRunCandidateV1({preprovision:pre,
    resourceReadback:{authoritative:true,sourceSha,planSha256,provider:"DIGITALOCEAN",
      resourceId:"fixture-r6",createObserved:true,deleteObserved:true}});
  assert.equal(r.status,"PENDING");assert.equal(r.finalR6Acceptance,false);
});
test("R6 full synthetic postrun is still candidate pending authoritative provider acceptance",()=>{
  const pre=evaluateV006R6PreProvisionV1(base());
  const receipt=compileV006R6CleanupReceiptV1({provider:"DIGITALOCEAN",resourceId:"fixture-r6",
    DELETE_OR_TERMINATE:true,DELETE_READBACK:true,EPHEMERAL_CREDENTIAL_DELETE:true,
    EPHEMERAL_CREDENTIAL_ABSENCE_READBACK:true,CHILD_BILLABLE_ARTIFACT_SCAN:true,
    PROVIDER_INVENTORY_READBACK:true,RETENTION_CLASS_RECONCILIATION:true,
    ACTIVE_PAID_COMPUTE:0,ORPHANED_BILLABLE_RESOURCE:0,BILLABLE_RESIDUE:0});
  const r=evaluateV006R6PostRunCandidateV1({preprovision:pre,cleanupReceipt:receipt,
    resourceReadback:{authoritative:true,sourceSha,planSha256,provider:"DIGITALOCEAN",resourceId:"fixture-r6",
      createObserved:true,deleteObserved:true},
    finalInventory:{authoritative:true,resourceAbsent:true,active:0,orphaned:0,billable:0,ephemeralCredentialResidue:0}});
  assert.equal(r.status,"CANDIDATE_PASS");assert.equal(r.finalR6Acceptance,false);
});
