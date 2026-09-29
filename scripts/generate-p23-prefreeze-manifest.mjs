#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile,mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { EP52_FREEZE_COMPONENT_PATHS } from "../seal/interface-freeze-input-v1.mjs";
const exec=promisify(execFile);
const sha=v=>createHash("sha256").update(JSON.stringify(v),"utf8").digest("hex");
const componentDigests={}; const sourcePaths={};
for(const [name,path] of Object.entries(EP52_FREEZE_COMPONENT_PATHS)){
  const {stdout}=await exec("git",["rev-parse",`HEAD:${path}`],{encoding:"utf8"});
  const blob=stdout.trim();
  if(!/^[0-9a-f]{40}$/.test(blob)) throw new Error(`P23_BLOB_IDENTITY_INVALID:${path}`);
  componentDigests[name]=sha({path,blob}); sourcePaths[name]={path,blob};
}
const head=(await exec("git",["rev-parse","HEAD"],{encoding:"utf8"})).stdout.trim();
const tree=(await exec("git",["rev-parse","HEAD^{tree}"],{encoding:"utf8"})).stdout.trim();
const body={
  schemaId:"EP52_P23_PRE_FREEZE_SOURCE_MANIFEST_V1",
  status:"PREPARED_NOT_FINAL",
  sourceHead:head,
  sourceTree:tree,
  componentDigests,
  sourcePaths,
  runtimeHandoffDigest:"eb122a65afc92d589b1af2eb923167cd47d144e1105669493b117249beefcbf8",
  liveQualificationStatus:"PENDING",
  finalFreezeEligible:false
};
await mkdir("docs",{recursive:true});
await writeFile("docs/EP52_P23_PRE_FREEZE_SOURCE_MANIFEST_v001.json",JSON.stringify(body,null,2)+"\n");
console.log(`EP52_P23_PRE_FREEZE_SOURCE_MANIFEST=PASS components=${Object.keys(componentDigests).length}`);
