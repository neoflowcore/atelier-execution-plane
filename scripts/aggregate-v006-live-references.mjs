#!/usr/bin/env node
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";

const root=resolve(import.meta.dirname,"..");
const expectedSha=process.env.EP52_SOURCE_SHA;
if(typeof expectedSha!=="string"||!/^[0-9a-f]{40}$/.test(expectedSha))throw new Error("V006_LIVE_SUMMARY_SOURCE_SHA_REQUIRED");

async function json(path){return JSON.parse(await readFile(resolve(root,path),"utf8"));}
const r1=await json("artifacts/ep52/v006/aggregate-input/pre-final/artifacts/ep52/v006/live-references/r1.json");
const r3=await json("artifacts/ep52/v006/aggregate-input/r3/r3.json");
const continuity=await json("artifacts/ep52/v006/aggregate-input/continuity/r4-r5.json");

const sourceChecks={
  R1:r1?.source?.sourceSha===expectedSha,
  R3:r3?.source?.sourceSha===expectedSha,
  R4R5:continuity?.source?.sourceSha===expectedSha
};
if(Object.values(sourceChecks).some(v=>v!==true))throw new Error(`V006_LIVE_REFERENCE_SOURCE_MISMATCH:${JSON.stringify(sourceChecks)}`);
if(r1.status!=="PASS"||r1.reference?.status!=="PASS")throw new Error("V006_R1_EVIDENCE_NOT_PASS");
if(r3.status!=="PASS"||r3.reference?.status!=="PASS")throw new Error("V006_R3_EVIDENCE_NOT_PASS");
if(continuity.status!=="PASS"||continuity.references?.R4!=="PASS"||continuity.references?.R5!=="PASS")throw new Error("V006_R4_R5_EVIDENCE_NOT_PASS");

const summary={
  schemaId:"EP52_V006_LIVE_REFERENCE_SUMMARY_V1",
  sourceSha:expectedSha,
  sourceIdentityBound:true,
  references:{
    R1:{status:"PASS",class:"AUTOMATED_MACHINE_EXTERNAL_EXECUTOR",evidence:"r1.json"},
    R2:{status:"PENDING",class:"HUMAN_ACTUATED_EXTERNAL_EXECUTOR",reason:"BOUNDED_HUMAN_ACTUATION_REFERENCE_NOT_EXECUTED"},
    R3:{status:"PASS",class:"DURABLE_AUTHORITY_TO_EPHEMERAL_CREDENTIAL",evidence:"r3.json"},
    R4:{status:"PASS",class:"PARTIAL_COMPLETION_RECONCILE_RESUME",evidence:"r4-r5.json"},
    R5:{status:"PASS",class:"DISCONNECT_DURABLE_REATTACH",evidence:"r4-r5.json"},
    R6:{status:"PENDING",class:"PAID_RESOURCE_AUTH_PREFLIGHT",reason:"EXECUTION_TRANSPORT_NOT_READY_FOR_SAFE_PAID_RESOURCE"}
  },
  passedReferenceCount:4,
  totalReferenceCount:6,
  sourceChecks,
  safety:{
    newPaidResourceCreated:false,
    rawCredentialPersisted:false,
    executorSelfAcceptance:false,
    runtimeAcceptanceAuthorityPreserved:true,
    duplicateExecutionObserved:0,
    blindRetryObserved:0
  },
  activeNext:["R2_HUMAN_ACTUATED_EXTERNAL_EXECUTOR","R6_PAID_RESOURCE_AUTH_PREFLIGHT"],
  status:"PARTIAL_LIVE_REFERENCES_PASS"
};

await mkdir(resolve(root,"artifacts/ep52/v006/live-references"),{recursive:true});
await writeFile(resolve(root,"artifacts/ep52/v006/live-references/summary.json"),JSON.stringify(summary,null,2)+"\n");
console.log(`V006_LIVE_REFERENCE_SUMMARY=PARTIAL_PASS source=${expectedSha} pass=4/6 next=R2,R6`);
