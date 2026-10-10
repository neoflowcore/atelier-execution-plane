import {reqIntV1,reqStringV1} from "./core-util-v1.mjs";
const CLASSES=new Set(["READ_ONLY","IDEMPOTENT_WRITE","SINGLE_USE_WRITE","DESTRUCTIVE_WRITE"]);
export function compileSafeExternalBatchV1({steps=[]}={}){
  if(!Array.isArray(steps)||!steps.length)throw new Error("V006_BATCH_STEPS_REQUIRED");
  const normalized=steps.map((s,i)=>{if(!CLASSES.has(s.replayClass))throw new Error("V006_REPLAY_CLASS_INVALID");return Object.freeze({id:reqStringV1(s.id??String(i),"V006_STEP_ID_REQUIRED"),replayClass:s.replayClass,targetIdentity:reqStringV1(s.targetIdentity,"V006_STEP_TARGET_REQUIRED"),requiresReadbackAfter:s.requiresReadbackAfter===true||["SINGLE_USE_WRITE","DESTRUCTIVE_WRITE"].includes(s.replayClass),dependsOn:[...new Set(s.dependsOn??[])]});});
  const batches=[];let current=[];
  for(const step of normalized){current.push(step);if(step.requiresReadbackAfter){batches.push(Object.freeze(current));current=[];}}
  if(current.length)batches.push(Object.freeze(current));
  return Object.freeze({schemaId:"V006_SAFE_EXTERNAL_BATCH_PLAN_V1",steps:Object.freeze(normalized),batches:Object.freeze(batches),blindBatch:false,mandatoryReadbackBoundaries:batches.length-1});
}
export function evaluatePreActuationFreshnessV1(input={}){
  const required=["targetReadbackFresh","authorityFenceFresh","sourcePlanBindingFresh","expectedPreconditionsPass"];
  const failures=required.filter(k=>input[k]!==true);
  return Object.freeze({allowed:failures.length===0,code:failures.length?"ACTUATION_DENY":"PRE_ACTUATION_FRESHNESS_PASS",failures});
}
export function evaluateExternalReplayV1({replayClass,outcome,reconciled=false,postconditionSatisfied=false}={}){
  if(!CLASSES.has(replayClass))throw new Error("V006_REPLAY_CLASS_INVALID");
  if(replayClass==="READ_ONLY")return Object.freeze({retryAllowed:true,code:"READ_ONLY_RETRY_ALLOWED"});
  if(outcome==="UNKNOWN")return Object.freeze({retryAllowed:false,reconcileRequired:true,code:"UNKNOWN_OUTCOME_RECONCILE_FIRST"});
  if(replayClass==="SINGLE_USE_WRITE"||replayClass==="DESTRUCTIVE_WRITE")return Object.freeze({retryAllowed:false,reconcileRequired:true,code:"SINGLE_USE_OR_DESTRUCTIVE_NO_BLIND_REPLAY"});
  const ok=reconciled===true&&postconditionSatisfied===false;
  return Object.freeze({retryAllowed:ok,reconcileRequired:!ok,code:ok?"IDEMPOTENT_RETRY_AFTER_RECONCILE":"IDEMPOTENT_RECONCILE_REQUIRED"});
}
export function evaluateActuatorClaimV1({handoffId,existingActiveExecutorId,candidateExecutorId,replayClass}={}){
  reqStringV1(handoffId,"V006_HANDOFF_ID_REQUIRED");reqStringV1(candidateExecutorId,"V006_EXECUTOR_ID_REQUIRED");
  if(existingActiveExecutorId&&existingActiveExecutorId!==candidateExecutorId&&replayClass!=="READ_ONLY")return Object.freeze({allowed:false,code:"ACTIVE_ACTUATOR_ALREADY_CLAIMED"});
  return Object.freeze({allowed:true,code:"ACTUATOR_CLAIM_ALLOWED"});
}
export function evaluateTargetConcurrencyV1({left,right}={}){
  if(!left||!right)throw new Error("V006_CONCURRENCY_OPERATIONS_REQUIRED");
  const same=left.targetIdentity===right.targetIdentity;
  const write=x=>x.replayClass!=="READ_ONLY";
  if(same&&(left.replayClass==="DESTRUCTIVE_WRITE"||right.replayClass==="DESTRUCTIVE_WRITE"))return Object.freeze({parallel:false,code:"DESTRUCTIVE_EXCLUSIVE_LEASE"});
  if(same&&write(left)&&write(right))return Object.freeze({parallel:false,code:"SAME_TARGET_WRITE_SERIALIZE"});
  return Object.freeze({parallel:true,code:same?"READ_COMPATIBLE":"INDEPENDENT_TARGETS_PARALLEL"});
}
