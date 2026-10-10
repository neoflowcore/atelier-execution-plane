import {assertNoRawSecretMaterialV1,reqStringV1,sha256V1} from "./core-util-v1.mjs";
export function evaluateAuthoritativeExternalAcceptanceV1({handoff,executorReport,authoritativeReadback,expectedPostconditions=[],manualInterventionReceipt=null,unexpectedArtifacts=[]}={}){
  if(!handoff||handoff.schemaId!=="V006_EXTERNAL_EXECUTION_HANDOFF_ENVELOPE_V1")throw new Error("V006_HANDOFF_REQUIRED");
  const blockers=[];
  if(!authoritativeReadback||authoritativeReadback.authoritative!==true)blockers.push("AUTHORITATIVE_READBACK_REQUIRED");
  for(const p of expectedPostconditions){const id=reqStringV1(p.id,"V006_POSTCONDITION_ID_REQUIRED");const v=authoritativeReadback?.postconditions?.[id];if(!(v===true||v?.status==="PASS"))blockers.push("POSTCONDITION_NOT_PASS:"+id);}
  if(unexpectedArtifacts.length)blockers.push("UNEXPECTED_ARTIFACT_QUARANTINE_REQUIRED");
  if(manualInterventionReceipt?.trustReset===true&&manualInterventionReceipt?.reattestRequired!==false)blockers.push("TRUST_RESET_REATTEST_REQUIRED");
  return Object.freeze({schemaId:"V006_AUTHORITATIVE_EXTERNAL_ACCEPTANCE_V1",executorReportedSuccess:executorReport?.status==="PASS",executorReportIsCandidateOnly:true,authoritativeReadbackObserved:authoritativeReadback?.authoritative===true,blockers,accepted:blockers.length===0,code:blockers.length?"ACCEPTANCE_DENY":"AUTHORITATIVE_EXTERNAL_ACCEPTANCE_PASS"});
}
export function compileExternalFailureCapsuleV1(input={}){
  const body={schemaId:"V006_EXTERNAL_FAILURE_CAPSULE_V1",executorId:reqStringV1(input.executorId,"V006_EXECUTOR_ID_REQUIRED"),handoffId:reqStringV1(input.handoffId,"V006_HANDOFF_ID_REQUIRED"),lastCompletedStep:input.lastCompletedStep??null,stdoutTail:input.stdoutTail??null,stderrTail:input.stderrTail??null,targetState:input.targetState??null,transportState:input.transportState??null,diagnosticArtifactDigest:input.diagnosticArtifactDigest??null,unexpectedArtifactsQuarantined:input.unexpectedArtifactsQuarantined===true,cacheTrustedAsAuthority:false};
  assertNoRawSecretMaterialV1(body);
  return Object.freeze({...body,failureCapsuleDigest:sha256V1(body)});
}
