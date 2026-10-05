import {assertNoRawSecretMaterialV1,idV1,reqIntV1,reqStringV1,sha256V1} from "./core-util-v1.mjs";
const EFFECT_CLASSES=new Set(["PURE_READ","QUERY","PROVIDER_MUTATION","DESTRUCTIVE_MUTATION"]);
const REPLAY_CLASSES=new Set(["READ_ONLY","IDEMPOTENT_WRITE","SINGLE_USE_WRITE","DESTRUCTIVE_WRITE"]);
const SHA64=/^[0-9a-f]{64}$/;
export function compileExternalExecutionHandoffEnvelopeV1(input={}){
  const snapshot=input.authoritativeJobSnapshot;
  if(!snapshot||snapshot.schemaId!=="AUTHORITATIVE_JOB_SNAPSHOT_V1")throw new Error("V006_AUTHORITATIVE_JOB_SNAPSHOT_REQUIRED");
  const j=snapshot.job??{};
  const executionId=reqStringV1(j.executionId,"V006_EXECUTION_ID_REQUIRED");
  if(j.attemptId!==input.attemptId)throw new Error("V006_ATTEMPT_NAMESPACE_MISMATCH");
  if(j.fenceToken!==input.fenceToken)throw new Error("V006_FENCE_NAMESPACE_MISMATCH");
  if(!EFFECT_CLASSES.has(input.effectClass))throw new Error("V006_EFFECT_CLASS_INVALID");
  if(!REPLAY_CLASSES.has(input.replayClass))throw new Error("V006_REPLAY_CLASS_INVALID");
  for(const k of ["planDigest","sourceManifestDigest","payloadDigest","instructionDigest","runtimeContractSetDigest"])if(!SHA64.test(input[k]??""))throw new Error("V006_DIGEST_REQUIRED:"+k);
  const createdAtMs=reqIntV1(input.createdAtMs,"V006_HANDOFF_CREATED_AT_REQUIRED");
  const expiresAtMs=reqIntV1(input.expiresAtMs,"V006_HANDOFF_EXPIRES_AT_REQUIRED");
  if(expiresAtMs<=createdAtMs)throw new Error("V006_HANDOFF_EXPIRY_INVALID");
  const body={schemaId:"V006_EXTERNAL_EXECUTION_HANDOFF_ENVELOPE_V1",schemaVersion:"1",handoffId:input.handoffId??idV1("handoff"),masterPlanRunId:reqStringV1(input.masterPlanRunId,"V006_MASTER_PLAN_RUN_ID_REQUIRED"),phaseId:reqStringV1(input.phaseId,"V006_PHASE_ID_REQUIRED"),projectIdentity:reqStringV1(input.projectIdentity,"V006_PROJECT_IDENTITY_REQUIRED"),planDigest:input.planDigest,sourceManifestDigest:input.sourceManifestDigest,authoritativeJobSnapshotRef:{schemaId:snapshot.schemaId,snapshotDigest:sha256V1(snapshot)},executionId,attemptId:input.attemptId,leaseGeneration:reqIntV1(input.leaseGeneration,"V006_LEASE_GENERATION_REQUIRED"),fenceToken:input.fenceToken,targetSystem:reqStringV1(input.targetSystem,"V006_TARGET_SYSTEM_REQUIRED"),targetIdentity:reqStringV1(input.targetIdentity,"V006_TARGET_IDENTITY_REQUIRED"),executorClass:reqStringV1(input.executorClass,"V006_EXECUTOR_CLASS_REQUIRED"),requiredCapabilities:[...new Set(input.requiredCapabilities??[])].sort(),effectClass:input.effectClass,replayClass:input.replayClass,payloadDigest:input.payloadDigest,instructionDigest:input.instructionDigest,authorityEnvelopeRef:reqStringV1(input.authorityEnvelopeRef,"V006_AUTHORITY_ENVELOPE_REF_REQUIRED"),expectedPostconditions:Object.freeze([...(input.expectedPostconditions??[])]),readbackPlan:Object.freeze([...(input.readbackPlan??[])]),runtimeContractSetDigest:input.runtimeContractSetDigest,executorProtocolVersion:reqStringV1(input.executorProtocolVersion,"V006_EXECUTOR_PROTOCOL_REQUIRED"),rendererProtocolVersion:reqStringV1(input.rendererProtocolVersion,"V006_RENDERER_PROTOCOL_REQUIRED"),receiptSchemaVersion:reqStringV1(input.receiptSchemaVersion,"V006_RECEIPT_SCHEMA_REQUIRED"),createdAtMs,expiresAtMs,revokedAtMs:null,supersededBy:null,resumeAnchorId:reqStringV1(input.resumeAnchorId,"V006_RESUME_ANCHOR_REQUIRED"),runtimeAcceptanceAuthorityPreserved:true,handoffCanAdvanceRuntimeFence:false};
  assertNoRawSecretMaterialV1(body);
  return Object.freeze({...body,handoffDigest:sha256V1(body)});
}
export function evaluateHandoffFreshnessV1({handoff,currentProjectIdentity,currentPlanDigest,currentSourceManifestDigest,currentAttemptId,currentLeaseGeneration,currentFenceToken,currentTargetIdentity,nowMs,revoked=false,superseded=false}={}){
  if(!handoff||handoff.schemaId!=="V006_EXTERNAL_EXECUTION_HANDOFF_ENVELOPE_V1")throw new Error("V006_HANDOFF_REQUIRED");
  const reasons=[];
  if(currentProjectIdentity!==handoff.projectIdentity)reasons.push("PROJECT_IDENTITY_MISMATCH");
  if(currentPlanDigest!==handoff.planDigest)reasons.push("PLAN_DIGEST_MISMATCH");
  if(currentSourceManifestDigest!==handoff.sourceManifestDigest)reasons.push("SOURCE_MANIFEST_MISMATCH");
  if(currentAttemptId!==handoff.attemptId)reasons.push("ATTEMPT_MISMATCH");
  if(currentLeaseGeneration!==handoff.leaseGeneration)reasons.push("LEASE_MISMATCH");
  if(currentFenceToken!==handoff.fenceToken)reasons.push("FENCE_MISMATCH");
  if(currentTargetIdentity!==handoff.targetIdentity)reasons.push("TARGET_IDENTITY_MISMATCH");
  if(!Number.isSafeInteger(nowMs)||nowMs>=handoff.expiresAtMs)reasons.push("HANDOFF_EXPIRED");
  if(revoked)reasons.push("HANDOFF_REVOKED");
  if(superseded)reasons.push("HANDOFF_SUPERSEDED");
  return Object.freeze({allowed:reasons.length===0,code:reasons.length?"HANDOFF_STALE":"HANDOFF_FRESH",reasons});
}
export function compileHandoffReceiptV1({receiptType,handoffDigest,previousReceiptDigest=null,payload={},createdAtMs}={}){
  const allowed=["HANDOFF_CREATED_RECEIPT","HANDOFF_DELIVERED_RECEIPT","EXTERNAL_EXECUTION_RECEIPT","AUTHORITATIVE_READBACK_RECEIPT","RECONCILIATION_RECEIPT","RESUME_RECEIPT"];
  if(!allowed.includes(receiptType))throw new Error("V006_RECEIPT_TYPE_INVALID");
  if(!SHA64.test(handoffDigest??""))throw new Error("V006_HANDOFF_DIGEST_REQUIRED");
  if(previousReceiptDigest!==null&&!SHA64.test(previousReceiptDigest))throw new Error("V006_PREVIOUS_RECEIPT_DIGEST_INVALID");
  assertNoRawSecretMaterialV1(payload);
  const body={schemaId:"V006_HANDOFF_RECEIPT_V1",receiptType,handoffDigest,previousReceiptDigest,payload,createdAtMs:reqIntV1(createdAtMs,"V006_RECEIPT_CREATED_AT_REQUIRED")};
  return Object.freeze({...body,receiptDigest:sha256V1(body)});
}
export function verifyHandoffReceiptChainV1(receipts=[]){
  if(!Array.isArray(receipts)||!receipts.length)return Object.freeze({status:"FAIL",code:"RECEIPT_CHAIN_REQUIRED"});
  let prev=null;const handoffDigest=receipts[0]?.handoffDigest;
  for(const r of receipts){if(r?.schemaId!=="V006_HANDOFF_RECEIPT_V1"||r.handoffDigest!==handoffDigest||r.previousReceiptDigest!==prev||r.receiptDigest!==sha256V1({schemaId:r.schemaId,receiptType:r.receiptType,handoffDigest:r.handoffDigest,previousReceiptDigest:r.previousReceiptDigest,payload:r.payload,createdAtMs:r.createdAtMs}))return Object.freeze({status:"FAIL",code:"RECEIPT_CHAIN_DIGEST_BROKEN"});prev=r.receiptDigest;}
  return Object.freeze({status:"PASS",code:"RECEIPT_CHAIN_VALID",handoffDigest,lastReceiptDigest:prev});
}
