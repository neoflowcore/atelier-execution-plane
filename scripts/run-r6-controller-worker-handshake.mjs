import {readFile,mkdir,writeFile,appendFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {observeControllerWorkerHandshakeV1} from '../watchdog/teardown-watchdog/handshake-v1.mjs';
const root='artifacts/ep52/r6-worker-handshake';
try{
  const repository=process.env.GITHUB_REPOSITORY,sourceSha=process.env.EP52_SOURCE_SHA,workerRunId=process.env.GITHUB_RUN_ID;
  if(repository!=='neoflowcore/atelier-execution-plane'||!/^[0-9a-f]{40}$/.test(sourceSha??'')||!/^\d+$/.test(workerRunId??'')||process.version!=='v22.13.0'||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==sourceSha)throw Error('HANDSHAKE_CONTEXT_REQUIRED');
  const token=process.env.GH_READ_CREDENTIAL;delete process.env.GH_READ_CREDENTIAL;
  if(!token||/[\r\n]/.test(token))throw Error('HANDSHAKE_READ_AUTH_REQUIRED');
  const get=async path=>{
    if(!/^\/actions\/runs(?:\?[a-z0-9_=&]+|\/[0-9]+(?:\/(?:jobs|artifacts)\?per_page=100)?)$/.test(path))throw Error('HANDSHAKE_ENDPOINT_DENIED');
    let r;try{r=await fetch(`https://api.github.com/repos/${repository}${path}`,{method:'GET',redirect:'error',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(10000)});}catch{throw Error('HANDSHAKE_READ_FAILED');}
    if(r.status!==200)throw Error('HANDSHAKE_READ_STATUS');return r.json();
  };
  if(process.argv[2]==='resolve'){
    for(let attempt=0;attempt<30;attempt++){
      const b=await get(`/actions/runs?head_sha=${sourceSha}&event=pull_request&per_page=30`);
      const run=b.workflow_runs?.find(r=>r.head_sha===sourceSha&&r.path?.split('@')[0]==='.github/workflows/r6-watchdog.yml'&&r.status==='in_progress'&&r.repository?.full_name===repository&&r.head_branch==='ep52-h1-recovery');
      if(run){
        const name=`ep52-r6-armed-${sourceSha}-${run.id}`;
        const [a,j]=await Promise.all([get(`/actions/runs/${run.id}/artifacts?per_page=100`),get(`/actions/runs/${run.id}/jobs?per_page=100`)]);
        const artifact=a.artifacts?.find(x=>x.name===name&&x.expired===false&&x.workflow_run?.head_sha===sourceSha);
        const job=j.jobs?.find(x=>x.name==='r6_independent_watchdog');
        if(artifact&&job?.status==='in_progress'&&job.steps?.some(s=>s.name==='Wait for controller monitoring result'&&s.status==='in_progress')){
          if(!Number.isSafeInteger(run.id)||!Number.isSafeInteger(artifact.id)||!process.env.GITHUB_OUTPUT)throw Error('HANDSHAKE_OUTPUT_BINDING_REQUIRED');
          await appendFile(process.env.GITHUB_OUTPUT,`controller_run_id=${run.id}\narmed_artifact_name=${name}\narmed_artifact_id=${artifact.id}\n`);
          console.log('LIVE_CONTROLLER_ARM_ARTIFACT_RESOLVED');process.exit(0);
        }
      }
      if(attempt<29)await delay(3000);
    }throw Error('HANDSHAKE_ACTIVE_CONTROLLER_NOT_FOUND');
  }
  if(process.argv[2]!=='verify'||!/^\d+$/.test(process.env.CONTROLLER_RUN_ID??''))throw Error('HANDSHAKE_MODE_REQUIRED');
  const controllerRunId=process.env.CONTROLLER_RUN_ID;
  const envelope=JSON.parse(await readFile('artifacts/ep52/r6-handshake-input/envelope.json','utf8'));
  const binding=JSON.parse(await readFile('docs/EP52_V006_PLAN_BINDING_v001.json','utf8'));
  const result=await observeControllerWorkerHandshakeV1({wait:delay,observe:async()=>{
  const [controllerRun,controllerJobs,workerRun,workerJobs]=await Promise.all([get(`/actions/runs/${controllerRunId}`),get(`/actions/runs/${controllerRunId}/jobs?per_page=100`),get(`/actions/runs/${workerRunId}`),get(`/actions/runs/${workerRunId}/jobs?per_page=100`)]);
  if(controllerRun.path?.split('@')[0]!=='.github/workflows/r6-watchdog.yml'||workerRun.path?.split('@')[0]!=='.github/workflows/verify.yml'||[controllerRun,workerRun].some(r=>r.event!=='pull_request'||r.head_branch!=='ep52-h1-recovery'))throw Error('HANDSHAKE_RUN_ORIGIN_MISMATCH');
  const c=controllerJobs.jobs?.find(j=>j.name==='r6_independent_watchdog'),w=workerJobs.jobs?.find(j=>j.name==='r6_controller_worker_handshake');
  return {envelope,sourceSha,planSha256:binding.planSha256,nowMs:Date.now(),controllerState:{sourceSha:controllerRun.head_sha,repository:controllerRun.repository?.full_name,runId:controllerRun.id,status:controllerRun.status,jobStatus:c?.status,runnerId:c?.runner_id,monitorStepRunning:c?.steps?.some(s=>s.name==='Wait for controller monitoring result'&&s.status==='in_progress')},workerState:{sourceSha:workerRun.head_sha,repository:workerRun.repository?.full_name,runId:workerRun.id,status:workerRun.status,jobStatus:w?.status,runnerId:w?.runner_id}};
  }});
  await mkdir(root,{recursive:true});await writeFile(`${root}/receipt.json`,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify(result));if(result.status!=='LIVE_REFERENCE_HANDSHAKE_PASS')process.exitCode=1;
}catch{
  await mkdir(root,{recursive:true});await writeFile(`${root}/failure.json`,JSON.stringify({status:'BLOCKED',rawDiagnosticsExposed:false,paidCreateAuthorized:false,finalR6Acceptance:false})+'\n',{mode:0o600});
  console.error('CONTROLLER_WORKER_HANDSHAKE_FAILED');process.exitCode=1;
}
