import { createHash } from 'node:crypto';
const SHA=/^[0-9a-f]{64}$/;
const hash=v=>createHash('sha256').update(JSON.stringify(v),'utf8').digest('hex');
export function compileWorkerReadyAttestationV1(input={}){
  if(typeof input.workerId!=='string'||!input.workerId)throw new Error('WORKER_ID_REQUIRED');
  if(!SHA.test(input.bootstrapBundleSha256??''))throw new Error('BOOTSTRAP_BUNDLE_SHA256_REQUIRED');
  if(!SHA.test(input.agentDigest??''))throw new Error('AGENT_DIGEST_REQUIRED');
  if(!input.capabilities||typeof input.capabilities!=='object')throw new Error('CAPABILITIES_REQUIRED');
  const observedAt=Number(input.observedAtMs); const ttl=Number(input.ttlMs??300000);
  if(!Number.isSafeInteger(observedAt)||!Number.isSafeInteger(ttl)||ttl<=0)throw new Error('READINESS_TIME_INVALID');
  const body={schemaId:'WORKER_READY_ATTESTATION_V1',workerId:input.workerId,providerClass:input.providerClass??'LOCAL',environmentIdentity:input.environmentIdentity??null,bootstrapBundleSha256:input.bootstrapBundleSha256,agentDigest:input.agentDigest,capabilities:input.capabilities,observedAtMs:observedAt,expiresAtMs:observedAt+ttl,resourceCreated:true,workerReady:true,privilegedCredentialEligible:true};
  return Object.freeze({...body,attestationSha256:hash(body)});
}
export function evaluateWorkerReadyAttestationV1(attestation,{nowMs}={}){
  if(!attestation||attestation.schemaId!=='WORKER_READY_ATTESTATION_V1')return Object.freeze({ready:false,code:'READY_ATTESTATION_REQUIRED'});
  const now=Number(nowMs); if(!Number.isSafeInteger(now))throw new Error('NOW_MS_REQUIRED');
  if(now>attestation.expiresAtMs)return Object.freeze({ready:false,code:'READINESS_STALE'});
  return Object.freeze({ready:attestation.workerReady===true,code:attestation.workerReady===true?'WORKER_READY':'WORKER_NOT_READY'});
}
