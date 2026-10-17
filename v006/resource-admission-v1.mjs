export function evaluateExecutionAuthBeforeResourceAdmissionV1(input={}){
  const required={EXECUTION_CREDENTIAL_READY:input.executionCredentialReady===true,TRANSPORT_READY:input.transportReady===true,NETWORK_REACHABILITY:input.networkReachability===true,SOURCE_READY:input.sourceReady===true,EXIT_PATH_READY:input.exitPathReady===true,COST_ADMISSION:input.costAdmission===true};
  const blockers=Object.entries(required).filter(([,v])=>!v).map(([k])=>k);
  return Object.freeze({schemaId:"V006_EXECUTION_AUTH_BEFORE_RESOURCE_ADMISSION_V1",checks:required,blockers,paidResourceCreateAllowed:blockers.length===0,code:blockers.length?"PAID_RESOURCE_CREATE_DENY":"PAID_RESOURCE_CREATE_ALLOW"});
}
