import {createHash} from 'node:crypto';
const sha=v=>createHash('sha256').update(JSON.stringify(v),'utf8').digest('hex');
export const INTERFACE_COMPONENTS=Object.freeze(['workerProtocol','computeProviderInterface','executionTransportInterface','protocolNegotiation','bootstrapBundle','readyAttestationProducer','preOperationPackage','secretBrokerInterface','checkpointResumeAdapter','cacheCandidateArtifactAdapter','cancellationReattachInterface','artifactEvidenceAdapter','externalControlPlaneAdapter','inventoryReaperWatchdog','jobSnapshotProjection','projectDeclaration']);
export function compileExecutionPlaneInterfaceFreezeV1({componentDigests={},runtimeHandoffDigest,liveQualificationStatus}={}){
  const missing=INTERFACE_COMPONENTS.filter(k=>typeof componentDigests[k]!=='string'||!componentDigests[k]);
  if(missing.length) throw new Error(`INTERFACE_COMPONENT_DIGEST_MISSING:${missing.join(',')}`);
  if(typeof runtimeHandoffDigest!=='string'||!runtimeHandoffDigest) throw new Error('RUNTIME_HANDOFF_DIGEST_REQUIRED');
  const body={schemaId:'EXECUTION_PLANE_REV52_INTERFACE_FREEZE_V1',version:'1',runtimeHandoffDigest,components:Object.fromEntries(INTERFACE_COMPONENTS.map(k=>[k,componentDigests[k]])),liveQualificationStatus:liveQualificationStatus??'PENDING',finalFreezeEligible:liveQualificationStatus==='PASS'};
  return Object.freeze({...body,interfaceDigest:sha(body)});
}
