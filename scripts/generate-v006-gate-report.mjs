#!/usr/bin/env node
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {evaluateV006R6PreProvisionV1} from "../v006/r6-qualification-v1.mjs";
import {evaluateV006FinalReadinessV1} from "../v006/final-readiness-v1.mjs";
const exec=promisify(execFile),root=resolve(import.meta.dirname,"..");
const read=async path=>JSON.parse(await readFile(resolve(root,path),"utf8"));
const sha=(await exec("git",["rev-parse","HEAD"],{cwd:root})).stdout.trim();
const tree=(await exec("git",["rev-parse","HEAD^{tree}"],{cwd:root})).stdout.trim();
if(sha!==process.env.EP52_SOURCE_SHA)throw Error("V006_GATE_REPORT_SOURCE_HEAD_MISMATCH");
const plan=await read("docs/EP52_V006_PLAN_BINDING_v001.json");
const auth=await read("docs/EP52_P19_AUTH_ENDGAME_AUTHORITY_v001.json");
const summary=await read("artifacts/ep52/v006/live-references/summary.json");
const closure=await read("artifacts/ep52/v006/aggregate-input/pre-final/artifacts/ep52/v006/source-closure.json");
if(summary.sourceSha!==sha||closure.sourceHead!==sha||closure.sourceTree!==tree||
   closure.plan?.planSha256!==plan.planSha256||
   closure.plan?.bundleSha256!==plan.bundleSha256)
  throw Error("V006_GATE_REPORT_IDENTITY_OR_PLAN_DRIFT");
const r6=evaluateV006R6PreProvisionV1({
  sourceSha:sha,planSha256:plan.planSha256,currentSourceSha:sha,currentPlanSha256:plan.planSha256,
  authority:auth,provider:"DIGITALOCEAN",surfaceClass:"FIRST_PARTY_OFFICIAL_CONNECTOR",
  grantedScopes:[],inventory:{authoritative:false},transportAttestation:null,
  executionCredentialReady:false,networkReachability:false,exitPathReady:false,
  additionalBillableResourcesRequested:false
});
if(r6.proposalReady||r6.resourceCreateExecuted)throw Error("V006_GATE_REPORT_MUST_DENY_UNATTESTED_R6");
const refs=Object.fromEntries(Object.entries(summary.references??{}).map(([k,v])=>[k,v.status]));
const final=evaluateV006FinalReadinessV1({
  references:refs,coreContracts:{},integrationLocks:{},predecessorControlsPass:false,
  ACTIVE_PAID_COMPUTE:null,ORPHANED_BILLABLE_RESOURCE:null,BILLABLE_RESIDUE:null
});
const report={
  schemaId:"EP52_V006_SOURCE_BOUND_GATE_REPORT_V1",
  source:{repository:process.env.GITHUB_REPOSITORY??null,sha,tree},
  plan:{planSha256:plan.planSha256,bundleSha256:plan.bundleSha256},
  closure:{status:closure.v006Closure?.status,fixtureStatus:closure.fixtureMatrix?.status},
  references:refs,passedReferenceCount:Object.values(refs).filter(v=>v==="PASS").length,
  R2:{status:refs.R2,independentHumanProvenanceRequired:true,rerunActorAloneInsufficient:true},
  R6:{status:refs.R6,preprovisionCandidate:r6.status,blockers:r6.blockers,
    externalPaidComputeCreated:false},
  finalReadiness:{status:final.status,sealEligible:final.sealEligible,
    blockers:final.blockers,coreLocksAndProviderControlsNotInferredFromSourceClosure:true},
  inventory:"NOT_READ_IN_THIS_RUN",
  cleanup:"NOT_ATTESTED_IN_THIS_RUN",
  resultClass:"SOURCE_BOUND_PARTIAL_LIVE_EVIDENCE",
  horizon2StartAllowed:false
};
await mkdir(resolve(root,"artifacts/ep52/v006/live-references"),{recursive:true});
await writeFile(resolve(root,"artifacts/ep52/v006/live-references/gate-report.json"),JSON.stringify(report,null,2)+"\n");
console.log("V006_GATE_REPORT=PASS_SOURCE_BOUND refs="+report.passedReferenceCount+"/6 R6="+r6.status+" FINAL="+final.status);
