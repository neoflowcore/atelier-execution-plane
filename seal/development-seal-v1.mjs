import {createHash} from 'node:crypto';
const sha=v=>createHash('sha256').update(JSON.stringify(v),'utf8').digest('hex');
const PASS_KEYS=['LOCAL','VMWARE','DIGITALOCEAN','DIRECT_WORKER','GITHUB_SELF_HOSTED_JIT','PROVIDER_TRANSPORT_INDEPENDENCE','CHECKPOINT_RESUME','CACHE_TRUST_BOUNDARY','CANCELLATION','DETACHED_SESSION_RECOVERY','PROTOCOL_COMPATIBILITY','MULTI_WORKER','SHADOW_CANARY','DATA_LOCALITY_TELEMETRY','WORKER_READY_ATTESTATION','PRE_OPERATION_ATTESTATION','SECRET_BROKER','ARTIFACT_EVIDENCE_BUS','ORPHAN_REAPER','TEARDOWN_WATCHDOG','JOB_SNAPSHOT_PROJECTION','EXTERNAL_CONTROL_PLANE_BRIDGE'];
export function compileExecutionPlaneDevelopmentSealV1(input={}){
  const failures=PASS_KEYS.filter(k=>input[k]!=='PASS');
  if(input.RUNTIME_HANDOFF_DIGEST!=='eb122a65afc92d589b1af2eb923167cd47d144e1105669493b117249beefcbf8') failures.push('RUNTIME_HANDOFF_DIGEST');
  if(input.RUNTIME_SOURCE_MUTATION_COUNT!==0) failures.push('RUNTIME_SOURCE_MUTATION_COUNT');
  if(input.RUNTIME_INTERFACE_REDEFINITION_COUNT!==0) failures.push('RUNTIME_INTERFACE_REDEFINITION_COUNT');
  const residueZero=input.ACTIVE_PAID_COMPUTE===0&&input.ORPHANED_BILLABLE_RESOURCE===0&&input.BILLABLE_RESIDUE===0;
  if(!residueZero) failures.push('BILLING_RESIDUE_ZERO');
  const body={schemaId:'EXECUTION_PLANE_REV52_DEVELOPMENT_SEAL_V1',status:failures.length?'BLOCKED':'SEALED',failures,RUNTIME_HANDOFF_DIGEST:input.RUNTIME_HANDOFF_DIGEST,RUNTIME_SOURCE_MUTATION_COUNT:input.RUNTIME_SOURCE_MUTATION_COUNT,RUNTIME_INTERFACE_REDEFINITION_COUNT:input.RUNTIME_INTERFACE_REDEFINITION_COUNT,ACTIVE_PAID_COMPUTE:input.ACTIVE_PAID_COMPUTE,ORPHANED_BILLABLE_RESOURCE:input.ORPHANED_BILLABLE_RESOURCE,BILLABLE_RESIDUE:input.BILLABLE_RESIDUE};
  return Object.freeze({...body,sealDigest:sha(body)});
}
export function compileExecutionPlaneHandoffBundleV1({seal,interfaceFreeze,sourceIdentity}={}){
  if(!seal||seal.status!=='SEALED') throw new Error('DEVELOPMENT_SEAL_REQUIRED');
  if(!interfaceFreeze||interfaceFreeze.finalFreezeEligible!==true) throw new Error('FINAL_INTERFACE_FREEZE_REQUIRED');
  const body={schemaId:'EXECUTION_PLANE_REV52_HANDOFF_BUNDLE_V1',version:'1',sealDigest:seal.sealDigest,interfaceDigest:interfaceFreeze.interfaceDigest,sourceIdentity,runtimeHandoffDigest:seal.RUNTIME_HANDOFF_DIGEST};
  return Object.freeze({...body,handoffDigest:sha(body)});
}
