import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {evaluateControllerReplacementReferenceV1} from '../watchdog/teardown-watchdog/replacement-v1.mjs';
import {createDigitalOceanTeardownApiV1} from '../providers/digitalocean/teardown-api-v1.mjs';
import {runTeardownServiceV1} from '../watchdog/teardown-watchdog/service-v1.mjs';
const root='artifacts/ep52/r6-replacement-controller';
async function save(name,value){await mkdir(root,{recursive:true});await writeFile(`${root}/${name}.json`,JSON.stringify(value,null,2)+'\n',{mode:0o600});}
try{
  const sourceSha=process.env.EP52_SOURCE_SHA,runId=Number(process.env.GITHUB_RUN_ID),repository=process.env.GITHUB_REPOSITORY;
  if(repository!=='neoflowcore/atelier-execution-plane'||!/^[0-9a-f]{40}$/.test(sourceSha??'')||!Number.isSafeInteger(runId)||runId<1||process.version!=='v22.13.0'||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==sourceSha)throw Error('REPLACEMENT_CONTEXT_REQUIRED');
  const lease=JSON.parse(await readFile('artifacts/ep52/r6-replacement-input/lease.json','utf8'));
  const predecessor=JSON.parse(await readFile('artifacts/ep52/r6-replacement-input/receipt.json','utf8'));
  const binding=JSON.parse(await readFile('docs/EP52_V006_PLAN_BINDING_v001.json','utf8'));
  const token=process.env.GH_READ_CREDENTIAL;delete process.env.GH_READ_CREDENTIAL;
  if(!token||/[\r\n]/.test(token))throw Error('REPLACEMENT_READ_AUTH_REQUIRED');
  let response;try{response=await fetch(`https://api.github.com/repos/${repository}/actions/runs/${runId}/jobs?per_page=100`,{method:'GET',redirect:'error',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(10000)});}catch{throw Error('REPLACEMENT_JOB_READ_FAILED');}
  if(response.status!==200)throw Error('REPLACEMENT_JOB_READ_STATUS');
  const jobs=(await response.json()).jobs;
  const pre=evaluateControllerReplacementReferenceV1({lease,predecessor,sourceSha,planSha256:binding.planSha256,runId,originalJob:jobs?.find(j=>j.name==='r6_independent_watchdog'),replacementJob:jobs?.find(j=>j.name==='r6_replacement_controller'),nowMs:Date.now()});
  if(pre.status!=='RESTORE_REFERENCE_READY')throw Error('REPLACEMENT_PREFLIGHT_BLOCKED');
  const api=createDigitalOceanTeardownApiV1({token:process.env.ATELIER_R6_DO_TOKEN});delete process.env.ATELIER_R6_DO_TOKEN;
  const provider=Object.freeze({...api,deleteResource:async()=>{throw Error('REPLACEMENT_REFERENCE_DELETE_DENIED');}});
  const result=await runTeardownServiceV1({lease,provider,cleanupLeadMs:1000,onArmed:r=>save('restored-arm',r)});
  if(result.status!=='ABSENT_AT_EXPIRY'||result.leaseDigest!==pre.leaseDigest||result.expiresAtMs!==pre.originalExpiresAtMs)throw Error('REPLACEMENT_RECONCILIATION_FAILED');
  const receipt={schemaId:'EP52_CONTROLLER_REPLACEMENT_REFERENCE_V1',status:'DIFFERENT_RUNNER_EXPIRED_LEASE_RECONCILIATION_PASS',preflight:pre,teardown:result,sourceSha,planSha256:binding.planSha256,originalExpiresAtMs:lease.expiresAtMs,restoredExpiresAtMs:result.expiresAtMs,leaseClockExtended:false,unexpectedHostLossInjected:false,platformOutageSurvivalAttested:false,providerMutations:0,paidCreates:0,finalR6Acceptance:false};
  await save('receipt',receipt);console.log(JSON.stringify(receipt));
}catch{await save('failure',{status:'BLOCKED',rawDiagnosticsExposed:false,paidCreateAuthorized:false,finalR6Acceptance:false});console.error('CONTROLLER_REPLACEMENT_REFERENCE_FAILED');process.exitCode=1;}
