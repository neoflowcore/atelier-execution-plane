export const REQUIRED_LIVE_COMBINATIONS=Object.freeze([
  ['LOCAL','DIRECT_WORKER'],['VMWARE','DIRECT_WORKER'],['DIGITALOCEAN','DIRECT_WORKER'],['VMWARE','GITHUB_SELF_HOSTED_JIT'],['DIGITALOCEAN','GITHUB_SELF_HOSTED_JIT']
]);
export function compileLiveQualificationPlanV1({authEnvelopeBound=false,costEnvelopeBound=false}={}){
  return Object.freeze({schemaId:'EP52_LIVE_QUALIFICATION_PLAN_V1',combinations:REQUIRED_LIVE_COMBINATIONS.map(([provider,transport])=>({provider,transport,status:'PENDING_LIVE'})),requiresAuthEnvelope:true,authEnvelopeBound:authEnvelopeBound===true,requiresCostEnvelope:true,costEnvelopeBound:costEnvelopeBound===true,workerDeviceLoginAllowed:false,longLivedCredentialOnWorkerAllowed:false,providerTransportIndependenceRequired:true,liveExecutionAuthorized:authEnvelopeBound===true&&costEnvelopeBound===true});
}
