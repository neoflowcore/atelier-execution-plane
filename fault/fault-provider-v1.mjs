export const REQUIRED_FAULT_SCENARIOS=Object.freeze(['PROVIDER_TIMEOUT_AFTER_CREATE','PROVIDER_TIMEOUT_AFTER_DELETE','WORKER_CRASH','WORKER_DISAPPEARS_BEFORE_RECEIPT','CONTROL_CLIENT_DISCONNECT','RUNTIME_REATTACH','STALE_FENCE_RESULT','DUPLICATE_OPERATION_REPLAY','JIT_REGISTRATION_TIMEOUT','CLEANUP_PARTIAL_FAILURE','ORPHAN_DISCOVERY','WRONG_OWNERSHIP_PROOF','STALE_READINESS','ARTIFACT_UPLOAD_RECEIPT_FAIL','MANUAL_MUTATION_TRUST_RESET','PROVIDER_SCHEMA_DRIFT']);
export function createDeterministicFaultProviderV1(){
  const seenOps=new Set();
  return Object.freeze({
    run({scenario,operationId='op',ownedResource=true}={}){
      if(!REQUIRED_FAULT_SCENARIOS.includes(scenario)) throw new Error('FAULT_SCENARIO_UNSUPPORTED');
      const duplicate=seenOps.has(operationId); seenOps.add(operationId);
      const base={schemaId:'FAULT_PROVIDER_RECEIPT_V1',scenario,operationId,blindRerun:false,duplicateAcceptance:false,foreignDelete:false};
      if(scenario==='DUPLICATE_OPERATION_REPLAY') return Object.freeze({...base,duplicateObserved:duplicate,accepted:!duplicate});
      if(scenario==='WRONG_OWNERSHIP_PROOF') return Object.freeze({...base,deleteAllowed:false,foreignDelete:false,accepted:false});
      if(scenario==='PROVIDER_TIMEOUT_AFTER_CREATE'||scenario==='PROVIDER_TIMEOUT_AFTER_DELETE') return Object.freeze({...base,outcome:'OUTCOME_UNKNOWN',secondMutationAllowed:false,reconcileOriginalOperation:true,accepted:false});
      if(scenario==='STALE_FENCE_RESULT') return Object.freeze({...base,accepted:false,quarantined:true});
      if(scenario==='PROVIDER_SCHEMA_DRIFT') return Object.freeze({...base,accepted:false,blockedSchemaDrift:true});
      if(scenario==='STALE_READINESS') return Object.freeze({...base,accepted:false,reattestRequired:true});
      if(scenario==='ARTIFACT_UPLOAD_RECEIPT_FAIL') return Object.freeze({...base,accepted:false,artifactCandidateOnly:true});
      if(scenario==='MANUAL_MUTATION_TRUST_RESET') return Object.freeze({...base,accepted:false,trustReset:true,reattestRequired:true});
      if(scenario==='CLEANUP_PARTIAL_FAILURE') return Object.freeze({...base,accepted:false,residueUnknown:true,newPaidResourceAllowed:false});
      if(scenario==='ORPHAN_DISCOVERY') return Object.freeze({...base,accepted:false,autoDelete:ownedResource===true,foreignDelete:false});
      return Object.freeze({...base,accepted:false,recoverable:true});
    }
  });
}
