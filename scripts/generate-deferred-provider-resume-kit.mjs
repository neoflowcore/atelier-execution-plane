#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { compileDeferredProviderAttachTicketV1 } from "../providers/deferred-reattach-v1.mjs";

const exec=promisify(execFile);
const head=(await exec("git",["rev-parse","HEAD"],{encoding:"utf8"})).stdout.trim();
const tree=(await exec("git",["rev-parse","HEAD^{tree}"],{encoding:"utf8"})).stdout.trim();
const branch=process.env.GITHUB_HEAD_REF||process.env.GITHUB_REF_NAME||"ep52-h1-recovery";
const vmware=compileDeferredProviderAttachTicketV1({provider:"VMWARE",branch,sourceHead:head,sourceTree:tree});
const digitalocean=compileDeferredProviderAttachTicketV1({provider:"DIGITALOCEAN",branch,sourceHead:head,sourceTree:tree});
const body={
  schemaId:"EP52_DEFERRED_PROVIDER_RESUME_KIT_V1",
  sourceHead:head,
  sourceTree:tree,
  branch,
  createdFor:["VMWARE","DIGITALOCEAN"],
  vmware,
  digitalocean,
  resumeWithoutSourceRediscovery:true,
  finalSealStillRequiresRealLiveEvidence:true
};
await mkdir("artifacts/ep52/deferred-provider",{recursive:true});
await writeFile("artifacts/ep52/deferred-provider/resume-kit.json",JSON.stringify(body,null,2)+"\n");
console.log(`EP52_DEFERRED_PROVIDER_RESUME_KIT=PASS head=${head}`);
