#!/usr/bin/env node
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {compileAuthoritativeJobSnapshotV1} from "../snapshot/job-snapshot-v1.mjs";
import {compileExternalExecutorCapabilityAttestationV1,evaluateExternalExecutorAdmissionV1} from "../v006/executor-trust-v1.mjs";
import {compileExternalExecutionHandoffEnvelopeV1,evaluateHandoffFreshnessV1,compileHandoffReceiptV1,verifyHandoffReceiptChainV1} from "../v006/handoff-envelope-v1.mjs";
import {evaluateAuthoritativeExternalAcceptanceV1} from "../v006/acceptance-v1.mjs";
import {reconcileExternalPostconditionsV1,compileDurableExternalResumeStateV1,evaluateResumeSignalV1} from "../v006/reconciliation-resume-v1.mjs";
import {evaluateAutomatedMachineReferenceV1} from "../v006/live-reference-v1.mjs";
import {sha256V1} from "../v006/core-util-v1.mjs";

const root=resolve(import.meta.dirname,"..");
const repo=process.env.GITHUB_REPOSITORY;
const sourceSha=process.env.EP52_SOURCE_SHA;
const apiUrl=process.env.GITHUB_API_URL??"https://api.github.com";
const auth=process.env.GH_READ_CREDENTIAL;
const runId=process.env.GITHUB_RUN_ID??"unknown";
const runAttempt=process.env.GITHUB_RUN_ATTEMPT??"1";
const jobName=process.env.GITHUB_JOB??"v006-r1";
if(!repo||!sourceSha||!auth) throw new Error("V006_R1_GITHUB_CONTEXT_REQUIRED");

async function gh(path){
  const res=await fetch(apiUrl+path,{headers:{Accept:"application/vnd.github+json",Authorization:`Bearer ${auth}`,"X-GitHub-Api-Version":"2022-11-28"}});
  if(!res.ok) throw new Error(`V006_R1_GITHUB_READ_FAILED:${res.status}:${path}`);
  return res.json();
}

const plan=JSON.parse(await readFile(resolve(root,"docs/EP52_V006_PLAN_BINDING_v001.json"),"utf8"));
const runtimeHandoff=JSON.parse(await readFile(resolve(root,"contracts/runtime52/RUNTIME_REV52_HANDOFF_BUNDLE_V1.json"),"utf8"));
const preflightCommit=await gh(`/repos/${repo}/commits/${sourceSha}`);
const treeSha=preflightCommit?.commit?.tree?.sha;
if(preflightCommit?.sha!==sourceSha||typeof treeSha!=="string") throw new Error("V006_R1_TARGET_PREFLIGHT_MISMATCH");

const now=Date.now();
const executionId=`v006-r1-${runId}`;
const attemptId=`attempt-${runAttempt}`;
const fenceToken=1;
const snapshot=compileAuthoritativeJobSnapshotV1({
  runtimeState:{executionId,attemptId,fenceToken,authorityState:"AUTHORIZED",acceptanceState:"PENDING",cancelState:"ACTIVE"},
  sidecarObservation:{providerClass:"GITHUB_HOSTED",transport:"GITHUB_ACTIONS",runnerOs:process.env.RUNNER_OS??process.platform}
});
const sourceManifestDigest=sha256V1({repository:repo,sourceSha,treeSha});
const payload={operation:"READ_CURRENT_COMMIT",repository:repo,sourceSha};
const payloadDigest=sha256V1(payload);
const instructionDigest=sha256V1({intent:"authoritative external readback",effectClass:"QUERY",acceptanceAuthority:"RUNTIME"});
const capabilities=["GITHUB_API_READ","NODE_22","ARTIFACT_TRANSFER","AUTHORITATIVE_READBACK"];

