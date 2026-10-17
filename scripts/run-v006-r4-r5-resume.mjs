#!/usr/bin/env node
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {evaluateHandoffFreshnessV1} from "../v006/handoff-envelope-v1.mjs";
import {reconcileExternalPostconditionsV1,evaluateResumeSignalV1} from "../v006/reconciliation-resume-v1.mjs";
import {evaluateExternalContinuityConformanceV1} from "../v006/live-reference-v1.mjs";
import {evaluateTargetConcurrencyV1,evaluateExternalReplayV1} from "../v006/safe-batch-v1.mjs";
import {evaluateLateOutputV1} from "../session/control-v1.mjs";

const root=resolve(import.meta.dirname,"..");
const auth=process.env.GH_READ_CREDENTIAL;
const apiUrl=process.env.GITHUB_API_URL??"https://api.github.com";
const runId=process.env.GITHUB_RUN_ID??"unknown";
const runAttempt=process.env.GITHUB_RUN_ATTEMPT??"1";
if(!auth)throw new Error("V006_R4_R5_RESUME_AUTH_REQUIRED");

async function gh(path){
  const res=await fetch(apiUrl+path,{headers:{Accept:"application/vnd.github+json",Authorization:`Bearer ${auth}`,"X-GitHub-Api-Version":"2022-11-28"}});
  if(!res.ok)throw new Error(`V006_R4_R5_GITHUB_READ_FAILED:${res.status}:${path}`);
  return res.json();
}

const partial=JSON.parse(await readFile(resolve(root,"artifacts/ep52/v006/continuity/partial-state.json"),"utf8"));
if(partial?.schemaId!=="EP52_V006_R4_PARTIAL_STATE_V1")throw new Error("V006_R4_PARTIAL_STATE_REQUIRED");
const {handoff,resumeState,source}=partial;

const fresh=evaluateHandoffFreshnessV1({
  handoff,
  currentProjectIdentity:"ATELIER_REV52_EXECUTION_PLANE",
  currentPlanDigest:source.planSha256,
  currentSourceManifestDigest:handoff.sourceManifestDigest,
  currentAttemptId:handoff.attemptId,
  currentLeaseGeneration:handoff.leaseGeneration,
  currentFenceToken:handoff.fenceToken,
  currentTargetIdentity:handoff.targetIdentity,
  nowMs:Date.now()
});
if(!fresh.allowed)throw new Error(`V006_R5_REATTACH_HANDOFF_STALE:${fresh.reasons.join(",")}`);

const preResume=evaluateResumeSignalV1({
  resumeState,
  authoritativeReadbackPerformed:false,
  nowMs:Date.now(),
  currentFenceToken:handoff.fenceToken
});
if(preResume.allowed||!preResume.blockers.includes("AUTHORITATIVE_READBACK_REQUIRED"))throw new Error("V006_R5_READBACK_GUARD_NOT_ENFORCED");

const observed=await gh(`/repos/${source.repository}/commits/${source.sourceSha}`);
const stage2Readback={
  SOURCE_HEAD_MATCH:observed?.sha===source.sourceSha,
  SOURCE_TREE_MATCH:observed?.commit?.tree?.sha===source.treeSha
};
if(!stage2Readback.SOURCE_HEAD_MATCH||!stage2Readback.SOURCE_TREE_MATCH)throw new Error("V006_R4_R5_AUTHORITATIVE_READBACK_MISMATCH");

const reconciliation=reconcileExternalPostconditionsV1({
  handoffId:handoff.handoffId,
  expectedPostconditions:handoff.expectedPostconditions,
  authoritativeReadback:stage2Readback
});
if(reconciliation.status!=="COMPLETE_CANDIDATE"||reconciliation.pendingPostconditions.length!==0)throw new Error("V006_R4_RESUME_NOT_COMPLETE");

const resume=evaluateResumeSignalV1({
  resumeState,
  authoritativeReadbackPerformed:true,
  nowMs:Date.now(),
  currentFenceToken:handoff.fenceToken
});
if(!resume.allowed||resume.duplicateExecution!==false)throw new Error("V006_R5_DURABLE_REATTACH_DENIED");

const independent=evaluateTargetConcurrencyV1({
  left:{targetIdentity:`${source.repository}:commit:${source.sourceSha}`,replayClass:"READ_ONLY"},
  right:{targetIdentity:`${source.repository}:tree:${source.treeSha}`,replayClass:"READ_ONLY"}
});
const sameTargetConflict=evaluateTargetConcurrencyV1({
  left:{targetIdentity:handoff.targetIdentity,replayClass:"IDEMPOTENT_WRITE"},
  right:{targetIdentity:handoff.targetIdentity,replayClass:"IDEMPOTENT_WRITE"}
});
const unknownReplay=evaluateExternalReplayV1({replayClass:"IDEMPOTENT_WRITE",outcome:"UNKNOWN"});
const late=evaluateLateOutputV1({resultFenceToken:handoff.fenceToken,currentFenceToken:handoff.fenceToken+1,canceled:true});

const R4=reconciliation.status==="COMPLETE_CANDIDATE"&&partial.reconciliation.status==="PARTIAL"&&partial.invariant.resumeMissingOnly===true?"PASS":"PENDING";
const R5=resume.allowed&&partial.producer.job!==(process.env.GITHUB_JOB??null)&&partial.invariant.duplicateExecutionAllowed===false?"PASS":"PENDING";
const continuity=evaluateExternalContinuityConformanceV1({
  R4,
  R5,
  safeIndependentConcurrency:independent.parallel===true?"PASS":"FAIL",
  sameTargetConflictControl:sameTargetConflict.parallel===false?"PASS":"FAIL",
  lateResultBoundary:late.accepted===false&&unknownReplay.retryAllowed===false?"PASS":"FAIL"
});
if(continuity.status!=="PASS")throw new Error(`V006_R4_R5_CONTINUITY_PENDING:${continuity.failures.join(",")}`);

const evidence={
  schemaId:"EP52_V006_R4_R5_GITHUB_JOB_REATTACH_REFERENCE_V1",
  status:"PASS",
  references:{R4,R5},
  source,
  handoff:{handoffId:handoff.handoffId,handoffDigest:handoff.handoffDigest,fenceToken:handoff.fenceToken,expiresAtMs:handoff.expiresAtMs},
  producerJob:partial.producer,
  consumerJob:{runId,runAttempt,job:process.env.GITHUB_JOB??null},
  authoritativeReadback:{source:"GITHUB_REST_API",postconditions:stage2Readback},
  reconciliation,
  resume:{code:resume.code,duplicateExecution:false},
  controls:{
    independentReadConcurrency:independent,
    sameTargetWriteConflict:sameTargetConflict,
    unknownOutcomeReplay:unknownReplay,
    lateResultBoundary:late
  },
  continuity,
  cleanup:{paidResourceCreated:false,temporaryResourceResidue:0,rawCredentialPersisted:false}
};
await mkdir(resolve(root,"artifacts/ep52/v006/live-references"),{recursive:true});
await writeFile(resolve(root,"artifacts/ep52/v006/live-references/r4-r5.json"),JSON.stringify(evidence,null,2)+"\n");
console.log(`V006_R4=PASS V006_R5=PASS handoff=${handoff.handoffId} producer=${partial.producer.job} consumer=${process.env.GITHUB_JOB}`);
