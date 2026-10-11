import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
const root='artifacts/ep52/r6-independent-controller';
try{
  const pid=Number(await readFile(`${root}/controller.pid`,'utf8'));
  if(!Number.isSafeInteger(pid)||pid<1)throw Error('PID_REQUIRED');
  let result;
  for(let attempt=0;attempt<180;attempt++){
    try{result=JSON.parse(await readFile(`${root}/receipt.json`,'utf8'));break;}catch(e){if(e.code!=='ENOENT')throw e;}
    process.kill(pid,0);await delay(1000);
  }
  if(result?.sourceSha!==process.env.EP52_SOURCE_SHA||result?.teardown?.status!=='ABSENT_AT_EXPIRY'||result.providerMutations!==0||result.paidCreates!==0)throw Error('CONTROLLER_RESULT_REQUIRED');
  console.log(JSON.stringify(result));
}catch{console.error('CONTROLLER_MONITOR_FAILED');process.exitCode=1;}