const attestation=compileExternalExecutorCapabilityAttestationV1({
  executorId:`github-hosted:${runId}:${runAttempt}:${jobName}`,
  executorClass:"FIRST_PARTY_AUTOMATED",
  os:process.platform,
  architecture:process.arch,
  shellRuntimeClass:"NODE",
  toolVersions:{node:process.version},
  networkReachability:["api.github.com"],
  targetReachability:[repo],
  protocolVersion:"v006-executor-1",
  rendererVersion:"v006-renderer-1",
  receiptSchemaVersion:"v006-receipt-1",
  credentialInjectionCapability:true,
  artifactTransferCapability:true,
  supportsAuthoritativeReadback:true,
  capabilities,
  observedAtMs:now,
  capabilityTtlMs:300000
});
const admission=evaluateExternalExecutorAdmissionV1({
  attestation,
  requiredCapabilities:capabilities,
  nowMs:now,
  dataPolicyCompatible:true,
  targetReachable:true,
  allowedExecutorClasses:["FIRST_PARTY_AUTOMATED"]
});
if(!admission.allowed) throw new Error(`V006_R1_EXECUTOR_ADMISSION_DENY:${admission.blockers.join(",")}`);

const handoff=compileExternalExecutionHandoffEnvelopeV1({
  authoritativeJobSnapshot:snapshot,
  attemptId,
  fenceToken,
  masterPlanRunId:`v006-live-${runId}`,
  phaseId:"V006-R1",
  projectIdentity:"ATELIER_REV52_EXECUTION_PLANE",
  planDigest:plan.planSha256,
  sourceManifestDigest,
  leaseGeneration:1,
  targetSystem:"GITHUB",
  targetIdentity:`${repo}@${sourceSha}`,
  executorClass:"FIRST_PARTY_AUTOMATED",
  requiredCapabilities:capabilities,
  effectClass:"QUERY",
  replayClass:"READ_ONLY",
  payloadDigest,
  instructionDigest,
  authorityEnvelopeRef:`github-actions:${runId}:${runAttempt}`,
  expectedPostconditions:[
    {id:"SOURCE_HEAD_MATCH"},
    {id:"SOURCE_TREE_MATCH"}
  ],
  readbackPlan:["GET_COMMIT_BY_SHA","COMPARE_HEAD_AND_TREE"],
  runtimeContractSetDigest:runtimeHandoff.handoffDigest,
  executorProtocolVersion:"v006-executor-1",
  rendererProtocolVersion:"v006-renderer-1",
  receiptSchemaVersion:"v006-receipt-1",
  createdAtMs:now,
  expiresAtMs:now+10*60*1000,
  resumeAnchorId:`github-actions:${runId}:${runAttempt}:r1`
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
if(!fresh.allowed) throw new Error(`V006_R1_HANDOFF_NOT_FRESH:${fresh.reasons.join(",")}`);

const deliveredAt=Date.now();
const observed=await gh(`/repos/${repo}/commits/${sourceSha}`);
const observedTree=observed?.commit?.tree?.sha;
const postconditions={
  SOURCE_HEAD_MATCH:observed?.sha===sourceSha,
  SOURCE_TREE_MATCH:observedTree===treeSha
};
const executorReport={status:Object.values(postconditions).every(Boolean)?"PASS":"FAIL",candidateOnly:true};
const authoritativeReadback={authoritative:true,source:"GITHUB_REST_API",observedSha:observed?.sha??null,observedTree:observedTree??null,postconditions};
const acceptance=evaluateAuthoritativeExternalAcceptanceV1({
  handoff,
  executorReport,
  authoritativeReadback,
  expectedPostconditions:handoff.expectedPostconditions
});
if(!acceptance.accepted) throw new Error(`V006_R1_RUNTIME_ACCEPTANCE_DENY:${acceptance.blockers.join(",")}`);

const reconciliation=reconcileExternalPostconditionsV1({
  handoffId:handoff.handoffId,
  expectedPostconditions:handoff.expectedPostconditions,
  authoritativeReadback:postconditions
});
const resumeState=compileDurableExternalResumeStateV1({
  handoff,
  reconciliation,
  lastAuthoritativeReadbackRef:`github-rest:commit:${sourceSha}`,
  nextLegalAction:"V006_R1_REFERENCE_COMPLETE"
});
const resume=evaluateResumeSignalV1({resumeState,authoritativeReadbackPerformed:true,nowMs:Date.now(),currentFenceToken:fenceToken});
if(!resume.allowed) throw new Error(`V006_R1_RESUME_DENY:${resume.blockers.join(",")}`);

const receipts=[];
function push(receiptType,payload,createdAtMs){
  const r=compileHandoffReceiptV1({receiptType,handoffDigest:handoff.handoffDigest,previousReceiptDigest:receipts.at(-1)?.receiptDigest??null,payload,createdAtMs});
  receipts.push(r);
}
push("HANDOFF_CREATED_RECEIPT",{handoffId:handoff.handoffId},now);
push("HANDOFF_DELIVERED_RECEIPT",{executorId:attestation.executorId,admissionCode:admission.code},deliveredAt);
push("EXTERNAL_EXECUTION_RECEIPT",{status:executorReport.status,effectClass:"QUERY"},Date.now());
push("AUTHORITATIVE_READBACK_RECEIPT",{source:"GITHUB_REST_API",postconditions},Date.now());
push("RECONCILIATION_RECEIPT",{status:reconciliation.status,pending:reconciliation.pendingPostconditions},Date.now());
push("RESUME_RECEIPT",{code:resume.code,duplicateExecution:false},Date.now());
const chain=verifyHandoffReceiptChainV1(receipts);
if(chain.status!=="PASS") throw new Error("V006_R1_RECEIPT_CHAIN_FAIL");

const reference=evaluateAutomatedMachineReferenceV1({
  exactHandoff:"PASS",
  capabilityAttestation:"PASS",
  protocolHandshake:attestation.protocolVersion===handoff.executorProtocolVersion?"PASS":"FAIL",
  externalEffect:executorReport.status,
  postconditionReadback:acceptance.accepted?"PASS":"FAIL",
  reconcile:reconciliation.status==="COMPLETE_CANDIDATE"?"PASS":"FAIL",
  sameRunResume:resume.allowed?"PASS":"FAIL",
  cleanup:"PASS"
});
if(reference.status!=="PASS") throw new Error(`V006_R1_REFERENCE_PENDING:${reference.failures.join(",")}`);

const evidence={
  schemaId:"EP52_V006_R1_GITHUB_HOSTED_REFERENCE_V1",
  status:"PASS",
  reference,
  source:{repository:repo,sourceSha,treeSha,planSha256:plan.planSha256,runtimeHandoffDigest:runtimeHandoff.handoffDigest},
  executor:{executorId:attestation.executorId,executorClass:attestation.executorClass,capabilities:attestation.capabilities,trustToAccept:attestation.trustToAccept},
  handoff:{handoffId:handoff.handoffId,handoffDigest:handoff.handoffDigest,effectClass:handoff.effectClass,replayClass:handoff.replayClass,expiresAtMs:handoff.expiresAtMs},
  authoritativeReadback,
  acceptance,
  reconciliation,
  resume:{code:resume.code,duplicateExecution:false,resumeStateDigest:resumeState.resumeStateDigest},
  receiptChain:{status:chain.status,lastReceiptDigest:chain.lastReceiptDigest,count:receipts.length},
  cleanup:{paidResourceCreated:false,temporaryResourceResidue:0,rawCredentialPersisted:false}
};
await mkdir(resolve(root,"artifacts/ep52/v006/live-references"),{recursive:true});
await writeFile(resolve(root,"artifacts/ep52/v006/live-references/r1.json"),JSON.stringify(evidence,null,2)+"\n");
console.log(`V006_R1=PASS source=${sourceSha} tree=${treeSha} executor=GITHUB_HOSTED`);
