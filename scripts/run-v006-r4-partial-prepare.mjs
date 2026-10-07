#!/usr/bin/env node
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {compileAuthoritativeJobSnapshotV1} from "../snapshot/job-snapshot-v1.mjs";
import {compileExternalExecutionHandoffEnvelopeV1,evaluateHandoffFreshnessV1} from "../v006/handoff-envelope-v1.mjs";
import {reconcileExternalPostconditionsV1,compileDurableExternalResumeStateV1} from "../v006/reconciliation-resume-v1.mjs";
import {sha256V1} from "../v006/core-util-v1.mjs";

const root=resolve(import.meta.dirname,"..");
const repo=process.env.GITHUB_REPOSITORY;
const sourceSha=process.env.EP52_SOURCE_SHA;
const auth=process.env.GH_READ_CREDENTIAL;
const apiUrl=process.env.GITHUB_API_URL??"https://api.github.com";
const runId=process.env.GITHUB_RUN_ID??"unknown";
const runAttempt=process.env.GITHUB_RUN_ATTEMPT??"1";
if(!repo||!sourceSha||!auth)throw new Error("V006_R4_PREPARE_CONTEXT_REQUIRED");

async function gh(path){
  const res=await fetch(apiUrl+path,{headers:{Accept:"application/vnd.github+json",Authorization:`Bearer ${auth}`,"X-GitHub-Api-Version":"2022-11-28"}});
  if(!res.ok)throw new Error(`V006_R4_GITHUB_READ_FAILED:${res.status}:${path}`);
  return res.json();
}

const plan=JSON.parse(await readFile(resolve(root,"docs/EP52_V006_PLAN_BINDING_v001.json"),"utf8"));
const runtimeHandoff=JSON.parse(await readFile(resolve(root,"contracts/runtime52/RUNTIME_REV52_HANDOFF_BUNDLE_V1.json"),"utf8"));
const commit=await gh(`/repos/${repo}/commits/${sourceSha}`);
const treeSha=commit?.commit?.tree?.sha;
if(commit?.sha!==sourceSha||typeof treeSha!=="string")throw new Error("V006_R4_PREPARE_SOURCE_MISMATCH");

const now=Date.now();
const executionId=`v006-r4-${runId}`;
const attemptId=`attempt-${runAttempt}`;
const fenceToken=4;
const snapshot=compileAuthoritativeJobSnapshotV1({
  runtimeState:{executionId,attemptId,fenceToken,authorityState:"AUTHORIZED",acceptanceState:"PENDING",cancelState:"ACTIVE"},
  sidecarObservation:{providerClass:"GITHUB_HOSTED",transport:"GITHUB_ACTIONS",stage:"PARTIAL_PREPARE"}
});
const sourceManifestDigest=sha256V1({repository:repo,sourceSha,treeSha});
const handoff=compileExternalExecutionHandoffEnvelopeV1({
  authoritativeJobSnapshot:snapshot,
  attemptId,
  fenceToken,
  masterPlanRunId:`v006-live-${runId}`,
  phaseId:"V006-R4-R5",
  projectIdentity:"ATELIER_REV52_EXECUTION_PLANE",
  planDigest:plan.planSha256,
  sourceManifestDigest,
  leaseGeneration:1,
  targetSystem:"GITHUB",
  targetIdentity:`${repo}@${sourceSha}`,
  executorClass:"FIRST_PARTY_AUTOMATED",
  requiredCapabilities:["GITHUB_API_READ","ARTIFACT_TRANSFER","DURABLE_REATTACH"],
  effectClass:"QUERY",
  replayClass:"READ_ONLY",
  payloadDigest:sha256V1({operation:"TWO_STAGE_COMMIT_READBACK",repository:repo,sourceSha}),
  instructionDigest:sha256V1({stage1:"VERIFY_HEAD",stage2:"VERIFY_TREE",resumeMissingOnly:true}),
  authorityEnvelopeRef:`github-actions:${runId}:${runAttempt}:partial`,
  expectedPostconditions:[{id:"SOURCE_HEAD_MATCH"},{id:"SOURCE_TREE_MATCH"}],
  readbackPlan:["STAGE1_GET_COMMIT_HEAD","PERSIST_PARTIAL_STATE","STAGE2_GET_COMMIT_TREE"],
  runtimeContractSetDigest:runtimeHandoff.handoffDigest,
  executorProtocolVersion:"v006-executor-1",
  rendererProtocolVersion:"v006-renderer-1",
  receiptSchemaVersion:"v006-receipt-1",
  createdAtMs:now,
  expiresAtMs:now+30*60*1000,
  resumeAnchorId:`github-actions:${runId}:${runAttempt}:r4-r5`
});
const fresh=evaluateHandoffFreshnessV1({
  handoff,
  currentProjectIdentity:"ATELIER_REV52_EXECUTION_PLANE",
  currentPlanDigest:plan.planSha256,
  currentSourceManifestDigest:sourceManifestDigest,
  currentAttemptId:attemptId,
  currentLeaseGeneration:1,
  currentFenceToken:fenceToken,
  currentTargetIdentity:`${repo}@${sourceSha}`,
  nowMs:Date.now()
});
if(!fresh.allowed)throw new Error(`V006_R4_PREPARE_HANDOFF_STALE:${fresh.reasons.join(",")}`);

const stage1Readback={SOURCE_HEAD_MATCH:commit.sha===sourceSha};
if(stage1Readback.SOURCE_HEAD_MATCH!==true)throw new Error("V006_R4_STAGE1_HEAD_MISMATCH");
const reconciliation=reconcileExternalPostconditionsV1({
  handoffId:handoff.handoffId,
  expectedPostconditions:handoff.expectedPostconditions,
  authoritativeReadback:stage1Readback
});
if(reconciliation.status!=="PARTIAL"||reconciliation.pendingPostconditions.length!==1||reconciliation.pendingPostconditions[0]!=="SOURCE_TREE_MATCH"){
  throw new Error("V006_R4_EXPECTED_PARTIAL_STATE_NOT_OBSERVED");
}
const resumeState=compileDurableExternalResumeStateV1({
  handoff,
  reconciliation,
  lastAuthoritativeReadbackRef:`github-rest:commit-head:${sourceSha}`,
  nextLegalAction:"VERIFY_ONLY_PENDING_SOURCE_TREE_MATCH"
});
const artifact={
  schemaId:"EP52_V006_R4_PARTIAL_STATE_V1",
  source:{repository:repo,sourceSha,treeSha,planSha256:plan.planSha256},
  handoff,
  stage1Readback,
  reconciliation,
  resumeState,
  producer:{runId,runAttempt,job:process.env.GITHUB_JOB??null},
  invariant:{fullRestartRequired:false,resumeMissingOnly:true,duplicateExecutionAllowed:false,rawCredentialPersisted:false}
};
await mkdir(resolve(root,"artifacts/ep52/v006/continuity"),{recursive:true});
await writeFile(resolve(root,"artifacts/ep52/v006/continuity/partial-state.json"),JSON.stringify(artifact,null,2)+"\n");
console.log(`V006_R4_PREPARE=PARTIAL handoff=${handoff.handoffId} pending=SOURCE_TREE_MATCH`);
