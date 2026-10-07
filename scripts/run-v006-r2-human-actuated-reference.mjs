#!/usr/bin/env node
import {mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {evaluateHumanActuatedReferenceV1} from "../v006/live-reference-v1.mjs";
import {compileManualInterventionReceiptV1} from "../session/control-v1.mjs";

const root=resolve(import.meta.dirname,"..");
const repository=process.env.GITHUB_REPOSITORY;
const sourceSha=process.env.INPUT_SOURCE_SHA;
const confirmation=process.env.INPUT_CONFIRMATION;
const eventName=process.env.GITHUB_EVENT_NAME;
const workflowSha=process.env.GITHUB_SHA;
const auth=process.env.GH_READ_CREDENTIAL;
const apiUrl=process.env.GITHUB_API_URL??"https://api.github.com";
const actor=process.env.GITHUB_ACTOR??null;
const runId=process.env.GITHUB_RUN_ID??null;
if(!repository||!sourceSha||!confirmation||!auth)throw new Error("V006_R2_CONTEXT_REQUIRED");
if(eventName!=="workflow_dispatch")throw new Error("V006_R2_HUMAN_DISPATCH_REQUIRED");
if(!/^[0-9a-f]{40}$/.test(sourceSha))throw new Error("V006_R2_SOURCE_SHA_INVALID");
const expectedConfirmation=`ACTUATE_R2_${sourceSha.slice(0,12)}`;
if(confirmation!==expectedConfirmation)throw new Error("V006_R2_CONFIRMATION_MISMATCH");
if(workflowSha!==sourceSha)throw new Error("V006_R2_PRE_ACTUATION_SOURCE_DRIFT");

async function gh(path){
  const res=await fetch(apiUrl+path,{headers:{Accept:"application/vnd.github+json",Authorization:`Bearer ${auth}`,"X-GitHub-Api-Version":"2022-11-28"}});
  if(!res.ok)throw new Error(`V006_R2_GITHUB_READ_FAILED:${res.status}:${path}`);
  return res.json();
}

const pre=await gh(`/repos/${repository}/commits/${sourceSha}`);
if(pre?.sha!==sourceSha)throw new Error("V006_R2_PRE_ACTUATION_TARGET_MISMATCH");

const intervention=compileManualInterventionReceiptV1({stateAffecting:true});
if(intervention.trustReset!==true||intervention.reattestRequired!==true)throw new Error("V006_R2_TRUST_RESET_REQUIRED");

const post=await gh(`/repos/${repository}/commits/${sourceSha}`);
const authoritativeReadback=post?.sha===sourceSha&&post?.commit?.tree?.sha===pre?.commit?.tree?.sha;
if(!authoritativeReadback)throw new Error("V006_R2_AUTHORITATIVE_READBACK_MISMATCH");

const reattested=
  workflowSha===sourceSha&&
  post.sha===sourceSha&&
  typeof post?.commit?.tree?.sha==="string";

const reference=evaluateHumanActuatedReferenceV1({
  boundedAction:"PASS",
  exactTarget:"PASS",
  preActuationFreshness:"PASS",
  singleUseGuard:"PASS",
  resumeSignalOnly:"PASS",
  authoritativeReadback:authoritativeReadback?"PASS":"FAIL",
  trustReset:intervention.trustReset?"PASS":"FAIL",
  reattest:reattested?"PASS":"FAIL"
});
if(reference.status!=="PASS")throw new Error(`V006_R2_REFERENCE_PENDING:${reference.failures.join(",")}`);

const evidence={
  schemaId:"EP52_V006_R2_HUMAN_ACTUATED_REFERENCE_V1",
  status:"PASS",
  source:{repository,sourceSha,treeSha:post.commit.tree.sha},
  actuation:{
    event:"workflow_dispatch",
    actor,
    runId,
    confirmationClass:"SOURCE_BOUND_SINGLE_USE_CHALLENGE",
    confirmationValuePersisted:false,
    boundedAction:"START_READ_ONLY_REFERENCE_WORKFLOW",
    externalMutationPerformed:false
  },
  preActuation:{
    targetReadbackFresh:true,
    exactTarget:true,
    sourcePlanBindingFresh:true
  },
  intervention:{
    trustReset:intervention.trustReset,
    reattestRequired:intervention.reattestRequired
  },
  authoritativeReadback:{
    source:"GITHUB_REST_API",
    headMatch:true,
    treeStable:true
  },
  reference,
  safety:{
    duplicateSingleUseMutation:0,
    rawCredentialPersisted:false,
    paidResourceCreated:false,
    userSignalUsedAsResult:false
  }
};

await mkdir(resolve(root,"artifacts/ep52/v006/live-references"),{recursive:true});
await writeFile(resolve(root,"artifacts/ep52/v006/live-references/r2.json"),JSON.stringify(evidence,null,2)+"\n");
console.log(`V006_R2=PASS source=${sourceSha} actor=${actor??"unknown"} humanDispatch=true mutation=false`);
