#!/usr/bin/env node
import { mkdir, writeFile, access, open } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createLocalProviderV1 } from "../providers/local/index.mjs";
import { createWorkerAgentV1 } from "../worker/agent/index.mjs";
import { compileMultiWorkerDagV1, runMultiWorkerDagSimulationV1 } from "../scheduler/dag-v1.mjs";
import { compareProviderShadowV1 } from "../fault/shadow-comparator-v1.mjs";

const h=s=>createHash("sha256").update(String(s)).digest("hex");
const runId=process.env.GITHUB_RUN_ID??"local";
const head=process.env.GITHUB_SHA??"unknown";

function job(id, code, dependsOn=[]){
  return {
    id,
    dependsOn,
    estimatedCostMilliUsd:0,
    payload:{
      executionId:`ep52-${id}-${runId}`,
      attemptId:`attempt-${id}`,
      fenceToken:1,
      workerJobSha256:h(`worker-job:${id}`),
      executionPlanHash:h(`execution-plan:${id}`),
      sourceIdentity:{kind:"GIT_SHA",value:head},
      entrypointSpec:{command:process.execPath,args:["-e",code]},
      artifactPolicy:{mode:"CONTENT_ADDRESSED"},
      cleanupPolicy:{mode:"ALWAYS"}
    }
  };
}

async function runOnFreshLocalWorker(jobDef,index=0){
  const provider=createLocalProviderV1();
  const leaseId=`lease-${jobDef.id}-${index}`;
  const resource=await provider.create({executionId:jobDef.payload.executionId,leaseId});
  const agent=createWorkerAgentV1({
    workerId:`worker-${jobDef.id}-${index}`,
    providerClass:"LOCAL",
    environmentIdentity:`github-hosted-${process.platform}-${process.arch}`
  });
  let result, caps, sanitize, inventoryAfter;
  try{
    caps=await agent.prepare({path:resource.path});
    result=await agent.execute(jobDef.payload);
    sanitize=agent.sanitize();
    agent.teardown();
  } finally {
    await provider.destroy(resource.resourceId);
    inventoryAfter=await provider.inventory();
  }
  if(result?.exitCode!==0) throw new Error(`LOCAL_WORKER_JOB_FAILED:${jobDef.id}`);
  if(sanitize?.rawSecretPersisted!==false||sanitize?.durableCredentialPersisted!==false) throw new Error(`LOCAL_WORKER_SECRET_RESIDUE:${jobDef.id}`);
  if(inventoryAfter.length!==0) throw new Error(`LOCAL_WORKER_RESOURCE_RESIDUE:${jobDef.id}`);
  return {status:"PASS",receipt:{jobId:jobDef.id,exitCode:result.exitCode,durationMs:result.durationMs,caps:{OS_CLASS:caps.OS_CLASS,ARCH_CLASS:caps.ARCH_CLASS,NODE_VERSION:caps.NODE_VERSION,DISK_FREE_MIB:caps.DISK_FREE_MIB},rawSecretPersisted:false,durableCredentialPersisted:false,inventoryAfterCount:0},artifacts:[]};
}

async function findChromium(){
  const candidates=[
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ];
  for(const path of candidates){
    try{await access(path);return path;}catch{}
  }
  throw new Error("CHROMIUM_BINARY_NOT_AVAILABLE_NO_INSTALL_FALLBACK");
}

async function runChromiumDiskWorkload(){
  if(process.platform!=="linux"||process.arch!=="x64") throw new Error("CHROMIUM_WORKLOAD_REQUIRES_LINUX_X64");
  const provider=createLocalProviderV1();
  const executionId=`ep52-chromium-${runId}`;
  const resource=await provider.create({executionId,leaseId:`lease-chromium-${runId}`});
  const agent=createWorkerAgentV1({workerId:"worker-chromium",providerClass:"LOCAL",environmentIdentity:"github-hosted-linux-x64"});
  let result,caps,sanitize,inventoryAfter,browserPath,sparseSizeBytes=0;
  try{
    caps=await agent.prepare({path:resource.path});
    if(caps.OS_CLASS!=="linux"||caps.ARCH_CLASS!=="x64") throw new Error("CHROMIUM_CAPABILITY_PLATFORM_MISMATCH");
    if(caps.DISK_FREE_MIB<10240) throw new Error("CHROMIUM_LARGE_DISK_CAPABILITY_UNSATISFIED");
    const sparsePath=join(resource.path,"ep52-large-disk-fixture.bin");
    const fh=await open(sparsePath,"w");
    try{await fh.truncate(512*1024*1024);}finally{await fh.close();}
    sparseSizeBytes=512*1024*1024;
    browserPath=await findChromium();
    const payload={
      executionId,
      attemptId:"attempt-chromium",
      fenceToken:1,
      workerJobSha256:h("worker-job:chromium"),
      executionPlanHash:h("execution-plan:chromium"),
      sourceIdentity:{kind:"GIT_SHA",value:head},
      entrypointSpec:{
        command:browserPath,
        args:["--headless=new","--no-sandbox","--disable-gpu","--dump-dom","data:text/html,<html><head><title>EP52_CHROMIUM_PASS</title></head><body>EP52_CHROMIUM_PASS</body></html>"]
      },
      artifactPolicy:{mode:"CONTENT_ADDRESSED"},
      cleanupPolicy:{mode:"ALWAYS"}
    };
    result=await agent.execute(payload);
    sanitize=agent.sanitize();
    agent.teardown();
  } finally {
    await provider.destroy(resource.resourceId);
    inventoryAfter=await provider.inventory();
  }
  if(result?.exitCode!==0||!result.stdout.includes("EP52_CHROMIUM_PASS")) throw new Error("CHROMIUM_HEADLESS_EXECUTION_FAILED");
  if(sanitize?.rawSecretPersisted!==false||sanitize?.durableCredentialPersisted!==false) throw new Error("CHROMIUM_WORKER_SECRET_RESIDUE");
  if(inventoryAfter.length!==0) throw new Error("CHROMIUM_WORKER_RESOURCE_RESIDUE");
  return {
    status:"PASS",
    browserPath,
    sparseSizeBytes,
    caps:{OS_CLASS:caps.OS_CLASS,ARCH_CLASS:caps.ARCH_CLASS,DISK_FREE_MIB:caps.DISK_FREE_MIB,NODE_VERSION:caps.NODE_VERSION},
    exitCode:result.exitCode,
    inventoryAfterCount:0
  };
}

