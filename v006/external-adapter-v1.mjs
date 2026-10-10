import {reqStringV1,sha256V1} from "./core-util-v1.mjs";
export function compileV006ExternalExecutorAdapterV1(input={}){
  const body={schemaId:"V006_EXTERNAL_EXECUTOR_ADAPTER_V1",adapterId:reqStringV1(input.adapterId,"V006_ADAPTER_ID_REQUIRED"),executorClass:reqStringV1(input.executorClass,"V006_EXECUTOR_CLASS_REQUIRED"),extendsExistingExternalControlBridge:true,createsParallelAuthority:false,capabilities:[...new Set(input.capabilities??[])].sort(),dataPolicy:{sourceEgressAllowed:input.dataPolicy?.sourceEgressAllowed===true,artifactEgressAllowed:input.dataPolicy?.artifactEgressAllowed===true,targetExecutionZoneAllowed:input.dataPolicy?.targetExecutionZoneAllowed===true,executorTrustDomainAllowed:input.dataPolicy?.executorTrustDomainAllowed===true},retentionMapping:input.retentionMapping??{executablePayload:"EPHEMERAL",finalAcceptanceReceipt:"EVIDENCE_RETAINED"},credentialRefInjection:input.credentialRefInjection===true,rawCredentialInjection:false};
  return Object.freeze({...body,adapterDigest:sha256V1(body)});
}
export function evaluateAdapterDeliveryAdmissionV1(adapter={}){
  if(adapter.schemaId!=="V006_EXTERNAL_EXECUTOR_ADAPTER_V1")throw new Error("V006_ADAPTER_REQUIRED");
  const blockers=[];for(const [k,v] of Object.entries(adapter.dataPolicy))if(v!==true)blockers.push("DATA_POLICY:"+k);
  return Object.freeze({allowed:blockers.length===0,blockers,code:blockers.length?"HANDOFF_DENY":"ADAPTER_DELIVERY_ALLOWED"});
}
