export function compileDigitalOceanApiExecutionV1(input={}){
  if(typeof input.executionId!=="string"||!input.executionId) throw new Error("DO_EXECUTION_ID_REQUIRED");
  if(typeof input.tokenReference!=="string"||!input.tokenReference) throw new Error("DO_TOKEN_REFERENCE_REQUIRED");
  if(!Number.isSafeInteger(input.costCapMilliUsd)||input.costCapMilliUsd<=0) throw new Error("DO_COST_CAP_REQUIRED");
  if(!Number.isSafeInteger(input.ttlSeconds)||input.ttlSeconds<=0) throw new Error("DO_TTL_REQUIRED");
  return Object.freeze({
    schemaId:"DIGITALOCEAN_API_EXECUTION_V1",
    providerClass:"DIGITALOCEAN",
    executionId:input.executionId,
    tokenReference:input.tokenReference,
    tokenMaterialPersisted:false,
    officialApiBase:"https://api.digitalocean.com/v2",
    verifyBeforeProvision:true,
    inventoryReadBeforeProvision:true,
    pricingReadBeforeProvision:true,
    minimumEligibleSizeRequired:true,
    maxConcurrentPaidResources:1,
    costCapMilliUsd:input.costCapMilliUsd,
    ttlSeconds:input.ttlSeconds,
    createEndpoint:"/droplets",
    deleteEndpointPattern:"/droplets/{id}",
    deleteReadbackRequired:true,
    childBillableArtifactScanRequired:true,
    finalInventoryReadbackRequired:true,
    residueZeroRequired:true
  });
}
export function evaluateDigitalOceanApiPreflightV1({contract,inventoryKnown,pricingKnown,connectionState}={}){
  if(!contract||contract.schemaId!=="DIGITALOCEAN_API_EXECUTION_V1") throw new Error("DO_API_EXECUTION_CONTRACT_REQUIRED");
  const ready=connectionState==="CONNECTED"&&inventoryKnown===true&&pricingKnown===true;
  return Object.freeze({ready,status:ready?"READY_FOR_MINIMUM_COST_PROVISION":"DEFERRED_PROVIDER_LIVE_WORK",newResourceCreateAllowed:ready});
}
