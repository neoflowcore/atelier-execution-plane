import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm,symlink} from 'node:fs/promises';
import {executeSshDirectWorkerV1} from '../transports/direct-worker/ssh-execution-v1.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const planSha256='b'.repeat(64),sourceSha='a'.repeat(40),workerSource='fixture';
const job={executionId:'test',attemptId:'attempt',fenceToken:1,workerJobSha256:'c'.repeat(64),executionPlanHash:planSha256,sourceIdentity:{sourceSha},entrypointSpec:{command:'node'},artifactPolicy:{},cleanupPolicy:{}};
const base={job,host:'127.0.0.1',user:'root',nodePath:'/usr/bin/node',cwd:'/tmp',workerSource,workerSourceSha256:hash(workerSource),sourceSha,planSha256,nodeVersion:'v22.13.0'};
test('automated SSH refuses shell injection targets and remote paths before connection',async()=>{
  for(const patch of [{host:'-oProxyCommand=evil'},{user:'root;evil'},{port:0},{nodePath:'/usr/bin/node;evil'},{cwd:'/tmp\ncommand'}])await assert.rejects(executeSshDirectWorkerV1({...base,...patch}),/SSH_TARGET_REQUIRED|SSH_REMOTE_PATH_REQUIRED/);
});
test('automated SSH refuses source plan and worker content mismatches',async()=>{
  for(const patch of [{sourceSha:'d'.repeat(40)},{planSha256:'e'.repeat(64)},{workerSource:'changed'},{nodeVersion:'latest'}])await assert.rejects(executeSshDirectWorkerV1({...base,...patch}),/SSH_SOURCE_PLAN_BINDING_REQUIRED|SSH_WORKER_RUNTIME_BINDING_REQUIRED/);
});
test('automated SSH requires private regular credential files and bounded execution',async()=>{
  const dir=await mkdtemp('/tmp/atelier-ssh-unit-');
  try{
    const key=`${dir}/key`,known=`${dir}/known`,link=`${dir}/link`;
    await writeFile(key,'fixture',{mode:0o644});await writeFile(known,'fixture',{mode:0o600});
    await assert.rejects(executeSshDirectWorkerV1({...base,privateKeyPath:key,knownHostsPath:known}),/CREDENTIAL_FILE_UNSAFE/);
    await rm(key);await writeFile(key,'fixture',{mode:0o600});await symlink(key,link);
    await assert.rejects(executeSshDirectWorkerV1({...base,privateKeyPath:link,knownHostsPath:known}),/CREDENTIAL_FILE_UNSAFE/);
    for(const patch of [{timeoutMs:300001},{workerTimeoutMs:30000},{maxOutputBytes:2000000}])await assert.rejects(executeSshDirectWorkerV1({...base,privateKeyPath:key,knownHostsPath:known,...patch}),/EXECUTION_BOUNDS_REQUIRED/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
