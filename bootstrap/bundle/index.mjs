import { createHash } from 'node:crypto';

function canon(v){if(v===null)return'null';if(typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);if(typeof v==='number'){if(!Number.isSafeInteger(v))throw new Error('BOOTSTRAP_NON_SAFE_INTEGER');return JSON.stringify(v);}if(Array.isArray(v))return`[${v.map(canon).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;throw new Error('BOOTSTRAP_UNSUPPORTED_TYPE');}
const sha=v=>createHash('sha256').update(typeof v==='string'?v:canon(v),'utf8').digest('hex');
const SHA=/^[0-9a-f]{64}$/;

export function buildBootstrapBundleV1(input={}){
  if(input.mutableTag==='latest')throw new Error('MUTABLE_LATEST_BOOTSTRAP_DENIED');
  for(const [k,v] of Object.entries({WORKER_AGENT_SHA256:input.workerAgentSha256,RUNNER_PACKAGE_SHA256:input.runnerPackageSha256,ENTRYPOINT_SHA256:input.entrypointSha256,DEPENDENCY_SET_SHA256:input.dependencySetSha256,CONTRACT_SET_SHA256:input.contractSetSha256}))if(!SHA.test(v??''))throw new Error(`${k}_REQUIRED`);
  const manifest={schemaId:'BOOTSTRAP_BUNDLE_MANIFEST_V1',version:input.version??'1',imageId:input.imageId??'local-node22',workerAgentSha256:input.workerAgentSha256,runnerPackageSha256:input.runnerPackageSha256,entrypointSha256:input.entrypointSha256,dependencySetSha256:input.dependencySetSha256,contractSetSha256:input.contractSetSha256};
  const BOOTSTRAP_MANIFEST_SHA256=sha(manifest);
  const body={...manifest,BOOTSTRAP_MANIFEST_SHA256};
  return Object.freeze({...body,BOOTSTRAP_BUNDLE_SHA256:sha(body),BOOTSTRAP_BUNDLE_ID:`sha256:${sha(body)}`});
}