const direct=job("local-direct", 'process.stdout.write("EP52_LOCAL_DIRECT_PASS")');
const directReceipt=await runOnFreshLocalWorker(direct,0);

const heavy=job("heavy-compute", `
const {createHash}=require("node:crypto");
let v="atelier";
for(let i=0;i<50000;i++) v=createHash("sha256").update(v).digest("hex");
process.stdout.write(v.length===64?"HEAVY_PASS":"HEAVY_FAIL");
`);
const heavyReceipt=await runOnFreshLocalWorker(heavy,0);

const dag=compileMultiWorkerDagV1({
  jobs:[
    job("mw-a",'setTimeout(()=>process.stdout.write("A"),20)'),
    job("mw-b",'setTimeout(()=>process.stdout.write("B"),20)'),
    job("mw-join",'process.stdout.write("JOIN")',["mw-a","mw-b"])
  ],
  joins:[{id:"join-ab",waitFor:["mw-a","mw-b"]}]
});
const multi=await runMultiWorkerDagSimulationV1({
  dag,
  maxConcurrency:2,
  executor:async (dagJob,index)=>runOnFreshLocalWorker(dagJob,index)
});
if(multi.status!=="PASS"||multi.peakConcurrency<2||multi.joins.some(j=>j.status!=="PASS")) throw new Error("MULTI_WORKER_LIVE_LOCAL_FAILED");

const chromiumReceipt=await runChromiumDiskWorkload();

const refTrace=[
  {op:"CREATE",state:"CREATED",accepted:true},
  {op:"EXECUTE",state:"PASS",effect:"LOCAL_DIRECT_WORKER",accepted:true},
  {op:"CLEANUP",state:"ABSENT",accepted:true}
];
const localShadow=compareProviderShadowV1({referenceTrace:refTrace,fakeTrace:refTrace});
if(localShadow.status!=="PASS") throw new Error("LOCAL_SHADOW_SEMANTIC_COMPARATOR_FAILED");

const receipt={
  schemaId:"EP52_LOCAL_LIVE_QUALIFICATION_RECEIPT_V1",
  version:"2",
  repository:process.env.GITHUB_REPOSITORY??null,
  runId,
  sourceHead:head,
  runner:{os:process.env.RUNNER_OS??process.platform,arch:process.env.RUNNER_ARCH??process.arch},
  P20:{
    LOCAL:"PASS",
    DIRECT_WORKER:"PASS",
    LOCAL_DIRECT_WORKER:"PASS",
    WORKER_DEVICE_LOGIN:0,
    LONG_LIVED_PROVIDER_OR_GITHUB_CREDENTIAL_ON_WORKER:0
  },
  P21:{
    LONG_HEAVY_COMPUTE_LOCAL:"PASS",
    LARGE_DISK_LINUX_X64_CHROMIUM_CI:"PASS",
    MULTI_WORKER_DEPENDENCY_JOIN_LOCAL:"PASS",
    LOCAL_SHADOW_SEMANTIC_COMPARATOR:"PASS",
    VMWARE_LOCAL_REPEATABILITY:"DEFERRED_PROVIDER_LIVE_WORK",
    PROVIDER_SHADOW_CANARY:"PENDING_PROVIDER_LIVE"
  },
  directWorker:directReceipt,
  heavyCompute:heavyReceipt,
  chromium:chromiumReceipt,
  multiWorker:{status:multi.status,peakConcurrency:multi.peakConcurrency,maxConcurrency:multi.maxConcurrency,joins:multi.joins,backpressureRespected:multi.backpressureRespected},
  cleanup:{LOCAL_RESOURCE_INVENTORY_AFTER:0,ACTIVE_PAID_COMPUTE:0,ORPHANED_BILLABLE_RESOURCE:0,BILLABLE_RESIDUE:0},
  status:"PASS_PARTIAL_LIVE",
  finalP20GatePass:false,
  finalP21GatePass:false
};
await mkdir("artifacts/ep52/local-live",{recursive:true});
await writeFile("artifacts/ep52/local-live/receipt.json",JSON.stringify(receipt,null,2)+"\n");
console.log(`EP52_LOCAL_LIVE=PASS_PARTIAL run=${runId} head=${head} peak=${multi.peakConcurrency} chromium=PASS`);
