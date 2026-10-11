import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {runTeardownServiceV1} from '../watchdog/teardown-watchdog/service-v1.mjs';
import {createDigitalOceanTeardownApiV1} from '../providers/digitalocean/teardown-api-v1.mjs';

// Explicit command only. Not auto-enabled on PRs, and never a create path.
const out=resolve('artifacts/ep52/teardown-watchdog');
async function persist(name,value){await mkdir(out,{recursive:true,mode:0o700});const temp=resolve(out,`${name}.tmp`);await writeFile(temp,JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(temp,resolve(out,`${name}.json`));}
try{
  if(process.argv.length!==3||process.env.GITHUB_REPOSITORY!=='neoflowcore/atelier-execution-plane')throw Error('TEARDOWN_PROJECT_CONTEXT_REQUIRED');
  const lease=JSON.parse(await readFile(process.argv[2],'utf8'));
  const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const binding=JSON.parse(await readFile('docs/EP52_V006_PLAN_BINDING_v001.json','utf8'));
  if(source!==lease.sourceSha||binding.planSha256!==lease.planSha256||lease.accountUuid!=='bd0ac817-54dd-47e5-8a66-73d30e19fc3a')throw Error('TEARDOWN_SOURCE_PLAN_TARGET_MISMATCH');
  const provider=createDigitalOceanTeardownApiV1({token:process.env.ATELIER_R6_DO_TOKEN});delete process.env.ATELIER_R6_DO_TOKEN;
  const result=await runTeardownServiceV1({lease,provider,onArmed:receipt=>persist('armed',receipt)});
  await persist('result',result);console.log(JSON.stringify(result));
  if(result.status==='CLEANUP_UNRESOLVED')process.exitCode=1;
}catch{
  await persist('failure',{schemaId:'EP52_TEARDOWN_FAILURE_V1',status:'UNRESOLVED',rawDiagnosticsExposed:false,finalR6Acceptance:false});
  console.error('TEARDOWN_FAILED_RECONCILIATION_REQUIRED');process.exitCode=1;
}
