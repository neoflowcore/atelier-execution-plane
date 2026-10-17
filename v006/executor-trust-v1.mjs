import {reqStringV1,reqIntV1,sha256V1} from "./core-util-v1.mjs";
export const EXTERNAL_EXECUTOR_CLASSES_V1=Object.freeze(["FIRST_PARTY_AUTOMATED","TRUSTED_MACHINE_EXECUTOR","PROVIDER_NATIVE_EXECUTOR","HUMAN_ACTUATED_EXECUTOR","BREAK_GLASS_EXECUTOR"]);
export function compileExternalExecutorCapabilityAttestationV1(input={}){
  if(!EXTERNAL_EXECUTOR_CLASSES_V1.includes(input.executorClass))throw new Error("V006_EXECUTOR_CLASS_INVALID");
  const capabilities=[...new Set(input.capabilities??[])].sort();
  if(capabilities.some(x=>typeof x!=="string"||!x))throw new Error("V006_EXECUTOR_CAPABILITY_INVALID");
  const observedAtMs=reqIntV1(input.observedAtMs,"V006_EXECUTOR_OBSERVED_AT_REQUIRED");
  const ttlMs=reqIntV1(input.capabilityTtlMs??300000,"V006_EXECUTOR_TTL_REQUIRED");
  if(ttlMs<=0)throw new Error("V006_EXECUTOR_TTL_INVALID");
  const body={schemaId:"V006_EXTERNAL_EXECUTOR_CAPABILITY_ATTESTATION_V1",executorId:reqStringV1(input.executorId,"V006_EXECUTOR_ID_REQUIRED"),executorClass:input.executorClass,os:input.os??null,architecture:input.architecture??null,shellRuntimeClass:input.shellRuntimeClass??null,toolVersions:input.toolVersions??{},networkReachability:[...new Set(input.networkReachability??[])].sort(),targetReachability:[...new Set(input.targetReachability??[])].sort(),protocolVersion:reqStringV1(input.protocolVersion,"V006_EXECUTOR_PROTOCOL_REQUIRED"),rendererVersion:reqStringV1(input.rendererVersion,"V006_RENDERER_PROTOCOL_REQUIRED"),receiptSchemaVersion:reqStringV1(input.receiptSchemaVersion,"V006_RECEIPT_SCHEMA_REQUIRED"),credentialInjectionCapability:input.credentialInjectionCapability===true,artifactTransferCapability:input.artifactTransferCapability===true,supportsAuthoritativeReadback:input.supportsAuthoritativeReadback===true,capabilities,observedAtMs,expiresAtMs:observedAtMs+ttlMs,trustToAct:"POLICY_CONTROLLED",trustToAccept:false};
  return Object.freeze({...body,attestationDigest:sha256V1(body)});
}
export function evaluateExternalExecutorAdmissionV1({attestation,requiredCapabilities=[],nowMs,dataPolicyCompatible=true,targetReachable=true,allowedExecutorClasses=EXTERNAL_EXECUTOR_CLASSES_V1}={}){
  if(!attestation||attestation.schemaId!=="V006_EXTERNAL_EXECUTOR_CAPABILITY_ATTESTATION_V1")return Object.freeze({allowed:false,code:"CAPABILITY_ATTESTATION_REQUIRED"});
  const missing=requiredCapabilities.filter(x=>!attestation.capabilities.includes(x));
  const stale=!Number.isSafeInteger(nowMs)||nowMs>attestation.expiresAtMs;
  const cls=!allowedExecutorClasses.includes(attestation.executorClass);
  const blockers=[];
  if(stale)blockers.push("CAPABILITY_ATTESTATION_STALE");
  if(missing.length)blockers.push("REQUIRED_CAPABILITY_MISSING");
  if(dataPolicyCompatible!==true)blockers.push("DATA_POLICY_INCOMPATIBLE");
  if(targetReachable!==true)blockers.push("TARGET_UNREACHABLE");
  if(cls)blockers.push("EXECUTOR_CLASS_DENIED");
  return Object.freeze({allowed:blockers.length===0,code:blockers.length?"HANDOFF_DELIVERY_DENY":"EXECUTOR_CANDIDATE_ALLOWED",missingCapabilities:missing,blockers,trustToAccept:false});
}
