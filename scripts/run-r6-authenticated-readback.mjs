import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createAuthenticatedDigitalOceanReadbackV1} from '../providers/digitalocean/authenticated-readback-v1.mjs';
const dir='artifacts/ep52/r6-connected';
await mkdir(dir,{recursive:true});
let receipt;
try{
  const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const tree=execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim();
  if(process.env.GITHUB_REPOSITORY!=='neoflowcore/atelier-execution-plane'||process.env.EP52_SOURCE_SHA!==sha)throw Error('R6_EXECUTION_IDENTITY_MISMATCH');
  const plan=JSON.parse(await readFile('docs/EP52_V006_PLAN_BINDING_v001.json','utf8'));
  if(plan.planSha256!=='d93a01f6658b780f7c0ffda658cf34d62632ad5473f1bc167e1f624f61677118')throw Error('R6_PLAN_DRIFT');
  const adapter=createAuthenticatedDigitalOceanReadbackV1({token:process.env.ATELIER_R6_DO_TOKEN});
  receipt=await adapter.collect({sourceSha:sha,sourceTree:tree,planSha256:plan.planSha256,
    expectedAccountUuid:'bd0ac817-54dd-47e5-8a66-73d30e19fc3a',runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT});
}catch(error){
  const code=/^(DO_|R6_)[A-Z0-9_]+$/.test(error.message)?error.message:'R6_READBACK_INTERNAL_ERROR';
  receipt={schemaId:'EP52_R6_AUTHENTICATED_READBACK_V1',connection:'BLOCKED',blockers:[code],providerMutations:0,paidResourceCreateAllowed:false,R6:'PENDING',finalAcceptance:false};
  process.exitCode=1;
}finally{delete process.env.ATELIER_R6_DO_TOKEN;}
await writeFile(`${dir}/readback.json`,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({connection:receipt.connection,blockers:receipt.blockers,providerMutations:0,R6:'PENDING'}));
