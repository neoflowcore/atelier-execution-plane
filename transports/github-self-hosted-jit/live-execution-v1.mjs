export function compileGithubJitLiveExecutionV1(input={}){
  for(const k of ["executionId","repository","sourceSha","workflowRef"]) if(typeof input[k]!=="string"||!input[k]) throw new Error(`JIT_LIVE_${k.toUpperCase()}_REQUIRED`);
  return Object.freeze({
    schemaId:"GITHUB_SELF_HOSTED_JIT_LIVE_EXECUTION_V1",
    executionId:input.executionId,
    repository:input.repository,
    sourceSha:input.sourceSha,
    workflowRef:input.workflowRef,
    githubAuthMode:"EXISTING_PLATFORM_OR_REPOSITORY_AUTH",
    workerDeviceLoginAllowed:false,
    longLivedCredentialOnWorkerAllowed:false,
    capacityBeforeTriggerRequired:true,
    jitRegistrationTokenEphemeral:true,
    jitCredentialPersistence:false,
    runnerRemovalRequired:true,
    runnerRemovalReadbackRequired:true,
    residueScanRequired:true
  });
}
export function evaluateGithubJitLivePreflightV1({contract,capacityReady,authAvailable}={}){
  if(!contract||contract.schemaId!=="GITHUB_SELF_HOSTED_JIT_LIVE_EXECUTION_V1") throw new Error("JIT_LIVE_CONTRACT_REQUIRED");
  const ready=capacityReady===true&&authAvailable===true;
  return Object.freeze({ready,status:ready?"READY_FOR_LIVE_TRIGGER":"DEFERRED_LIVE_TRIGGER",deviceLoginRequired:false,longLivedCredentialRequired:false});
}
