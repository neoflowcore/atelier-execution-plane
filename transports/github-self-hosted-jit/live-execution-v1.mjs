export function compileGithubJitLiveExecutionV1(input={}){
  for(const k of ["executionId","repository","sourceSha","workflowRef"]) if(typeof input[k]!=="string"||!input[k]) throw new Error(`JIT_LIVE_${k.toUpperCase()}_REQUIRED`);
  if(!/^[0-9a-f]{40}$/.test(input.sourceSha)) throw new Error("JIT_LIVE_SOURCE_SHA_INVALID");
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
    freshReadyAttestationRequired:true,
    jitRegistrationTokenEphemeral:true,
    jitCredentialPersistence:false,
    runnerRemovalRequired:true,
    runnerRemovalReadbackRequired:true,
    credentialAbsenceReadbackRequired:true,
    residueScanRequired:true
  });
}
export function evaluateGithubJitLivePreflightV1({
  contract,
  capacityReady,
  authAvailable,
  readyAttestationFresh,
  runnerRemovalCapability,
  credentialAbsenceReadbackCapability
}={}){
  if(!contract||contract.schemaId!=="GITHUB_SELF_HOSTED_JIT_LIVE_EXECUTION_V1") throw new Error("JIT_LIVE_CONTRACT_REQUIRED");
  const ready=
    capacityReady===true&&
    authAvailable===true&&
    readyAttestationFresh===true&&
    runnerRemovalCapability===true&&
    credentialAbsenceReadbackCapability===true;
  const blockers=[];
  if(capacityReady!==true) blockers.push("CAPACITY_NOT_READY");
  if(authAvailable!==true) blockers.push("GITHUB_AUTH_UNAVAILABLE");
  if(readyAttestationFresh!==true) blockers.push("READY_ATTESTATION_STALE_OR_MISSING");
  if(runnerRemovalCapability!==true) blockers.push("RUNNER_REMOVAL_CAPABILITY_REQUIRED");
  if(credentialAbsenceReadbackCapability!==true) blockers.push("CREDENTIAL_ABSENCE_READBACK_CAPABILITY_REQUIRED");
  return Object.freeze({
    ready,
    status:ready?"READY_FOR_LIVE_TRIGGER":"DEFERRED_LIVE_TRIGGER",
    deviceLoginRequired:false,
    longLivedCredentialRequired:false,
    blockers
  });
}
