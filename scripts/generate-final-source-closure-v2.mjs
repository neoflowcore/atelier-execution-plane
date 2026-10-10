#!/usr/bin/env node
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {mkdir,writeFile} from "node:fs/promises";
import {compileExecutionPlaneFinalSourceClosureV2,EP52_FINAL_SOURCE_NODES_V2} from "../auth/final-source-closure-v2.mjs";

const exec=promisify(execFile);
const head=(await exec("git",["rev-parse","HEAD"],{encoding:"utf8"})).stdout.trim();
const tree=(await exec("git",["rev-parse","HEAD^{tree}"],{encoding:"utf8"})).stdout.trim();

const deferredWork=[
  {id:"VMWARE_DIRECT_WORKER",class:"PROVIDER_LIVE"},
  {id:"VMWARE_GITHUB_SELF_HOSTED_JIT",class:"PROVIDER_LIVE"},
  {id:"VMWARE_LOCAL_REPEATABILITY",class:"PROVIDER_LIVE"},
  {id:"DIGITALOCEAN_DIRECT_WORKER",class:"PROVIDER_LIVE"},
  {id:"DIGITALOCEAN_GITHUB_SELF_HOSTED_JIT",class:"PROVIDER_LIVE"},
  {id:"CROSS_PROVIDER_SHADOW_CANARY",class:"FINAL_LIVE"},
  {id:"EXTERNAL_PROVIDER_CLEANUP_DELETE_READBACK_RESIDUE_ZERO",class:"FINAL_LIVE"},
  {id:"P23_FINAL_INTERFACE_FREEZE",class:"FINAL_LIVE"},
  {id:"P24_EXECUTION_PLANE_DEVELOPMENT_SEAL_HANDOFF",class:"FINAL_LIVE"},
  {id:"COMPATIBILITY_REBIND_RECEIPT",class:"POST_SEAL_LIVE"},
  {id:"BOUNDED_INTEGRATION_LIVE",class:"POST_SEAL_LIVE"},
  {id:"ADDITIVE_INTEGRATION_SEAL",class:"POST_SEAL_LIVE"}
];

const closure=compileExecutionPlaneFinalSourceClosureV2({
  sourceHead:head,
  sourceTree:tree,
  completedSourceNodes:EP52_FINAL_SOURCE_NODES_V2,
  deferredWork,
  horizon1IntegrationSealStatus:"PENDING"
});
if(closure.status!=="PASS_SOURCE_EXHAUSTED_LIVE_DEFERRED") throw new Error(`EP52_SOURCE_CLOSURE_NOT_PASS:${closure.status}`);
if(closure.HORIZON2_START_ALLOWED!==false) throw new Error("EP52_HORIZON2_PREMATURE_UNLOCK");
const body={
  ...closure,
  repository:process.env.GITHUB_REPOSITORY??"neoflowcore/atelier-execution-plane",
  branch:process.env.GITHUB_HEAD_REF||process.env.GITHUB_REF_NAME||"ep52-h1-recovery",
  runId:process.env.GITHUB_RUN_ID??null,
  runAttempt:process.env.GITHUB_RUN_ATTEMPT??null,
  nodeVersion:process.version,
  generatedInCanonicalCI:true,
  sourceTodoScan:"PASS_ZERO_KNOWN_MARKERS",
  priorP18ReceiptSupersededForCurrentSource:true,
  historicalP18ReceiptPreserved:true
};
await mkdir("artifacts/ep52/source-closure",{recursive:true});
await writeFile("artifacts/ep52/source-closure/final-source-closure-v2.json",JSON.stringify(body,null,2)+"\n");
console.log(`EP52_FINAL_SOURCE_CLOSURE_V2=PASS head=${head} tree=${tree} deferred=${deferredWork.length}`);
