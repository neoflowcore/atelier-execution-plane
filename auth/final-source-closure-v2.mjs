const SHA40=/^[0-9a-f]{40}$/;

export const EP52_FINAL_SOURCE_NODES_V2=Object.freeze([
  "EP52-P0","EP52-P1","EP52-P2","EP52-P3","EP52-P4","EP52-P5","EP52-P6","EP52-P7","EP52-P8","EP52-P9",
  "EP52-P10","EP52-P11","EP52-P12","EP52-P13","EP52-P14","EP52-P15","EP52-P16","EP52-P17","EP52-P18",
  "P19-AUTHORITY-ENVELOPE",
  "P19-FRESH-SURFACE-DISCOVERY",
  "P19-LIVE-AUTHORITY-LOCK",
  "P19-DIGITALOCEAN-LEAST-PRIVILEGE-SCOPE-LOCK",
  "P20-PROVIDER-TRANSPORT-MATRIX",
  "P20-DEFERRED-PROVIDER-HOT-REATTACH",
  "P20-PROVIDER-LIVE-TRANSACTION-ORCHESTRATOR",
  "P20-PROVIDER-SURFACE-DRIVER-RUNNER",
  "P20-DIGITALOCEAN-API-PREFLIGHT",
  "P20-DIGITALOCEAN-COST-AWARE-SELECTOR",
  "P20-DIGITALOCEAN-OFFICIAL-API-SURFACE-DRIVER",
  "P20-VMWARE-LIVE-BRIDGE",
  "P20-GITHUB-JIT-PREFLIGHT",
  "P21-LOCAL-LIVE-WORKLOAD-HARNESS",
  "P21-CHROMIUM-LARGE-DISK-HARNESS",
  "P21-MULTI-WORKER-HARNESS",
  "P22-CLEANUP-RESIDUE-COMPILER",
  "P23-PREFREEZE-MANIFEST-COMPILER",
  "P23-INTERFACE-FREEZE-COMPILER",
  "P24-SEAL-HANDOFF-COMPILER",
  "COMPATIBILITY-REBIND-COMPILER",
  "POST-SEAL-RESUME-PLAN",
  "INTEGRATION-LIVE-HARNESS",
  "INTEGRATION-SEAL-COMPILER"
]);

export function compileExecutionPlaneFinalSourceClosureV2(input={}){
  if(!SHA40.test(input.sourceHead??"")||!SHA40.test(input.sourceTree??"")) throw new Error("EP52_FINAL_SOURCE_IDENTITY_REQUIRED");
  const completed=new Set(input.completedSourceNodes??[]);
  const missing=EP52_FINAL_SOURCE_NODES_V2.filter(x=>!completed.has(x));
  const deferred=Array.isArray(input.deferredWork)?input.deferredWork:[];
  const illegalDeferred=deferred.filter(x=>x?.class!=="PROVIDER_LIVE"&&x?.class!=="FINAL_LIVE"&&x?.class!=="POST_SEAL_LIVE");
  const sourceExhausted=missing.length===0&&illegalDeferred.length===0;
  const horizon1IntegrationSeal=input.horizon1IntegrationSealStatus??"PENDING";
  return Object.freeze({
    schemaId:"EP52_FINAL_SOURCE_CLOSURE_V2",
    sourceHead:input.sourceHead,
    sourceTree:input.sourceTree,
    requiredSourceNodeCount:EP52_FINAL_SOURCE_NODES_V2.length,
    completedSourceNodeCount:EP52_FINAL_SOURCE_NODES_V2.length-missing.length,
    missingSourceNodes:missing,
    deferredWork:deferred.map(x=>Object.freeze({...x})),
    illegalDeferredSourceWork:illegalDeferred.map(x=>Object.freeze({...x})),
    EXECUTION_PLANE_CREDENTIAL_INDEPENDENT_WORK_EXHAUSTED:sourceExhausted,
    NO_NEXT_CREDENTIAL_INDEPENDENT_WORK:sourceExhausted,
    ACTIVE_NEXT:sourceExhausted?null:missing[0]??"RECONCILE_ILLEGAL_DEFERRED_SOURCE_WORK",
    DEFERRED_PROVIDER_LIVE_WORK:deferred.filter(x=>x?.class==="PROVIDER_LIVE"),
    DEFERRED_FINAL_LIVE_WORK:deferred.filter(x=>x?.class==="FINAL_LIVE"||x?.class==="POST_SEAL_LIVE"),
    horizon1IntegrationSealStatus:horizon1IntegrationSeal,
    HORIZON2_START_ALLOWED:sourceExhausted&&horizon1IntegrationSeal==="SEALED",
    HORIZON2_BLOCK_REASON:horizon1IntegrationSeal==="SEALED"?null:"HORIZON1_EXECUTION_PLANE_INTEGRATION_SEAL_REQUIRED",
    status:sourceExhausted?"PASS_SOURCE_EXHAUSTED_LIVE_DEFERRED":"CONTINUE_SOURCE_PROGRESS"
  });
}
