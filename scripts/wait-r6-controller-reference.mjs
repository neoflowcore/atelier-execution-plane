import {readFile,writeFile,open,rename} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {selectFixedTeardownLeaseV1} from '../watchdog/teardown-watchdog/recovery-v1.mjs';
const root='artifacts/ep52/r6-independent-controller',program='scripts/run-r6-independent-controller-reference.mjs';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const envKeys=['PATH','GITHUB_REPOSITORY','EP52_SOURCE_SHA','GITHUB_RUN_ID','GH_READ_CREDENTIAL','ATELIER_R6_DO_TOKEN','RUNNER_TRACKING_ID'];
async function alive(pid){
  try{const args=(await readFile(`/proc/${pid}/cmdline`,'utf8')).split('\0');if(args[0]!==process.execPath||args[1]!==program)return false;process.kill(pid,0);return true;}catch{return false;}
}
let child;
try{
  let pid=Number(await readFile(`${root}/controller.pid`,'utf8'));
  if(!Number.isSafeInteger(pid)||pid<1)throw Error('PID_REQUIRED');
  const initialEnvelope=JSON.parse(await readFile(`${root}/envelope.json`,'utf8'));
  const checkpoint=JSON.parse(await readFile(`${root}/lease.json`,'utf8'));
  const original=selectFixedTeardownLeaseV1({existingLease:checkpoint,executionId:`r6-reference-${process.env.GITHUB_RUN_ID}`,leaseId:`controller-${process.env.GITHUB_RUN_ID}`,sourceSha:process.env.EP52_SOURCE_SHA,planSha256:initialEnvelope.lease.planSha256,accountUuid:'bd0ac817-54dd-47e5-8a66-73d30e19fc3a',nowMs:Date.now()});
  if(digest(original)!==initialEnvelope.armed.leaseDigest)throw Error('RECOVERY_LEASE_DIGEST_MISMATCH');
  const fault=process.env.EP52_REFERENCE_KILL_CONTROLLER==='true';
  if(fault){if(!await alive(pid))throw Error('FAULT_TARGET_NOT_OWNED');process.kill(pid,'SIGKILL');await delay(250);}
  let restarts=0,result;
  for(let attempt=0;attempt<180;attempt++){
    try{result=JSON.parse(await readFile(`${root}/receipt.json`,'utf8'));break;}catch(e){if(e.code!=='ENOENT')throw e;}
    if(!await alive(pid)){
      if(restarts>=1)throw Error('RECOVERY_RETRY_EXHAUSTED');
      const unchanged=JSON.parse(await readFile(`${root}/lease.json`,'utf8'));
      if(digest(unchanged)!==digest(original))throw Error('RECOVERY_CHECKPOINT_CHANGED');
      const log=await open(`${root}/controller.log`,'a',0o600);
      const env=Object.fromEntries(envKeys.filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]]));
      child=spawn(process.execPath,[program],{env,stdio:['ignore',log.fd,log.fd]});child.on('error',()=>{});
      await log.close();pid=child.pid;if(!Number.isSafeInteger(pid))throw Error('RECOVERY_SPAWN_FAILED');
      await writeFile(`${root}/controller.pid`,String(pid),{mode:0o600});restarts++;
    }
    await delay(1000);
  }
  if(result?.sourceSha!==process.env.EP52_SOURCE_SHA||result?.teardown?.status!=='ABSENT_AT_EXPIRY'||result.providerMutations!==0||result.paidCreates!==0||result.teardown.leaseDigest!==digest(original)||result.teardown.expiresAtMs!==original.expiresAtMs||fault&&restarts!==1)throw Error('CONTROLLER_RECOVERED_RESULT_REQUIRED');
  const recovery={schemaId:'EP52_CONTROLLER_RECOVERY_REFERENCE_V1',sourceSha:original.sourceSha,planSha256:original.planSha256,leaseDigest:digest(original),restartCount:restarts,fault:'SIGKILL_CONTROLLER_PROCESS',faultInjected:fault,originalExpiresAtMs:original.expiresAtMs,recoveredExpiresAtMs:result.teardown.expiresAtMs,leaseClockExtended:false,status:fault?'SAME_HOST_PROCESS_RECOVERY_PASS':'NO_RESTART_REQUIRED',controllerHostLossSurvivalAttested:false,paidCreateAuthorized:false,finalR6Acceptance:false};
  await writeFile(`${root}/recovery.tmp`,JSON.stringify(recovery,null,2)+'\n',{mode:0o600});await rename(`${root}/recovery.tmp`,`${root}/recovery.json`);
  child?.unref();console.log(JSON.stringify(recovery));
}catch{child?.kill('SIGTERM');console.error('CONTROLLER_MONITOR_RECOVERY_FAILED');process.exitCode=1;}
