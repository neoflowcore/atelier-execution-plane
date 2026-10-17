#!/usr/bin/env node
import {readFile,mkdir,writeFile,appendFile} from "node:fs/promises";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
const exec=promisify(execFile);
const anchor=JSON.parse(await readFile(new URL("../docs/EP52_LOCAL_LIVE_EVIDENCE_ANCHOR_v001.json",import.meta.url),"utf8"));
const reasons=[];
if(process.version!==`v${anchor.runnerContract.nodeVersion}`) reasons.push("NODE_VERSION_CHANGED");
if((process.env.RUNNER_OS??"Linux")!=="Linux") reasons.push("RUNNER_OS_CHANGED");
if((process.env.RUNNER_ARCH??"X64")!=="X64") reasons.push("RUNNER_ARCH_CHANGED");
for(const [path,expected] of Object.entries(anchor.inputBlobs)){
  try{
    const actual=(await exec("git",["rev-parse",`HEAD:${path}`],{encoding:"utf8"})).stdout.trim();
    if(actual!==expected) reasons.push(`INPUT_BLOB_CHANGED:${path}`);
  }catch{reasons.push(`INPUT_BLOB_UNREADABLE:${path}`);}
}
const anchorTime=Date.parse("2026-10-01T01:56:20Z");
const now=Date.now();
const maxAgeMs=anchor.runnerContract.maxEvidenceAgeDays*24*60*60*1000;
if(!Number.isFinite(anchorTime)||now-anchorTime>maxAgeMs) reasons.push("ANCHOR_TOO_OLD");
const reusable=reasons.length===0;
const head=(await exec("git",["rev-parse","HEAD"],{encoding:"utf8"})).stdout.trim();
const tree=(await exec("git",["rev-parse","HEAD^{tree}"],{encoding:"utf8"})).stdout.trim();
const receipt={
  schemaId:"EP52_LOCAL_LIVE_EVIDENCE_REUSE_RECEIPT_V1",
  reusable,
  reasons,
  currentSourceHead:head,
  currentSourceTree:tree,
  anchorSourceHead:anchor.sourceHead,
  anchorRunId:anchor.runId,
  anchorArtifactId:anchor.artifactId,
  anchorArtifactDigest:anchor.artifactDigest,
  runnerContract:anchor.runnerContract,
  evidence:anchor.evidence,
  decision:reusable?"REUSE_CANONICAL_LOCAL_LIVE_EVIDENCE":"RERUN_LOCAL_LIVE_REQUIRED"
};
await mkdir("artifacts/ep52/local-live-reuse",{recursive:true});
await writeFile("artifacts/ep52/local-live-reuse/receipt.json",JSON.stringify(receipt,null,2)+"\n");
if(process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT,`run_live=${reusable?"false":"true"}\nreuse_live=${reusable?"true":"false"}\n`);
console.log(`EP52_LOCAL_LIVE_EVIDENCE_REUSE=${reusable?"PASS_REUSE":"RERUN_REQUIRED"} reasons=${reasons.join(",")||"NONE"}`);
