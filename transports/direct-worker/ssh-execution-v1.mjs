import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstat,readFile} from 'node:fs/promises';
import {isIP} from 'node:net';
import {validateWorkerJobV1} from './index.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
export async function stageSshWorkerRuntimeV1(input={}){
  const {host,port=22,user,privateKeyPath,knownHostsPath,runtimePath,runtimeSha256,remoteDirectory}=input;
  if(!isIP(host)||!Number.isSafeInteger(port)||port<1||port>65535||!/^[a-z_][a-z0-9_-]*$/.test(user??'')||!/^\/[a-zA-Z0-9_./-]+$/.test(remoteDirectory??'')||!/^[0-9a-f]{64}$/.test(runtimeSha256??''))throw Error('SSH_RUNTIME_STAGE_BINDING_REQUIRED');
  for(const path of [privateKeyPath,knownHostsPath]){
    if(typeof path!=='string'||!path.startsWith('/')||/[\r\n]/.test(path))throw Error('SSH_CREDENTIAL_FILE_REQUIRED');
    const s=await lstat(path);if(!s.isFile()||(s.mode&0o077)!==0)throw Error('SSH_CREDENTIAL_FILE_UNSAFE');
  }
  const runtimeStat=await lstat(runtimePath);
  if(!runtimeStat.isFile()||runtimeStat.size>268435456)throw Error('SSH_RUNTIME_STAGE_SIZE_DENIED');
  const binary=await readFile(runtimePath);if(hash(binary)!==runtimeSha256)throw Error('SSH_RUNTIME_STAGE_DIGEST_MISMATCH');
  const nodePath=`${remoteDirectory}/worker-node`;
  const command=`umask 077; cat > ${nodePath}.upload && test "$(sha256sum ${nodePath}.upload | cut -d ' ' -f 1)" = ${runtimeSha256} && chmod 700 ${nodePath}.upload && mv ${nodePath}.upload ${nodePath} && sha256sum ${nodePath}`;
  const args=['-T','-F','/dev/null','-p',String(port),'-i',privateKeyPath,'-o',`UserKnownHostsFile=${knownHostsPath}`,'-o','GlobalKnownHostsFile=/dev/null','-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','IdentityAgent=none','-o','PasswordAuthentication=no','-o','KbdInteractiveAuthentication=no','-o','ConnectTimeout=5','-o','ClearAllForwardings=yes','-o','LogLevel=ERROR',`${user}@${host}`,command];
  await new Promise((resolve,reject)=>{
    const child=spawn('/usr/bin/ssh',args,{shell:false,env:{PATH:'/usr/bin:/bin'},stdio:['pipe','pipe','pipe']});let output='';
    const timer=setTimeout(()=>child.kill('SIGKILL'),60000);
    child.stdout.on('data',b=>{if(output.length<1024)output+=b.toString('utf8').slice(0,1024-output.length);});child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});
    child.on('error',()=>{clearTimeout(timer);reject(Error('SSH_RUNTIME_STAGE_FAILED'));});
    child.on('close',code=>{clearTimeout(timer);if(code!==0||output.trim().split(/\s+/)[0]!==runtimeSha256)reject(Error('SSH_RUNTIME_STAGE_FAILED'));else resolve();});
    child.stdin.end(binary);
  });
  return {schemaId:'SSH_WORKER_RUNTIME_STAGE_V1',nodePath,runtimeSha256,transfer:'PASS',providerMutations:0,runtimeAccepted:false};
}
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
    const chunks=[];let bytes=0,overflow=false,timedOut=false,stderr='';
    const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},timeoutMs);
    child.stdout.on('data',b=>{bytes+=b.length;if(bytes>maxOutputBytes+8192){overflow=true;child.kill('SIGKILL');}else chunks.push(b);});
    child.stderr.on('data',b=>{if(stderr.length<8192)stderr+=b.toString('utf8').slice(0,8192-stderr.length);});child.stdin.on('error',()=>{});
    child.on('error',()=>{clearTimeout(timer);reject(Error('SSH_PROCESS_FAILED'));});
    child.on('close',code=>{
      clearTimeout(timer);
      if(timedOut||overflow||code!==0){
        const diagnostic=/Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/.test(stderr)?'SSH_HOST_KEY_REJECTED':
          /Permission denied/.test(stderr)?'SSH_AUTHENTICATION_FAILED':
          /WORKER_NODE_VERSION_MISMATCH/.test(stderr)?'SSH_WORKER_NODE_VERSION_MISMATCH':
          /WORKER_SOURCE_DIGEST_MISMATCH/.test(stderr)?'SSH_WORKER_SOURCE_DIGEST_MISMATCH':
          /not found|No such file/.test(stderr)?'SSH_REMOTE_RUNTIME_UNAVAILABLE':
          /Connection refused|Connection reset|Connection closed/.test(stderr)?'SSH_CONNECTION_FAILED':'SSH_EXECUTION_FAILED';
        reject(Error(timedOut?'SSH_EXECUTION_TIMEOUT':overflow?'SSH_OUTPUT_LIMIT':diagnostic));return;
      }
      try{
        const r=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(r.sourceSha!==sourceSha||r.planSha256!==planSha256||r.workerSourceSha256!==workerSourceSha256||r.nodeVersion!==nodeVersion||r.result.executionId!==job.executionId||r.result.attemptId!==job.attemptId||r.result.fenceToken!==job.fenceToken)throw Error();
        resolve({schemaId:'SSH_DIRECT_WORKER_RESULT_V1',...r,status:r.result.exitCode===0&&!r.result.outputLimitExceeded?'PASS':'FAIL',runtimeAccepted:false,finalR6Acceptance:false});
      }catch{reject(Error('SSH_RESULT_BINDING_FAILED'));}
    });
    child.stdin.end(payload);
  });
}
