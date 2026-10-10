import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir,userInfo} from 'node:os';
import {createHash} from 'node:crypto';
import {createServer,connect} from 'node:net';
import {executeSshDirectWorkerV1} from '../transports/direct-worker/ssh-execution-v1.mjs';

const exec=promisify(execFile),hash=x=>createHash('sha256').update(x).digest('hex');
if(process.getuid?.()!==0)throw Error('REHEARSAL_REQUIRES_ISOLATED_SSHD_ROOT');
const root=await mkdtemp(`${tmpdir()}/atelier-r6-rehearsal-`);
const user=process.env.SUDO_USER??userInfo().username;
if(!/^[a-z_][a-z0-9_-]*$/.test(user))throw Error('REHEARSAL_USER_INVALID');
let daemon=null,receipt=null;
try{
  const sourceSha=process.env.EP52_SOURCE_SHA??'a'.repeat(40);
  const planSha256='d93a01f6658b780f7c0ffda658cf34d62632ad5473f1bc167e1f624f61677118';
  if(process.env.GITHUB_REPOSITORY&&process.env.GITHUB_REPOSITORY!=='neoflowcore/atelier-execution-plane')throw Error('REHEARSAL_REPOSITORY_MISMATCH');
  if(process.env.GITHUB_ACTIONS==='true'){
    const head=(await exec('git',['-c',`safe.directory=${process.cwd()}`,'rev-parse','HEAD'])).stdout.trim();
    if(head!==sourceSha||process.version!=='v22.13.0')throw Error('REHEARSAL_CANONICAL_SOURCE_RUNTIME_REQUIRED');
  }
  const reserve=createServer();await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));
  const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
  for(const key of ['client','host'])await exec('/usr/bin/ssh-keygen',['-q','-t','ed25519','-N','','-f',`${root}/${key}`]);
  const publicKey=await readFile(`${root}/client.pub`,'utf8');
  await writeFile(`${root}/authorized_keys`,publicKey,{mode:0o600});
  await exec('/bin/chown',[user,root,`${root}/authorized_keys`]);
  const hostKey=(await readFile(`${root}/host.pub`,'utf8')).trim().split(' ').slice(0,2).join(' ');
  await writeFile(`${root}/known_hosts`,`[127.0.0.1]:${port} ${hostKey}\n`,{mode:0o600});
  await writeFile(`${root}/sshd_config`,[
    `Port ${port}`,'ListenAddress 127.0.0.1',`HostKey ${root}/host`,`PidFile ${root}/sshd.pid`,
    `AuthorizedKeysFile ${root}/authorized_keys`,`AllowUsers ${user}`,'StrictModes yes',
    'PubkeyAuthentication yes','PasswordAuthentication no','KbdInteractiveAuthentication no',
    'PermitRootLogin prohibit-password','UsePAM yes','AllowTcpForwarding no','AllowAgentForwarding no','X11Forwarding no','LogLevel ERROR'
  ].join('\n')+'\n',{mode:0o600});
  await mkdir('/run/sshd',{recursive:true});
  await exec('/usr/sbin/sshd',['-t','-f',`${root}/sshd_config`]);
  daemon=spawn('/usr/sbin/sshd',['-D','-e','-f',`${root}/sshd_config`],{stdio:'ignore'});
  let ready=false;
  for(let i=0;i<30&&!ready;i++){
    ready=await new Promise(resolve=>{const s=connect(port,'127.0.0.1');s.on('connect',()=>{s.destroy();resolve(true)});s.on('error',()=>resolve(false));});
    if(!ready)await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!ready)throw Error('REHEARSAL_SSHD_NOT_READY');
  const workerSource=await readFile(new URL('../transports/direct-worker/index.mjs',import.meta.url),'utf8');
  const job={executionId:'r6-localhost-rehearsal',attemptId:'attempt1',fenceToken:1,workerJobSha256:hash('rehearsal'),executionPlanHash:planSha256,sourceIdentity:{sourceSha},entrypointSpec:{command:process.execPath,args:['-e','process.stdout.write("atelier-guest-execution")']},artifactPolicy:{},cleanupPolicy:{}};
  const input={job,host:'127.0.0.1',port,user,privateKeyPath:`${root}/client`,knownHostsPath:`${root}/known_hosts`,nodePath:process.execPath,cwd:'/tmp',workerSource,workerSourceSha256:hash(workerSource),sourceSha,planSha256,nodeVersion:process.version,timeoutMs:15000};
  const result=await executeSshDirectWorkerV1(input);
  if(result.status!=='PASS'||result.result.stdout!=='atelier-guest-execution')throw Error('REHEARSAL_WORKER_EXECUTION_FAILED');
  await exec('/usr/bin/ssh-keygen',['-q','-t','ed25519','-N','','-f',`${root}/wrong-host`]);
  const wrong=(await readFile(`${root}/wrong-host.pub`,'utf8')).trim().split(' ').slice(0,2).join(' ');
  await writeFile(`${root}/known_hosts`,`[127.0.0.1]:${port} ${wrong}\n`,{mode:0o600});
  let pinRejected=false;try{await executeSshDirectWorkerV1(input);}catch(e){pinRejected=e.message==='SSH_EXECUTION_FAILED';}
  if(!pinRejected)throw Error('REHEARSAL_HOST_PIN_REJECTION_FAILED');
  receipt={schemaId:'EP52_R6_GUEST_REHEARSAL_V1',classification:'LOCALHOST_TRANSPORT_REHEARSAL_ONLY',sourceSha,planSha256,nodeVersion:process.version,workerSourceSha256:hash(workerSource),execution:'PASS',hostKeyMismatchRejected:true,providerMutations:0,paidResourcesCreated:0,remoteProviderAttested:false,finalR6Acceptance:false};
}finally{
  if(daemon&&daemon.exitCode===null&&daemon.signalCode===null){
    const stopped=new Promise(resolve=>daemon.once('close',resolve));
    daemon.kill('SIGTERM');await stopped;
  }
  await rm(root,{recursive:true,force:true});
}
let removed=false;try{await readFile(`${root}/client`);}catch(e){removed=e.code==='ENOENT';}
if(!removed)throw Error('REHEARSAL_EPHEMERAL_KEY_RESIDUE');
receipt.ephemeralCredentialCleanup='PASS';
await mkdir('artifacts/ep52/r6-guest-rehearsal',{recursive:true});
await writeFile('artifacts/ep52/r6-guest-rehearsal/receipt.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
