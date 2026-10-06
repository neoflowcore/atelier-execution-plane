const REQUIRED_REFERENCE_IDS=Object.freeze(["R1","R2","R3","R4","R5","R6"]);
const REQUIRED_PROVIDER_CAPABILITIES=Object.freeze([
  "LOCAL_REFERENCE",
  "DIGITALOCEAN_HARNESS_RUNTIME",
  "DIGITALOCEAN_SERVERLESS_INFERENCE",
  "RUNTIME_ACCEPTANCE_AUTHORITY",
  "BILLING_RESIDUE_ZERO"
]);

export function compileV006HarnessPrimaryProviderProfileV1(input={}){
  return Object.freeze({
    schemaId:"EP52_V006_HARNESS_PRIMARY_PROVIDER_PROFILE_V1",
    profileId:"DIGITALOCEAN_HARNESS_PRIMARY_VMWARE_OPTIONAL",
    integrationMode:"ADDITIVE",
    predecessorV004Preserved:true,
    predecessorV006BaseClosurePreserved:true,
    requiredProviders:["LOCAL","DIGITALOCEAN_HARNESS_RUNTIME"],
    optionalDeferredProviders:["VMWARE"],
    requiredReferences:[...REQUIRED_REFERENCE_IDS],
    requiredCapabilities:[...REQUIRED_PROVIDER_CAPABILITIES],
    modelBillingPreference:"DIGITALOCEAN_SERVERLESS_INFERENCE",
    rawDropletFallback:false,
    thirdPartyPaidBrowserAgent:false,
    manualSshNormalPath:false,
    termuxNormalPath:false,
    rawCredentialChatPath:false,
    vmwareRequiredForCurrentV006Seal:false,
    predecessorVmwareProviderMatrixStatus:input.predecessorVmwareProviderMatrixStatus??"HISTORICAL_DEFERRED_NOT_REWRITTEN",
    predecessorVmwareMatrixRetroactivelyPromoted:false
  });
}

export function evaluateV006HarnessPrimaryReadinessV1(input={}){
  const missingReferences=REQUIRED_REFERENCE_IDS.filter(id=>input.references?.[id]!=="PASS");
  const checks={
    localReference:input.LOCAL_REFERENCE==="PASS",
    harnessRuntime:input.DIGITALOCEAN_HARNESS_RUNTIME==="PASS",
    digitalOceanInference:input.DIGITALOCEAN_SERVERLESS_INFERENCE==="PASS",
    runtimeAcceptanceAuthority:input.RUNTIME_ACCEPTANCE_AUTHORITY==="PASS",
    compatibilityProjection:input.COMPATIBILITY_PROJECTION==="PASS",
    residueZero:input.ACTIVE_PAID_COMPUTE===0&&input.ORPHANED_BILLABLE_RESOURCE===0&&input.BILLABLE_RESIDUE===0
  };
  const failures=[
    ...missingReferences.map(x=>"REFERENCE:"+x),
    ...Object.entries(checks).filter(([,v])=>!v).map(([k])=>"CHECK:"+k)
  ];
  return Object.freeze({
    schemaId:"EP52_V006_HARNESS_PRIMARY_READINESS_V1",
    profileId:"DIGITALOCEAN_HARNESS_PRIMARY_VMWARE_OPTIONAL",
    missingReferences,
    checks,
    failures,
    VMWARE_REQUIRED:false,
    predecessorVmwareMatrixRetroactivelyPromoted:false,
    sealEligible:failures.length===0,
    status:failures.length===0?"PASS":"PENDING"
  });
}

export {REQUIRED_REFERENCE_IDS as V006_HARNESS_REQUIRED_REFERENCE_IDS,REQUIRED_PROVIDER_CAPABILITIES as V006_HARNESS_REQUIRED_PROVIDER_CAPABILITIES};
