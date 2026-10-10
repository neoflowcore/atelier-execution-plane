import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstat} from 'node:fs/promises';
import {isIP} from 'node:net';
import {validateWorkerJobV1} from './index.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const remote=`import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const p=JSON.parse(readFileSync(0,'utf8'));
if(createHash('sha256').update(p.workerSource).digest('hex')!==p.workerSourceSha256)throw Error('WORKER_SOURCE_DIGEST_MISMATCH');
if(process.version!==p.nodeVersion)throw Error('WORKER_NODE_VERSION_MISMATCH');
const {runDirectWorkerJobV1}=await import('data:text/javascript;base64,'+Buffer.from(p.workerSource).toString('base64'));
const r=await runDirectWorkerJobV1({job:p.job,cwd:p.cwd,env:{},timeoutMs:p.workerTimeoutMs,maxOutputBytes:p.maxOutputBytes});
process.stdout.write(JSON.stringify({sourceSha:p.sourceSha,planSha256:p.planSha256,workerSourceSha256:p.workerSourceSha256,nodeVersion:process.version,result:r}));`;

// Machine-driven SSH only. Host identity must already be pinned by a trusted
// bootstrap channel. This module never provisions, accepts R6, or disables
// host-key checking. A localhost rehearsal is not remote-provider attestation.
export async function executeSshDirectWorkerV1(input={}){
  const {job,host,port=22,user,privateKeyPath,knownHostsPath,nodePath,cwd,workerSource,workerSourceSha256,sourceSha,planSha256,nodeVersion}=input;
  validateWorkerJobV1(job);
  if(!isIP(host)||!Number.isSafeInteger(port)||port<1||port>65535||!/^[a-z_][a-z0-9_-]*$/.test(user??''))throw Error('SSH_TARGET_REQUIRED');
  if(!/^\/[a-zA-Z0-9_./-]+$/.test(nodePath??'')||!/^\/[a-zA-Z0-9_./-]+$/.test(cwd??''))throw Error('SSH_REMOTE_PATH_REQUIRED');
  if(!/^[0-9a-f]{40}$/.test(sourceSha??'')||!/^[0-9a-f]{64}$/.test(planSha256??'')||job.sourceIdentity.sourceSha!==sourceSha||job.executionPlanHash!==planSha256)throw Error('SSH_SOURCE_PLAN_BINDING_REQUIRED');
  if(typeof workerSource!=='string'||hash(workerSource)!==workerSourceSha256||!/^v[0-9]+\.[0-9]+\.[0-9]+$/.test(nodeVersion??''))throw Error('SSH_WORKER_RUNTIME_BINDING_REQUIRED');
  for(const path of [privateKeyPath,knownHostsPath]){
    if(typeof path!=='string'||!path.startsWith('/')||/[\r\n]/.test(path))throw Error('SSH_CREDENTIAL_FILE_REQUIRED');
    const s=await lstat(path);if(!s.isFile()||(s.mode&0o077)!==0)throw Error('SSH_CREDENTIAL_FILE_UNSAFE');
  }
  const timeoutMs=input.timeoutMs??30000,workerTimeoutMs=input.workerTimeoutMs??10000,maxOutputBytes=input.maxOutputBytes??65536;
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>300000||!Number.isSafeInteger(workerTimeoutMs)||workerTimeoutMs<1||workerTimeoutMs>=timeoutMs||!Number.isSafeInteger(maxOutputBytes)||maxOutputBytes<1024||maxOutputBytes>1048576)throw Error('SSH_EXECUTION_BOUNDS_REQUIRED');
  const payload=JSON.stringify({job,cwd,workerSource,workerSourceSha256,sourceSha,planSha256,nodeVersion,workerTimeoutMs,maxOutputBytes});
  const args=['-T','-F','/dev/null','-p',String(port),'-i',privateKeyPath,'-o',`UserKnownHostsFile=${knownHostsPath}`,'-o','GlobalKnownHostsFile=/dev/null','-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','IdentityAgent=none','-o','PasswordAuthentication=no','-o','KbdInteractiveAuthentication=no','-o','ConnectTimeout=5','-o','ClearAllForwardings=yes','-o','LogLevel=ERROR',`${user}@${host}`,`${nodePath} --input-type=module -e '${remote.replaceAll("'","'\\''")}'`];
  return await new Promise((resolve,reject)=>{
    const child=spawn('/usr/bin/ssh',args,{shell:false,env:{PATH:'/usr/bin:/bin'},stdio:['pipe','pipe','pipe']});
    const chunks=[];let bytes=0,overflow=false,timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},timeoutMs);
    child.stdout.on('data',b=>{bytes+=b.length;if(bytes>maxOutputBytes+8192){overflow=true;child.kill('SIGKILL');}else chunks.push(b);});
    child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});
    child.on('error',()=>{clearTimeout(timer);reject(Error('SSH_PROCESS_FAILED'));});
    child.on('close',code=>{
      clearTimeout(timer);
      if(timedOut||overflow||code!==0){reject(Error(timedOut?'SSH_EXECUTION_TIMEOUT':overflow?'SSH_OUTPUT_LIMIT':'SSH_EXECUTION_FAILED'));return;}
      try{
        const r=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(r.sourceSha!==sourceSha||r.planSha256!==planSha256||r.workerSourceSha256!==workerSourceSha256||r.nodeVersion!==nodeVersion||r.result.executionId!==job.executionId||r.result.attemptId!==job.attemptId||r.result.fenceToken!==job.fenceToken)throw Error();
        resolve({schemaId:'SSH_DIRECT_WORKER_RESULT_V1',...r,status:r.result.exitCode===0&&!r.result.outputLimitExceeded?'PASS':'FAIL',runtimeAccepted:false,finalR6Acceptance:false});
      }catch{reject(Error('SSH_RESULT_BINDING_FAILED'));}
    });
    child.stdin.end(payload);
  });
}
