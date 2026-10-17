import {reqIntV1,reqStringV1,sha256V1} from "./core-util-v1.mjs";
export function reconcileExternalPostconditionsV1({handoffId,expectedPostconditions=[],authoritativeReadback={}}={}){
  reqStringV1(handoffId,"V006_HANDOFF_ID_REQUIRED");
  const completed=[],pending=[];
  for(const p of expectedPostconditions){const id=reqStringV1(p.id,"V006_POSTCONDITION_ID_REQUIRED");const observed=authoritativeReadback[id];const ok=observed===true||observed?.status==="PASS";(ok?completed:pending).push(id);}
  const body={schemaId:"V006_EXTERNAL_RECONCILIATION_RECEIPT_V1",handoffId,completedPostconditions:completed.sort(),pendingPostconditions:pending.sort(),fullRestartRequired:false,resumeMissingOnly:true,status:pending.length?"PARTIAL":"COMPLETE_CANDIDATE"};
  return Object.freeze({...body,reconciliationDigest:sha256V1(body)});
}
export function compileDurableExternalResumeStateV1({handoff, reconciliation,lastAuthoritativeReadbackRef,nextLegalAction}={}){
  if(!handoff||handoff.schemaId!=="V006_EXTERNAL_EXECUTION_HANDOFF_ENVELOPE_V1")throw new Error("V006_HANDOFF_REQUIRED");
  if(!reconciliation||reconciliation.schemaId!=="V006_EXTERNAL_RECONCILIATION_RECEIPT_V1")throw new Error("V006_RECONCILIATION_REQUIRED");
  const body={schemaId:"V006_DURABLE_EXTERNAL_RESUME_STATE_V1",activeHandoffId:handoff.handoffId,masterPlanRunId:handoff.masterPlanRunId,phaseId:handoff.phaseId,completedPostconditions:reconciliation.completedPostconditions,pendingPostconditions:reconciliation.pendingPostconditions,lastAuthoritativeReadbackRef:reqStringV1(lastAuthoritativeReadbackRef,"V006_READBACK_REF_REQUIRED"),handoffFence:handoff.fenceToken,handoffExpiryMs:handoff.expiresAtMs,nextLegalAction:reqStringV1(nextLegalAction,"V006_NEXT_LEGAL_ACTION_REQUIRED"),memoryOnlyResumeAllowed:false,duplicateExecutionAllowed:false};
  return Object.freeze({...body,resumeStateDigest:sha256V1(body)});
}
export function evaluateResumeSignalV1({resumeState,authoritativeReadbackPerformed=false,nowMs,currentFenceToken}={}){
  if(!resumeState||resumeState.schemaId!=="V006_DURABLE_EXTERNAL_RESUME_STATE_V1")throw new Error("V006_RESUME_STATE_REQUIRED");
  const blockers=[];
  if(authoritativeReadbackPerformed!==true)blockers.push("AUTHORITATIVE_READBACK_REQUIRED");
  if(!Number.isSafeInteger(nowMs)||nowMs>=resumeState.handoffExpiryMs)blockers.push("HANDOFF_EXPIRED");
  if(currentFenceToken!==resumeState.handoffFence)blockers.push("FENCE_MISMATCH");
  return Object.freeze({allowed:blockers.length===0,code:blockers.length?"RESUME_RECONCILIATION_REQUIRED":"SAME_RUN_RESUME_ALLOWED",blockers,duplicateExecution:false});
}
