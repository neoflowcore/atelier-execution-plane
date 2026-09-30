const ALLOWED_SURFACE_CLASSES=new Set(["OFFICIAL_NATIVE_API","FIRST_PARTY_OFFICIAL_CONNECTOR","BUILTIN_PROVIDER_API_ADAPTER"]);
const MAX_COST_CAP_MILLI_USD=100;
const MAX_TTL_SECONDS=1800;

export function compileDigitalOceanApiExecutionV1(input={}){
  if(typeof input.executionId!=="string"||!input.executionId) throw new Error("DO_EXECUTION_ID_REQUIRED");
  if(typeof input.tokenReference!=="string"||!input.tokenReference) throw new Error("DO_TOKEN_REFERENCE_REQUIRED");
  if(!Number.isSafeInteger(input.costCapMilliUsd)||input.costCapMilliUsd<=0||input.costCapMilliUsd>MAX_COST_CAP_MILLI_USD) throw new Error("DO_COST_CAP_REQUIRED_WITHIN_AUTHORITY");
  if(!Number.isSafeInteger(input.ttlSeconds)||input.ttlSeconds<=0||input.ttlSeconds>MAX_TTL_SECONDS) throw new Error("DO_TTL_REQUIRED_WITHIN_AUTHORITY");
  return Object.freeze({
    schemaId:"DIGITALOCEAN_API_EXECUTION_V1",
    providerClass:"DIGITALOCEAN",
    executionId:input.executionId,
    tokenReference:input.tokenReference,
    tokenMaterialPersisted:false,
    officialApiBase:"https://api.digitalocean.com/v2",
    allowedSurfaceClasses:[...ALLOWED_SURFACE_CLASSES],
    verifyBeforeProvision:true,
    inventoryReadBeforeProvision:true,
    pricingReadBeforeProvision:true,
    targetIdentityReadbackRequired:true,
    cleanupStateKnownBeforeProvision:true,
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

export function evaluateDigitalOceanApiPreflightV1({
  contract,
  inventoryKnown,
  pricingKnown,
  connectionState,
  authState,
  surfaceClass,
  targetIdentityReadback,
  cleanupState
}={}){
  if(!contract||contract.schemaId!=="DIGITALOCEAN_API_EXECUTION_V1") throw new Error("DO_API_EXECUTION_CONTRACT_REQUIRED");
  const allowedSurface=ALLOWED_SURFACE_CLASSES.has(surfaceClass);
  const authValid=["VALID","REUSED","NOT_REQUIRED"].includes(authState);
  const cleanupKnown=cleanupState==="ZERO"||cleanupState==="CLEAN";
  const ready=
    connectionState==="CONNECTED"&&
    authValid&&
    allowedSurface&&
    targetIdentityReadback==="PASS"&&
    inventoryKnown===true&&
    pricingKnown===true&&
    cleanupKnown;
  const blockers=[];
  if(connectionState!=="CONNECTED") blockers.push("SURFACE_NOT_CONNECTED");
  if(!authValid) blockers.push("SURFACE_AUTH_NOT_VALID");
  if(!allowedSurface) blockers.push("SURFACE_CLASS_NOT_ALLOWED");
  if(targetIdentityReadback!=="PASS") blockers.push("TARGET_IDENTITY_READBACK_NOT_PASS");
  if(inventoryKnown!==true) blockers.push("INVENTORY_READBACK_REQUIRED");
  if(pricingKnown!==true) blockers.push("PRICING_READBACK_REQUIRED");
  if(!cleanupKnown) blockers.push("PRIOR_CLEANUP_STATE_UNKNOWN");
  return Object.freeze({
    ready,
    status:ready?"READY_FOR_MINIMUM_COST_PROVISION":"DEFERRED_PROVIDER_LIVE_WORK",
    newResourceCreateAllowed:ready,
    blockers,
    blindProvisionAllowed:false
  });
}

export {ALLOWED_SURFACE_CLASSES as DIGITALOCEAN_ALLOWED_SURFACE_CLASSES,MAX_COST_CAP_MILLI_USD,MAX_TTL_SECONDS};
