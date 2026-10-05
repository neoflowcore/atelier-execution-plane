function pass(v){return v==="PASS"||v===true}
export function compileV006LiveReferencePlanV1({referenceClass,handoffRequired=true,authorityRequired=false,humanActuation=false,workstation=false}={}){
 const allowed=["R1_AUTOMATED_MACHINE_EXTERNAL_EXECUTOR","R2_HUMAN_ACTUATED_EXTERNAL_EXECUTOR","R3_DURABLE_AUTHORITY_TO_EPHEMERAL_CREDENTIAL","R4_PARTIAL_COMPLETION_RECONCILE_RESUME","R5_DISCONNECT_NEW_CHAT_DURABLE_REATTACH","R6_PAID_RESOURCE_AUTH_PREFLIGHT"];
 if(!allowed.includes(referenceClass))throw new Error("V006_REFERENCE_CLASS_INVALID");
 return Object.freeze({schemaId:"V006_LIVE_REFERENCE_PLAN_V1",referenceClass,handoffRequired,authorityRequired,humanActuation,workstation,authoritativeReadbackRequired:true,cleanupRequired:true,acceptanceAuthority:"RUNTIME",executorSelfAcceptance:false});
}
export function evaluateAutomatedMachineReferenceV1(input={}){
 const checks={exactHandoff:pass(input.exactHandoff),capabilityAttestation:pass(input.capabilityAttestation),protocolHandshake:pass(input.protocolHandshake),externalEffect:pass(input.externalEffect),postconditionReadback:pass(input.postconditionReadback),reconcile:pass(input.reconcile),sameRunResume:pass(input.sameRunResume),cleanup:pass(input.cleanup)};
 const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);return Object.freeze({referenceClass:"R1",checks,failures,status:failures.length?"PENDING":"PASS"});
}
export function evaluateDurableAuthorityReferenceV1(input={}){
 const checks={durableAuthorityBindOrReuse:pass(input.durableAuthorityBindOrReuse),ephemeralCredentialFreshMint:pass(input.ephemeralCredentialFreshMint),provenanceScopeTargetLeaseAttestation:pass(input.provenanceScopeTargetLeaseAttestation),expiryOrRevocation:pass(input.expiryOrRevocation),freshRemintWithoutUserRefresh:pass(input.freshRemintWithoutUserRefresh)};
 const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);return Object.freeze({referenceClass:"R3",checks,failures,repeatedManualTokenMint:0,status:failures.length?"PENDING":"PASS"});
}
export function evaluateHumanActuatedReferenceV1(input={}){
 const checks={boundedAction:pass(input.boundedAction),exactTarget:pass(input.exactTarget),preActuationFreshness:pass(input.preActuationFreshness),singleUseGuard:pass(input.singleUseGuard),resumeSignalOnly:pass(input.resumeSignalOnly),authoritativeReadback:pass(input.authoritativeReadback),trustReset:pass(input.trustReset),reattest:pass(input.reattest)};
 const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);return Object.freeze({referenceClass:"R2",checks,failures,duplicateSingleUseMutation:0,status:failures.length?"PENDING":"PASS"});
}
export function evaluateWorkstationBatchReferenceV1(input={}){
 const checks={immutablePayload:pass(input.immutablePayload),machineManifest:pass(input.machineManifest),humanResumeNote:pass(input.humanResumeNote),multiStepSafeBatch:pass(input.multiStepSafeBatch),noRawSecretTransfer:pass(input.noRawSecretTransfer),partialFailureFixture:pass(input.partialFailureFixture),exactExternalStateReadback:pass(input.exactExternalStateReadback)};
 const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);return Object.freeze({referenceClass:"WORKSTATION_BATCH",checks,failures,status:failures.length?"PENDING":"PASS"});
}
export function evaluateExternalContinuityConformanceV1(input={}){
 const checks={R4:pass(input.R4),R5:pass(input.R5),safeIndependentConcurrency:pass(input.safeIndependentConcurrency),sameTargetConflictControl:pass(input.sameTargetConflictControl),lateResultBoundary:pass(input.lateResultBoundary)};
 const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);return Object.freeze({schemaId:"V006_EXTERNAL_CONTINUITY_LIVE_CONFORMANCE_V1",checks,failures,status:failures.length?"PENDING":"PASS"});
}
