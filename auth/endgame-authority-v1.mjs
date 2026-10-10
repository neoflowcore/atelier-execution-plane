const PROVIDERS=Object.freeze(["DIGITALOCEAN","VMWARE","GITHUB"]);
export function compileEp52AuthEndgameAuthorityV1(input={}){
  if(input.explicitUserApproval!==true) throw new Error("EP52_P19_EXPLICIT_USER_APPROVAL_REQUIRED");
  const cost=input.costEnvelope??{};
  if(cost.maxConcurrentPaidResources!==1) throw new Error("EP52_P19_MAX_CONCURRENT_PAID_RESOURCE_MUST_BE_ONE");
  if(!Number.isSafeInteger(cost.maxPaidComputeMilliUsdPerResource)||cost.maxPaidComputeMilliUsdPerResource<=0||cost.maxPaidComputeMilliUsdPerResource>100) throw new Error("EP52_P19_PER_RESOURCE_COST_CAP_INVALID");
  if(!Number.isSafeInteger(cost.maxPaidComputeMilliUsdTotal)||cost.maxPaidComputeMilliUsdTotal<=0||cost.maxPaidComputeMilliUsdTotal>500) throw new Error("EP52_P19_TOTAL_COST_CAP_INVALID");
  if(!Number.isSafeInteger(cost.maxTtlSeconds)||cost.maxTtlSeconds<=0||cost.maxTtlSeconds>1800) throw new Error("EP52_P19_TTL_CAP_INVALID");
  const connectionState={DIGITALOCEAN:input.connectionState?.DIGITALOCEAN??"NOT_CONNECTED",VMWARE:input.connectionState?.VMWARE??"UNRESOLVED_EXISTING_SURFACE",GITHUB:input.connectionState?.GITHUB??"CONNECTED_EXISTING"};
  const body={
    schemaId:"EP52_P19_AUTH_ENDGAME_AUTHORITY_V1",
    status:connectionState.DIGITALOCEAN==="CONNECTED"&&connectionState.VMWARE==="CONNECTED_EXISTING"?"BOUND":"AUTHORITY_APPROVED_BINDING_PENDING",
    explicitUserApproval:true,
    approvalScope:"MINIMUM_COST_LIVE_QUALIFICATION_ONLY",
    providers:[...PROVIDERS],
    connectionState,
    authInteractionBudget:1,
    authInteractionConsumed:0,
    perProviderMicroAuth:false,
    rawSecretChatPath:false,
    reuseExistingValidAuthFirst:true,
    costEnvelope:{
      currency:"USD",
      maxConcurrentPaidResources:1,
      maxPaidComputeMilliUsdPerResource:cost.maxPaidComputeMilliUsdPerResource,
      maxPaidComputeMilliUsdTotal:cost.maxPaidComputeMilliUsdTotal,
      maxTtlSeconds:cost.maxTtlSeconds,
      selectMinimumEligibleDigitalOceanSize:true,
      additionalBillableResourcesAllowed:false,
      backupsAllowed:false,
      blockStorageAllowed:false,
      reservedIpAllowed:false,
      loadBalancerAllowed:false,
      databaseAllowed:false
    },
    digitalOcean:{
      officialOrFirstPartySurfaceRequired:true,
      minimumEligibleSizeRequired:true,
      createOnlyAfterFreshInventoryAndPricingReadback:true,
      deleteOrTerminateRequired:true,
      deleteReadbackRequired:true,
      childBillableArtifactScanRequired:true,
      residueZeroRequired:true
    },
    vmware:{
      existingInfrastructureOnly:true,
      newPaidResourceAllowed:false,
      manualSshNormalPath:false,
      trustedExecutorOrOfficialApiRequired:true
    },
    github:{
      reuseExistingAuth:true,
      workerDeviceLoginAllowed:false,
      longLivedCredentialOnWorkerAllowed:false
    }
  };
  return Object.freeze(body);
}
