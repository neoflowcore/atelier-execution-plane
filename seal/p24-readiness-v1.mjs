export const REQUIRED_P24_LIVE_GATES=Object.freeze([
  "LOCAL","VMWARE","DIGITALOCEAN","DIRECT_WORKER","GITHUB_SELF_HOSTED_JIT","PROVIDER_TRANSPORT_INDEPENDENCE"
]);
export function evaluateEp52P24ReadinessV1(input={}){
  const pending=REQUIRED_P24_LIVE_GATES.filter(k=>input[k]!=="PASS");
  const residueZero=input.ACTIVE_PAID_COMPUTE===0&&input.ORPHANED_BILLABLE_RESOURCE===0&&input.BILLABLE_RESIDUE===0;
  const sourceReady=input.sourcePreparationStatus==="PASS";
  return Object.freeze({
    schemaId:"EP52_P24_READINESS_V1",
    sourceReady,
    pendingLiveGates:pending,
    residueZero,
    finalSealAllowed:sourceReady&&pending.length===0&&residueZero,
    status:sourceReady&&pending.length===0&&residueZero?"READY_FOR_DEVELOPMENT_SEAL":"BLOCKED_ON_REQUIRED_LIVE_EVIDENCE",
    runtimeSourceMutationAllowed:false,
    runtimeInterfaceRedefinitionAllowed:false,
    prematureSealDenied:true
  });
}
