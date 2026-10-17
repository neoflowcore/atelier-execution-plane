import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {createDigitalOceanTeardownApiV1} from '../providers/digitalocean/teardown-api-v1.mjs';
import {runTeardownServiceV1} from '../watchdog/teardown-watchdog/service-v1.mjs';
import {evaluateGithubControllerIsolationV1} from '../watchdog/teardown-watchdog/github-isolation-v1.mjs';
import {selectFixedTeardownLeaseV1} from '../watchdog/teardown-watchdog/recovery-v1.mjs';

const root='artifacts/ep52/r6-independent-controller';
async function save(name,value){await mkdir(root,{recursive:true});const {rename}=await import('node:fs/promises');await writeFile(`${root}/${name}.tmp`,JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(`${root}/${name}.tmp`,`${root}/${name}.json`);}
try{
  const repository=process.env.GITHUB_REPOSITORY,sourceSha=process.env.EP52_SOURCE_SHA,runId=process.env.GITHUB_RUN_ID;
  if(repository!=='neoflowcore/atelier-execution-plane'||!/^[0-9a-f]{40}$/.test(sourceSha??'')||!/^\d+$/.test(runId??'')||process.version!=='v22.13.0'||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==sourceSha)throw Error('CONTROLLER_CONTEXT_REQUIRED');
  const gh=process.env.GH_READ_CREDENTIAL;delete process.env.GH_READ_CREDENTIAL;
  if(typeof gh!=='string'||!gh||/[\r\n]/.test(gh))throw Error('CONTROLLER_GITHUB_AUTH_REQUIRED');
  const request=async path=>{
    if(!/^\/actions\/runs(?:\?[a-z0-9_=&]+|\/[0-9]+(?:\/jobs\?per_page=100)?)$/.test(path))throw Error('CONTROLLER_GITHUB_ENDPOINT_DENIED');
    let r;try{r=await fetch(`https://api.github.com/repos/${repository}${path}`,{method:'GET',redirect:'error',headers:{Authorization:`Bearer ${gh}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(10000)});}catch{throw Error('CONTROLLER_GITHUB_READ_FAILED');}
    if(r.status!==200)throw Error('CONTROLLER_GITHUB_READ_STATUS');return r.json();
  };
  const controllerRun=await request(`/actions/runs/${runId}`);
  let isolation=null;
  for(let attempt=0;attempt<30;attempt++){
    const listed=await request(`/actions/runs?head_sha=${sourceSha}&event=pull_request&per_page=30`);
    const peerRun=listed.workflow_runs?.find(r=>r.id!==Number(runId)&&r.head_sha===sourceSha&&r.path?.split('@')[0]==='.github/workflows/verify.yml');
    if(peerRun){
      const [controllerJobs,peerJobs]=await Promise.all([request(`/actions/runs/${runId}/jobs?per_page=100`),request(`/actions/runs/${peerRun.id}/jobs?per_page=100`)]);
      isolation=evaluateGithubControllerIsolationV1({repository,sourceSha,controllerRun,peerRun,controllerJob:controllerJobs.jobs?.find(j=>j.name==='r6_independent_watchdog'),peerJob:peerJobs.jobs?.find(j=>j.name==='verify')});
      if(isolation.status==='SEPARATE_RUNNER_REFERENCE_PASS')break;
    }
    if(attempt<29)await delay(3000);
  }
  if(isolation?.status!=='SEPARATE_RUNNER_REFERENCE_PASS')throw Error('CONTROLLER_ISOLATION_UNPROVEN');
  await save('isolation',isolation);
  const binding=JSON.parse(await readFile('docs/EP52_V006_PLAN_BINDING_v001.json','utf8'));
  const api=createDigitalOceanTeardownApiV1({token:process.env.ATELIER_R6_DO_TOKEN});delete process.env.ATELIER_R6_DO_TOKEN;
  // This reference has an additional hard read-only boundary, even if a tag
  // collision somehow appears. No DELETE or POST can be sent by this job.
  const provider=Object.freeze({...api,deleteResource:async()=>{throw Error('CONTROLLER_REFERENCE_DELETE_DENIED');}});
  let existingLease;
  try{existingLease=JSON.parse(await readFile(`${root}/lease.json`,'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('CONTROLLER_LEASE_CHECKPOINT_INVALID');}
  const lease=selectFixedTeardownLeaseV1({existingLease,executionId:`r6-reference-${runId}`,leaseId:`controller-${runId}`,sourceSha,planSha256:binding.planSha256,accountUuid:'bd0ac817-54dd-47e5-8a66-73d30e19fc3a',nowMs:Date.now()});
  if(!existingLease)await save('lease',lease);
  const result=await runTeardownServiceV1({lease,provider,cleanupLeadMs:1000,onArmed:async r=>{await save('armed',r);await save('envelope',{schemaId:'EP52_CONTROLLER_ARM_ENVELOPE_V1',referenceOnly:true,providerMutationsAllowed:false,lease,armed:r,isolation});}});
  if(result.status!=='ABSENT_AT_EXPIRY')throw Error('CONTROLLER_REFERENCE_INVENTORY_NOT_EMPTY');
  const receipt={schemaId:'EP52_R6_INDEPENDENT_CONTROLLER_REFERENCE_V1',sourceSha,planSha256:binding.planSha256,nodeVersion:process.version,isolation,teardown:result,classification:'SEPARATE_GITHUB_RUNNER_READ_ONLY_REFERENCE',providerMutations:0,paidCreates:0,deleteCapabilityAttested:false,independentProviderCleanupAttested:false,finalR6Acceptance:false};
  await save('receipt',receipt);console.log(JSON.stringify(receipt));
}catch{
  await save('failure',{schemaId:'EP52_R6_CONTROLLER_REFERENCE_FAILURE_V1',status:'UNRESOLVED',rawDiagnosticsExposed:false,paidCreateAuthorized:false,finalR6Acceptance:false});
  console.error('CONTROLLER_REFERENCE_FAILED');process.exitCode=1;
}
