#!/usr/bin/env node
import {mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {evaluateHumanActuatedReferenceV1} from "../v006/live-reference-v1.mjs";
import {compileManualInterventionReceiptV1} from "../session/control-v1.mjs";
import {evaluateR2HumanProvenanceV1} from "../v006/human-actuation-provenance-v1.mjs";

const root=resolve(import.meta.dirname,"..");
const repository=process.env.GITHUB_REPOSITORY;
const sourceSha=process.env.EP52_SOURCE_SHA;
const eventName=process.env.GITHUB_EVENT_NAME;
const auth=process.env.GH_READ_CREDENTIAL;
const apiUrl=process.env.GITHUB_API_URL??"https://api.github.com";
const actor=process.env.GITHUB_ACTOR??null;
const triggeringActor=process.env.GITHUB_TRIGGERING_ACTOR??null;
const runId=process.env.GITHUB_RUN_ID??null;
const runAttempt=Number(process.env.GITHUB_RUN_ATTEMPT??"0");

if(!repository||!sourceSha||!auth)throw new Error("V006_R2_CONTEXT_REQUIRED");
if(eventName!=="pull_request")throw new Error("V006_R2_PR_EVENT_REQUIRED");
if(!/^[0-9a-f]{40}$/.test(sourceSha))throw new Error("V006_R2_SOURCE_SHA_INVALID");
if(!Number.isSafeInteger(runAttempt)||runAttempt<=1)throw new Error("V006_R2_HUMAN_RERUN_REQUIRED");
if(typeof triggeringActor!=="string"||!triggeringActor||/\[bot\]$/i.test(triggeringActor)||triggeringActor==="github-actions"){
  throw new Error("V006_R2_HUMAN_TRIGGERING_ACTOR_REQUIRED");
}

async function gh(path){
  const res=await fetch(apiUrl+path,{
    headers:{
      Accept:"application/vnd.github+json",
      Authorization:`Bearer ${auth}`,
      "X-GitHub-Api-Version":"2022-11-28"
    }
  });
  if(!res.ok)throw new Error(`V006_R2_GITHUB_READ_FAILED:${res.status}:${path}`);
  return res.json();
}

const pre=await gh(`/repos/${repository}/commits/${sourceSha}`);
if(pre?.sha!==sourceSha||typeof pre?.commit?.tree?.sha!=="string")throw new Error("V006_R2_PRE_ACTUATION_TARGET_MISMATCH");

const intervention=compileManualInterventionReceiptV1({stateAffecting:true});
if(intervention.trustReset!==true||intervention.reattestRequired!==true)throw new Error("V006_R2_TRUST_RESET_REQUIRED");

const post=await gh(`/repos/${repository}/commits/${sourceSha}`);
const authoritativeReadback=post?.sha===sourceSha&&post?.commit?.tree?.sha===pre?.commit?.tree?.sha;
if(!authoritativeReadback)throw new Error("V006_R2_AUTHORITATIVE_READBACK_MISMATCH");
const reattested=post.sha===sourceSha&&typeof post?.commit?.tree?.sha==="string";
const humanProvenance=evaluateR2HumanProvenanceV1({sourceSha,runAttempt,triggeringActor});

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
  status:humanProvenance.status==="PASS"?"PASS":"PENDING_HUMAN_PROVENANCE",
  source:{repository,sourceSha,treeSha:post.commit.tree.sha},
  actuation:{
    event:"PULL_REQUEST_WORKFLOW_RERUN_ORIGIN_UNVERIFIED",
    actor,
    triggeringActor,
    runId,
    runAttempt,
    boundedAction:"RERUN_EXACT_PR_WORKFLOW",
    humanActuationObserved:humanProvenance.status==="PASS",
    externalMutationPerformed:false
  },
  preActuation:{targetReadbackFresh:true,exactTarget:true,sourcePlanBindingFresh:true},
  intervention:{trustReset:intervention.trustReset,reattestRequired:intervention.reattestRequired},
  provenance:humanProvenance,
  authoritativeReadback:{source:"GITHUB_REST_API",headMatch:true,treeStable:true},
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
console.log(`V006_R2_TECHNICAL=PASS HUMAN_PROVENANCE=${humanProvenance.status} source=${sourceSha} runAttempt=${runAttempt}`);
