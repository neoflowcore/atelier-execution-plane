import {spawn} from 'node:child_process';
import {mkdir,open,writeFile,readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
const root='artifacts/ep52/r6-independent-controller';
let child;
try{
  await mkdir(root,{recursive:true});
  const log=await open(`${root}/controller.log`,'w',0o600);
  const env=Object.fromEntries(['PATH','GITHUB_REPOSITORY','EP52_SOURCE_SHA','GITHUB_RUN_ID','GH_READ_CREDENTIAL','ATELIER_R6_DO_TOKEN','RUNNER_TRACKING_ID'].filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]]));
  child=spawn(process.execPath,['scripts/run-r6-independent-controller-reference.mjs'],{env,stdio:['ignore',log.fd,log.fd]});
  let failed=false;child.on('error',()=>{failed=true;});child.on('exit',()=>{failed=true;});
  await log.close();await writeFile(`${root}/controller.pid`,String(child.pid),{mode:0o600});
  for(let attempt=0;attempt<300;attempt++){
    if(failed)throw Error('CONTROLLER_EXITED');
    try{
      const e=JSON.parse(await readFile(`${root}/envelope.json`,'utf8'));
      if(e.lease.sourceSha!==process.env.EP52_SOURCE_SHA||e.armed.cleanupAtMs-Date.now()<60000)throw Error('CONTROLLER_ARM_INVALID');
      process.kill(child.pid,0);child.unref();console.log('CONTROLLER_ARM_PERSISTED_PROCESS_RUNNING');process.exit(0);
    }catch(e){if(e.code!=='ENOENT')throw e;}
    await delay(500);
  }throw Error('CONTROLLER_ARM_TIMEOUT');
}catch{child?.kill('SIGTERM');console.error('CONTROLLER_START_FAILED');process.exitCode=1;}
