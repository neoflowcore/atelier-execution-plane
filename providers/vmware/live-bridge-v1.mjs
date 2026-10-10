import { createHash } from "node:crypto";
const sha=v=>createHash("sha256").update(JSON.stringify(v),"utf8").digest("hex");
const MODES=new Set(["OFFICIAL_NATIVE_API","TRUSTED_EXECUTOR"]);
export function compileVmwareLiveBridgeV1(input={}){
  const mode=input.mode??"TRUSTED_EXECUTOR";
  if(!MODES.has(mode)) throw new Error("VMWARE_LIVE_BRIDGE_MODE_INVALID");
  if(typeof input.providerTarget!=="string"||!input.providerTarget) throw new Error("VMWARE_PROVIDER_TARGET_REQUIRED");
  if(typeof input.executionSurfaceId!=="string"||!input.executionSurfaceId) throw new Error("VMWARE_EXECUTION_SURFACE_ID_REQUIRED");
  const body={
    schemaId:"VMWARE_LIVE_BRIDGE_V1",
    version:"1",
    providerClass:"VMWARE",
    providerTarget:input.providerTarget,
    executionSurfaceId:input.executionSurfaceId,
    mode,
    connectionState:input.connectionState??"DEFERRED_LIVE_BINDING",
    existingInfrastructureOnly:true,
    newPaidResourceAllowed:false,
    manualSshNormalPath:false,
    termuxNormalPath:false,
    rawSecretChatPath:false,
    secretMaterialOnWorker:false,
    connectionMaterializationRequired:input.connectionState!=="CONNECTED",
    allowedTransports:["DIRECT_WORKER","GITHUB_SELF_HOSTED_JIT"],
    requiredReadback:["TARGET_IDENTITY","INVENTORY","READY_ATTESTATION","DELETE_OR_TERMINATE","DELETE_READBACK","RESIDUE_SCAN"]
  };
  return Object.freeze({...body,bridgeDigest:sha(body)});
}
export function evaluateVmwareLiveBridgeReadinessV1(bridge,input={}){
  if(!bridge||bridge.schemaId!=="VMWARE_LIVE_BRIDGE_V1") throw new Error("VMWARE_LIVE_BRIDGE_REQUIRED");
  const connected=bridge.connectionState==="CONNECTED";
  const targetOk=input.targetIdentityReadback==="PASS";
  const inventoryOk=input.inventoryReadback==="PASS";
  const readyOk=input.readyAttestation==="PASS";
  const cleanupKnown=input.cleanupState==="ZERO"||input.cleanupState==="CLEAN";
  const allowedMode=MODES.has(bridge.mode);
  const ready=connected&&targetOk&&inventoryOk&&readyOk&&cleanupKnown&&allowedMode;
  const blockers=[];
  if(!connected) blockers.push("SURFACE_NOT_CONNECTED");
  if(!allowedMode) blockers.push("SURFACE_MODE_NOT_ALLOWED");
  if(!targetOk) blockers.push("TARGET_IDENTITY_READBACK_NOT_PASS");
  if(!inventoryOk) blockers.push("INVENTORY_READBACK_NOT_PASS");
  if(!readyOk) blockers.push("READY_ATTESTATION_NOT_PASS");
  if(!cleanupKnown) blockers.push("PRIOR_CLEANUP_STATE_UNKNOWN");
  return Object.freeze({
    ready,
    status:ready?"READY_FOR_LIVE_QUALIFICATION":"DEFERRED_PROVIDER_LIVE_WORK",
    manualSshRequired:false,
    sourceWorkBlocked:false,
    liveEvidencePending:!ready,
    newResourceCreateAllowed:false,
    blockers
  });
}
