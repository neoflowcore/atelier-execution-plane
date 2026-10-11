import {createHash} from 'node:crypto';
import {selectFixedTeardownLeaseV1} from './recovery-v1.mjs';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function evaluateControllerReplacementReferenceV1({lease,predecessor,sourceSha,planSha256,runId,originalJob,replacementJob,nowMs}={}){
  let restored=null;try{restored=selectFixedTeardownLeaseV1({existingLease:lease,sourceSha,planSha256,accountUuid:'bd0ac817-54dd-47e5-8a66-73d30e19fc3a',executionId:`r6-reference-${runId}`,leaseId:`controller-${runId}`,nowMs});}catch{}
  const checks={
    checkpoint:restored!==null,
    predecessor:restored!==null&&predecessor?.schemaId==='EP52_R6_INDEPENDENT_CONTROLLER_REFERENCE_V1'&&predecessor.sourceSha===sourceSha&&predecessor.planSha256===planSha256&&predecessor.teardown?.leaseDigest===digest(lease)&&predecessor.teardown?.expiresAtMs===lease?.expiresAtMs&&predecessor.teardown?.status==='ABSENT_AT_EXPIRY'&&predecessor.paidCreates===0&&predecessor.providerMutations===0,
    expired:Number.isSafeInteger(nowMs)&&Number.isSafeInteger(lease?.expiresAtMs)&&nowMs>=lease.expiresAtMs,
    originalJob:originalJob?.name==='r6_independent_watchdog'&&originalJob.run_id===runId&&originalJob.status==='completed'&&originalJob.conclusion==='success',
    replacementJob:replacementJob?.name==='r6_replacement_controller'&&replacementJob.run_id===runId&&replacementJob.status==='in_progress',
    differentRunners:Number.isSafeInteger(originalJob?.runner_id)&&originalJob.runner_id>0&&Number.isSafeInteger(replacementJob?.runner_id)&&replacementJob.runner_id>0&&originalJob.runner_id!==replacementJob.runner_id
  };
  return Object.freeze({schemaId:'EP52_CONTROLLER_REPLACEMENT_PREFLIGHT_V1',status:Object.values(checks).every(Boolean)?'RESTORE_REFERENCE_READY':'BLOCKED',checks,sourceSha:sourceSha??null,planSha256:planSha256??null,leaseDigest:restored?digest(restored):null,originalExpiresAtMs:restored?.expiresAtMs??null,leaseClockExtended:false,paidCreateAuthorized:false,finalR6Acceptance:false});
}
